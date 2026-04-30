import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import RequestStatus, ServiceType, UserRole


class AuthTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutResponse(BaseModel):
    success: bool


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    iin: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("iin")
    @classmethod
    def validate_iin(cls, value: str) -> str:
        if len(value) != 12 or not value.isdigit():
            raise ValueError("IIN must contain exactly 12 digits.")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    iin_masked: str
    role: UserRole
    mfa_enabled: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MFASetupResponse(BaseModel):
    otpauth_uri: str


class MFAConfirmRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class MFAVerifyRequest(BaseModel):
    mfa_token: str = Field(min_length=1)
    code: str = Field(pattern=r"^\d{6}$")


class MFADisableRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class LoginMFARequiredResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str
    token_type: str = "mfa"


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
