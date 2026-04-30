from collections import defaultdict, deque
from datetime import datetime, timezone
import logging
from time import monotonic
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.db import get_db
from app.deps import get_current_user
from app.models import RefreshToken, User, UserRole
from app.schemas import (
    AccessTokenResponse,
    AuthTokenResponse,
    MFADisableRequest,
    LoginMFARequiredResponse,
    LogoutRequest,
    LogoutResponse,
    MFAConfirmRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    RefreshTokenRequest,
    UserLogin,
    UserPublic,
    UserRegister,
)
from app.security import (
    build_totp_uri,
    create_access_token,
    create_mfa_token,
    decode_mfa_token,
    generate_refresh_token,
    generate_totp_secret,
    get_refresh_token_expires_at,
    hash_password,
    hash_refresh_token,
    verify_password,
    verify_totp_code,
)

router = APIRouter()
logger = logging.getLogger(__name__)

FAILED_LOGIN_WINDOW_SECONDS = 300
MAX_FAILED_LOGIN_ATTEMPTS = 5
FAILED_MFA_WINDOW_SECONDS = 300
MAX_FAILED_MFA_ATTEMPTS = 5
_failed_login_attempts: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_failed_mfa_attempts: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def _login_attempt_key(request: Request, email: str) -> tuple[str, str]:
    client_host = request.client.host if request.client else "unknown"
    return (client_host, email.strip().lower())


def _prune_failed_attempts(attempts: deque[float], now: float) -> None:
    while attempts and now - attempts[0] > FAILED_LOGIN_WINDOW_SECONDS:
        attempts.popleft()


def _is_login_rate_limited(request: Request, email: str) -> bool:
    key = _login_attempt_key(request, email)
    attempts = _failed_login_attempts[key]
    now = monotonic()
    _prune_failed_attempts(attempts, now)
    return len(attempts) >= MAX_FAILED_LOGIN_ATTEMPTS


def _record_failed_login_attempt(request: Request, email: str) -> None:
    key = _login_attempt_key(request, email)
    attempts = _failed_login_attempts[key]
    now = monotonic()
    _prune_failed_attempts(attempts, now)
    attempts.append(now)


def _clear_failed_login_attempts(request: Request, email: str) -> None:
    _failed_login_attempts.pop(_login_attempt_key(request, email), None)


def _mfa_attempt_key(request: Request, user_id: UUID) -> tuple[str, str]:
    client_host = request.client.host if request.client else "unknown"
    return (client_host, str(user_id))


def _is_mfa_rate_limited(request: Request, user_id: UUID) -> bool:
    key = _mfa_attempt_key(request, user_id)
    attempts = _failed_mfa_attempts[key]
    now = monotonic()
    while attempts and now - attempts[0] > FAILED_MFA_WINDOW_SECONDS:
        attempts.popleft()
    return len(attempts) >= MAX_FAILED_MFA_ATTEMPTS


def _record_failed_mfa_attempt(request: Request, user_id: UUID) -> None:
    key = _mfa_attempt_key(request, user_id)
    attempts = _failed_mfa_attempts[key]
    now = monotonic()
    while attempts and now - attempts[0] > FAILED_MFA_WINDOW_SECONDS:
        attempts.popleft()
    attempts.append(now)


def _clear_failed_mfa_attempts(request: Request, user_id: UUID) -> None:
    _failed_mfa_attempts.pop(_mfa_attempt_key(request, user_id), None)


async def _issue_token_pair(db: AsyncSession, user: User) -> AuthTokenResponse:
    access_token = create_access_token(subject=str(user.id))
    refresh_token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=get_refresh_token_expires_at(),
        )
    )
    await db.commit()
    return AuthTokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)) -> UserPublic:
    existing = await db.execute(
        select(User).where(or_(User.email == payload.email, User.iin == payload.iin))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration could not be completed.",
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        iin=payload.iin,
        hashed_password=hash_password(payload.password),
        role=UserRole.citizen,
        mfa_enabled=False,
        totp_secret=None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="auth.register.success",
        target_type="user",
        target_id=user.id,
    )
    return UserPublic.model_validate(user)


