import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def log_audit_event(
    db: AsyncSession,
    action: str,
    target_type: str,
    actor_id: uuid.UUID | None = None,
    target_id: uuid.UUID | None = None,
) -> AuditLog:
    log = AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log
