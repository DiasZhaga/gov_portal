from collections import defaultdict, deque
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.db import get_db
from app.deps import get_current_user
from app.models import User, UserRole
from app.schemas import Token, UserLogin, UserPublic, UserRegister
from app.security import create_access_token, hash_password, verify_password

router = APIRouter()

FAILED_LOGIN_WINDOW_SECONDS = 300
MAX_FAILED_LOGIN_ATTEMPTS = 5
_failed_login_attempts: dict[tuple[str, str], deque[float]] = defaultdict(deque)


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


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)) -> UserPublic:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration could not be completed.",
        )

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.citizen,
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


@router.post("/login", response_model=Token)
async def login(
    payload: UserLogin, request: Request, db: AsyncSession = Depends(get_db)
) -> Token:
    if _is_login_rate_limited(request, payload.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        _record_failed_login_attempt(request, payload.email)
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
    token = create_access_token(subject=str(user.id))
    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="auth.login.success",
        target_type="user",
        target_id=user.id,
    )
    return Token(access_token=token)


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
