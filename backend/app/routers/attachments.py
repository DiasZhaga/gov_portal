import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.audit import log_audit_event
from app.config import get_settings
from app.db import get_db
from app.deps import require_roles
from app.models import Attachment, ServiceRequest, User, UserRole

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


def _build_attachment_path(stored_filename: str) -> Path:
    filename = Path(stored_filename).name
    if filename != stored_filename or filename in {"", ".", ".."}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment file not found.",
        )
    return Path(settings.upload_dir) / filename


def _ensure_attachment_access(current_user: User, request: ServiceRequest) -> None:
    if current_user.role == UserRole.citizen:
        if request.citizen_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )
        return

    if current_user.role == UserRole.operator:
        if current_user.department_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operator department is not assigned.",
            )
        if request.department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied.",
    )


@router.get("/{attachment_id}/download")
async def download_attachment(
    attachment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.citizen, UserRole.operator])),
) -> FileResponse:
    logger.info(
        "Attachment download requested user_id=%s attachment_id=%s",
        current_user.id,
        attachment_id,
    )
    result = await db.execute(
        select(Attachment)
        .options(selectinload(Attachment.request))
        .where(Attachment.id == attachment_id)
    )
    attachment = result.scalar_one_or_none()
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found.",
        )

    try:
        _ensure_attachment_access(current_user, attachment.request)
    except HTTPException:
        logger.warning(
            "Attachment download denied user_id=%s attachment_id=%s role=%s request_id=%s department_id=%s",
            current_user.id,
            attachment_id,
            current_user.role.value,
            attachment.request_id,
            current_user.department_id,
        )
        raise

    file_path = _build_attachment_path(attachment.stored_filename)
    if not file_path.is_file():
        logger.warning(
            "Attachment download missing_file user_id=%s attachment_id=%s request_id=%s",
            current_user.id,
            attachment.id,
            attachment.request_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment file not found.",
        )

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="request.attachment.download",
        target_type="attachment",
        target_id=attachment.id,
    )

    logger.info(
        "Attachment download succeeded user_id=%s attachment_id=%s request_id=%s mime_type=%s",
        current_user.id,
        attachment.id,
        attachment.request_id,
        attachment.mime_type or "application/octet-stream",
    )

    return FileResponse(
        path=file_path,
        media_type=attachment.mime_type or "application/octet-stream",
        filename=attachment.original_filename,
    )
