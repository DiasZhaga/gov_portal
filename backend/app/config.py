from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/gossector"
    )
    jwt_secret_key: str = Field(default="change-me-in-env")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=30)
    upload_dir: str = Field(default="uploads")
    max_upload_size_bytes: int = Field(default=5 * 1024 * 1024)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="allow",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
