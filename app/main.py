from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from app.config import get_settings
from app.db import Base, engine
from app.routers import auth, operator, requests

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Gossector API", version="0.1.0", lifespan=lifespan)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(requests.router, prefix="/requests", tags=["citizen-requests"])
app.include_router(operator.router, prefix="/operator", tags=["operator"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