@router.post("/login", response_model=AuthTokenResponse | LoginMFARequiredResponse)
async def login(
    payload: UserLogin, request: Request, db: AsyncSession = Depends(get_db)
) -> AuthTokenResponse | LoginMFARequiredResponse:
    if _is_login_rate_limited(request, payload.email):
        logger.warning(
            "Login rate limited email=%s client_ip=%s",
            payload.email,
            request.client.host if request.client else "unknown",
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        _record_failed_login_attempt(request, payload.email)
        logger.warning(
            "Login failed email=%s client_ip=%s",
            payload.email,
            request.client.host if request.client else "unknown",
        )
        await log_audit_event(
            db=db,
            action="auth.login.failed",
            target_type="user",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    _clear_failed_login_attempts(request, payload.email)
    if user.mfa_enabled:
        mfa_token = create_mfa_token(subject=str(user.id))
        logger.info("Login requires MFA user_id=%s", user.id)
        await log_audit_event(
            db=db,
            actor_id=user.id,
            action="auth.login.mfa_required",
            target_type="user",
            target_id=user.id,
        )
        return LoginMFARequiredResponse(mfa_token=mfa_token)

    tokens = await _issue_token_pair(db, user)
    logger.info("Login succeeded user_id=%s mfa_enabled=false", user.id)
    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="auth.login.success",
        target_type="user",
        target_id=user.id,
    )
    return tokens


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)
) -> AccessTokenResponse:
    token_hash = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    refresh_record = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if (
        refresh_record is None
        or refresh_record.is_revoked
        or refresh_record.expires_at <= now
    ):
        logger.warning("Refresh token rejected reason=invalid_or_expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    logger.info("Refresh token succeeded user_id=%s", refresh_record.user_id)
    return AccessTokenResponse(access_token=create_access_token(subject=str(refresh_record.user_id)))


@router.post("/logout", response_model=LogoutResponse)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)) -> LogoutResponse:
    token_hash = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    refresh_record = result.scalar_one_or_none()
    if refresh_record and not refresh_record.is_revoked:
        refresh_record.is_revoked = True
        await db.commit()
        logger.info("Logout succeeded user_id=%s", refresh_record.user_id)
    else:
        logger.warning("Logout completed with missing_or_revoked_token")
    return LogoutResponse(success=True)


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MFASetupResponse:
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled.",
        )

    secret = generate_totp_secret()
    current_user.totp_secret = secret
    await db.commit()
    await db.refresh(current_user)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="auth.mfa.setup.started",
        target_type="user",
        target_id=current_user.id,
    )
    return MFASetupResponse(otpauth_uri=build_totp_uri(secret, current_user.email))


@router.post("/mfa/confirm", response_model=UserPublic)
async def confirm_mfa(
    payload: MFAConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    if current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled.",
        )
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA setup has not been started.",
        )
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code.",
        )

    current_user.mfa_enabled = True
    await db.commit()
    await db.refresh(current_user)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="auth.mfa.enabled",
        target_type="user",
        target_id=current_user.id,
    )
    return UserPublic.model_validate(current_user)


@router.post("/mfa/verify", response_model=AuthTokenResponse)
async def verify_mfa(
    payload: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> AuthTokenResponse:
    try:
        token_payload = decode_mfa_token(payload.mfa_token)
        user_id = UUID(str(token_payload["sub"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired MFA token.",
        ) from exc

    if _is_mfa_rate_limited(request, user_id):
        logger.warning(
            "MFA verify rate limited user_id=%s client_ip=%s",
            user_id,
            request.client.host if request.client else "unknown",
        )
        await log_audit_event(
            db=db,
            actor_id=user_id,
            action="auth.mfa.verify.rate_limited",
            target_type="user",
            target_id=user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed MFA attempts. Please try again later.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.mfa_enabled or not user.totp_secret:
        logger.warning("MFA verify rejected invalid_state user_id=%s", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA verification.",
        )
    if not verify_totp_code(user.totp_secret, payload.code):
        _record_failed_mfa_attempt(request, user_id)
        logger.warning(
            "MFA verify failed user_id=%s client_ip=%s",
            user.id,
            request.client.host if request.client else "unknown",
        )
        await log_audit_event(
            db=db,
            actor_id=user.id,
            action="auth.mfa.verify.failed",
            target_type="user",
            target_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA verification.",
        )

    _clear_failed_mfa_attempts(request, user_id)
    tokens = await _issue_token_pair(db, user)
    logger.info(
        "MFA verify succeeded user_id=%s client_ip=%s",
        user.id,
        request.client.host if request.client else "unknown",
    )
    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="auth.mfa.verify.success",
        target_type="user",
        target_id=user.id,
    )
    return tokens


@router.post("/mfa/disable", response_model=UserPublic)
async def disable_mfa(
    payload: MFADisableRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserPublic:
    if not current_user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled.",
        )
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not configured correctly.",
        )
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA code.",
        )

    current_user.mfa_enabled = False
    current_user.totp_secret = None
    await db.commit()
    await db.refresh(current_user)

    logger.info("MFA disabled user_id=%s", current_user.id)
    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="auth.mfa.disabled",
        target_type="user",
        target_id=current_user.id,
    )
    return UserPublic.model_validate(current_user)


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
