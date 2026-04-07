from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.db import get_db
from app.deps import get_current_user
from app.models import User, UserRole
from app.schemas import Token, UserLogin, UserPublic, UserRegister
from app.security import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)) -> UserPublic:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
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
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)) -> Token:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

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
