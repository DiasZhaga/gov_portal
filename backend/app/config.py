from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/gossector"
    )
    jwt_secret_key: str
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    upload_dir: str = Field(default="uploads")
    max_upload_size_bytes: int = Field(default=5 * 1024 * 1024)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )

    @field_validator("jwt_secret_key")
    @classmethod
    def validate_jwt_secret_key(cls, value: str) -> str:
        secret = value.strip()
        insecure_values = {
            "",
            "change-me-in-env",
            "changeme",
            "secret",
            "default",
            "jwt-secret",
        }
        if secret.lower() in insecure_values:
            raise ValueError("JWT_SECRET_KEY must be set to a strong non-default value.")
        return secret


@lru_cache
def get_settings() -> Settings:
    return Settings()
