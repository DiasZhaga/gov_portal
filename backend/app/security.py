from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ACCESS_TOKEN_PURPOSE = "access"
MFA_TOKEN_EXPIRE_MINUTES = 5
MFA_TOKEN_PURPOSE = "mfa"
REFRESH_TOKEN_BYTES = 32
REFRESH_TOKEN_EXPIRE_DAYS = 30


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "purpose": ACCESS_TOKEN_PURPOSE, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        sub = payload.get("sub")
        purpose = payload.get("purpose", ACCESS_TOKEN_PURPOSE)
        if not sub:
            raise ValueError("Token payload missing subject.")
        if purpose != ACCESS_TOKEN_PURPOSE:
            raise ValueError("Invalid access token purpose.")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired token.") from exc


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def build_totp_uri(secret: str, email: str, issuer_name: str = "Gossector") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer_name)


def verify_totp_code(secret: str, code: str) -> bool:
    if not code.isdigit():
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def create_mfa_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=MFA_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "purpose": MFA_TOKEN_PURPOSE, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_mfa_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        sub = payload.get("sub")
        purpose = payload.get("purpose")
        if not sub:
            raise ValueError("Token payload missing subject.")
        if purpose != MFA_TOKEN_PURPOSE:
            raise ValueError("Invalid MFA token purpose.")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired MFA token.") from exc


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(REFRESH_TOKEN_BYTES)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_refresh_token_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
