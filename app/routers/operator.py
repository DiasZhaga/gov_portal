import uuid
from inspect import signature

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import log_audit_event
from app.db import get_db
from app.deps import require_roles
from app.models import RequestStatus, ServiceRequest, User, UserRole
from app.schemas import OperatorStatusUpdate, ServiceRequestPublic

router = APIRouter()

ALLOWED_TRANSITIONS = {
    RequestStatus.submitted: {RequestStatus.in_review},
    RequestStatus.in_review: {RequestStatus.approved, RequestStatus.rejected},
}


@router.get("/requests", response_model=list[ServiceRequestPublic])
async def list_all_requests(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles([UserRole.operator])),
) -> list[ServiceRequestPublic]:
    result = await db.execute(select(ServiceRequest).order_by(ServiceRequest.created_at.desc()))
    requests = result.scalars().all()
    return [ServiceRequestPublic.model_validate(item) for item in requests]


@router.patch("/requests/{request_id}/status", response_model=ServiceRequestPublic)
async def update_request_status(
    request_id: uuid.UUID,
    payload: OperatorStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.operator])),
) -> ServiceRequestPublic:
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    allowed_next = ALLOWED_TRANSITIONS.get(request.status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition.",
        )

    old_status = request.status
    request.status = payload.status
    request.public_comment = payload.public_comment
    await db.commit()
    await db.refresh(request)

    audit_kwargs = {
        "db": db,
        "actor_id": current_user.id,
        "action": "operator.request.status_change",
        "target_type": "service_request",
        "target_id": request.id,
    }
    if "metadata" in signature(log_audit_event).parameters:
        audit_kwargs["metadata"] = {"old_status": old_status.value, "new_status": payload.status.value}
    await log_audit_event(**audit_kwargs)
    return ServiceRequestPublic.model_validate(request)
