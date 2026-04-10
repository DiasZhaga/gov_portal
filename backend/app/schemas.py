import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import RequestStatus, ServiceType, UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogCreate(BaseModel):
    actor_id: uuid.UUID | None = None
    action: str = Field(min_length=1, max_length=100)
    target_type: str = Field(min_length=1, max_length=100)
    target_id: uuid.UUID | None = None


class ServiceRequestCreate(BaseModel):
    service_type: ServiceType
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=5, max_length=5000)


class ServiceRequestPublic(BaseModel):
    id: uuid.UUID
    service_type: ServiceType
    title: str
    description: str
    status: RequestStatus
    public_comment: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttachmentPublic(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    original_filename: str
    mime_type: str
    file_size_bytes: int
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperatorStatusUpdate(BaseModel):
    status: RequestStatus
    public_comment: str | None = Field(default=None, max_length=2000)
