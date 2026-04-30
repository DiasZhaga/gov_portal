import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.config import get_settings
from app.db import get_db
from app.deps import require_roles
from app.models import (
    Attachment,
    Department,
    RequestStatus,
    ServiceRequest,
    ServiceType,
    User,
    UserRole,
)
from app.schemas import AttachmentPublic, ServiceRequestCreate, ServiceRequestPublic

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_ATTACHMENTS_PER_REQUEST = 5
UPLOAD_CHUNK_SIZE = 1024 * 1024
FILE_SIGNATURES = {
    ".pdf": (b"%PDF-",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}
SERVICE_DEPARTMENT_CODES = {
    ServiceType.birth_certificate: "civil_registry",
    ServiceType.residence_certificate: "population_registry",
    ServiceType.tax_clearance: "tax_service",
}
MAX_SIGNATURE_BYTES = max(
    len(signature)
    for signatures in FILE_SIGNATURES.values()
    for signature in signatures
)


def _is_valid_upload_filename(filename: str) -> bool:
    stripped = filename.strip()
    if not stripped or stripped in {".", ".."}:
        return False
    if stripped != Path(stripped).name:
        return False
    if any(char in stripped for char in ("\x00", "/", "\\")):
        return False
    return True


def _has_valid_file_signature(ext: str, content: bytes) -> bool:
    signatures = FILE_SIGNATURES.get(ext, ())
    return any(content.startswith(signature) for signature in signatures)


def _remove_file_if_exists(path: Path | None) -> None:
    if path is None or not path.exists():
        return
    try:
        path.unlink()
    except OSError:
        logger.exception("Attachment file cleanup failed")


async def _stream_upload_to_temp_file(
    file: UploadFile,
    temp_path: Path,
    max_size_bytes: int,
) -> tuple[int, bytes]:
    total_size = 0
    header = bytearray()

    with temp_path.open("wb") as destination:
        while True:
            chunk = await file.read(UPLOAD_CHUNK_SIZE)
            if not chunk:
                break

            if total_size + len(chunk) > max_size_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="File too large."
                )

            if len(header) < MAX_SIGNATURE_BYTES:
                remaining_header_bytes = MAX_SIGNATURE_BYTES - len(header)
                header.extend(chunk[:remaining_header_bytes])

            destination.write(chunk)
            total_size += len(chunk)

    return total_size, bytes(header)


@router.post(
    "", response_model=ServiceRequestPublic, status_code=status.HTTP_201_CREATED
)
async def create_request(
    payload: ServiceRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> ServiceRequestPublic:
    department_code = SERVICE_DEPARTMENT_CODES[payload.service_type]
    department_result = await db.execute(
        select(Department).where(Department.code == department_code)
    )
    department = department_result.scalar_one_or_none()
    if department is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service routing is temporarily unavailable.",
        )

    request = ServiceRequest(
        citizen_id=current_user.id,
        department_id=department.id,
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
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found."
        )
    if request.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
        )
    return ServiceRequestPublic.model_validate(request)


@router.post(
    "/{request_id}/attachments",
    response_model=AttachmentPublic,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    request_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen])),
) -> AttachmentPublic:
    logger.info(
        "Attachment upload started user_id=%s request_id=%s",
        current_user.id,
        request_id,
    )
    result = await db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found."
        )
    if request.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied."
        )
    if request.status not in {RequestStatus.submitted, RequestStatus.in_review}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attachments are allowed only for requests in submitted or in_review status.",
        )

    original_filename = file.filename or ""
    if not _is_valid_upload_filename(original_filename):
        logger.warning(
            "Attachment upload rejected invalid_filename user_id=%s request_id=%s",
            current_user.id,
            request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename."
        )

    suffixes = Path(original_filename).suffixes
    if len(suffixes) != 1:
        logger.warning(
            "Attachment upload rejected invalid_extension user_id=%s request_id=%s suffix_count=%s",
            current_user.id,
            request_id,
            len(suffixes),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed."
        )

    ext = suffixes[0].lower()
    if ext not in ALLOWED_EXTENSIONS:
        logger.warning(
            "Attachment upload rejected invalid_extension user_id=%s request_id=%s ext=%s",
            current_user.id,
            request_id,
            ext,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="File type is not allowed."
        )

    attachment_count_result = await db.execute(
        select(func.count())
        .select_from(Attachment)
        .where(Attachment.request_id == request.id)
    )
    attachment_count = attachment_count_result.scalar_one()
    if attachment_count >= MAX_ATTACHMENTS_PER_REQUEST:
        logger.warning(
            "Attachment upload rejected limit_reached user_id=%s request_id=%s attachment_count=%s",
            current_user.id,
            request_id,
            attachment_count,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Attachment limit reached."
        )

    storage_dir = Path(settings.upload_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)

    temp_path = storage_dir / f".upload-{uuid.uuid4()}.tmp"
    temp_cleanup_path: Path | None = temp_path
    file_path: Path | None = None

    try:
        total_size, header = await _stream_upload_to_temp_file(
            file=file,
            temp_path=temp_path,
            max_size_bytes=settings.max_upload_size_bytes,
        )
        if total_size == 0:
            logger.warning(
                "Attachment upload rejected empty_file user_id=%s request_id=%s ext=%s",
                current_user.id,
                request_id,
                ext,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file is not allowed.",
            )
        if not _has_valid_file_signature(ext, header):
            logger.warning(
                "Attachment upload rejected invalid_signature user_id=%s request_id=%s ext=%s file_size=%s",
                current_user.id,
                request_id,
                ext,
                total_size,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match file type.",
            )

        stored_filename = f"{uuid.uuid4()}{ext}"
        file_path = storage_dir / stored_filename
        temp_path.replace(file_path)
        temp_cleanup_path = None
    except HTTPException as exc:
        if exc.detail == "File too large.":
            logger.warning(
                "Attachment upload rejected file_too_large user_id=%s request_id=%s ext=%s max_size=%s",
                current_user.id,
                request_id,
                ext,
                settings.max_upload_size_bytes,
            )
        _remove_file_if_exists(temp_cleanup_path)
        raise
    except Exception:
        logger.exception(
            "Attachment upload failed unexpectedly user_id=%s request_id=%s ext=%s",
            current_user.id,
            request_id,
            ext,
        )
        _remove_file_if_exists(temp_cleanup_path)
        raise
    finally:
        await file.close()

    if file_path is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Upload failed."
        )

    attachment = Attachment(
        request_id=request.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=total_size,
    )
    db.add(attachment)
    try:
        await db.commit()
        await db.refresh(attachment)
    except Exception:
        await db.rollback()
        logger.exception(
            "Attachment upload database commit failed after file move user_id=%s request_id=%s ext=%s file_size=%s",
            current_user.id,
            request_id,
            ext,
            total_size,
        )
        _remove_file_if_exists(file_path)
        raise

    logger.info(
        "Attachment upload succeeded user_id=%s request_id=%s attachment_id=%s ext=%s file_size=%s",
        current_user.id,
        request_id,
        attachment.id,
        ext,
        total_size,
    )

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="request.attachment.upload",
        target_type="attachment",
        target_id=attachment.id,
    )
    return AttachmentPublic.model_validate(attachment)
