import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.config import get_settings
from app.db import get_db
from app.deps import require_roles
from app.models import Attachment, RequestStatus, ServiceRequest, User, UserRole
from app.schemas import AttachmentPublic, ServiceRequestCreate, ServiceRequestPublic

router = APIRouter()
settings = get_settings()

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
FILE_SIGNATURES = {
    ".pdf": (b"%PDF-",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}


def _is_valid_upload_filename(filename: str) -> bool:
    stripped = filename.strip()
    if not stripped or stripped in {".", ".."}:
        return False
    if stripped != Path(stripped).name:
        return False
    if any(char in stripped for char in ('\x00', "/", "\\")):
        return False
    return True


def _has_valid_file_signature(ext: str, content: bytes) -> bool:
    signatures = FILE_SIGNATURES.get(ext, ())
    return any(content.startswith(signature) for signature in signatures)


@router.post("", response_model=ServiceRequestPublic, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: ServiceRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> ServiceRequestPublic:
    request = ServiceRequest(
        citizen_id=current_user.id,
        service_type=payload.service_type,
        title=payload.title,
        description=payload.description,
        status=RequestStatus.submitted,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="request.create",
        target_type="service_request",
        target_id=request.id,
    )
    return ServiceRequestPublic.model_validate(request)


@router.get("/my", response_model=list[ServiceRequestPublic])
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> list[ServiceRequestPublic]:
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.citizen_id == current_user.id)
        .order_by(ServiceRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return [ServiceRequestPublic.model_validate(item) for item in requests]


@router.get("/{request_id}", response_model=ServiceRequestPublic)
async def get_request_by_id(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> ServiceRequestPublic:
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return ServiceRequestPublic.model_validate(request)


@router.post("/{request_id}/attachments", response_model=AttachmentPublic, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    request_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> AttachmentPublic:
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")
    if request.citizen_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    if request.status not in {RequestStatus.submitted, RequestStatus.in_review}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachments are allowed only for requests in submitted or in_review status.",
        )

    original_filename = file.filename or ""
    if not _is_valid_upload_filename(original_filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename.")

    suffixes = Path(original_filename).suffixes
    if len(suffixes) != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed.")

    ext = suffixes[0].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file is not allowed.")
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large.")
    if not _has_valid_file_signature(ext, content):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File content does not match file type.")

    storage_dir = Path(settings.upload_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4()}{ext}"
    file_path = storage_dir / stored_filename
    file_path.write_bytes(content)

    attachment = Attachment(
        request_id=request.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(content),
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="request.attachment.upload",
        target_type="attachment",
        target_id=attachment.id,
    )
    return AttachmentPublic.model_validate(attachment)
