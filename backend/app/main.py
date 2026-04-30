from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import attachments, auth, operator, requests

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    # Database schema management should be handled by migrations, not at runtime startup.
    yield


app = FastAPI(title="Gossector API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(requests.router, prefix="/requests", tags=["citizen-requests"])
app.include_router(operator.router, prefix="/operator", tags=["operator"])
app.include_router(attachments.router, prefix="/attachments", tags=["attachments"])


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
