import asyncio
import os
import sys
from pathlib import Path
import uuid

import asyncpg


DEPARTMENTS = (
    ("civil_registry", "Department of Civil Registry"),
    ("population_registry", "Department of Population Registration"),
    ("tax_service", "Tax Department"),
)


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _get_db_url() -> str:
    _load_dotenv()
    url = os.getenv("DATABASE_URL") or os.getenv("database_url") or ""
    if not url:
        print("DATABASE_URL is not set. Provide it in backend/.env.")
        sys.exit(1)
    return url.replace("postgresql+asyncpg://", "postgresql://")


async def main() -> None:
    conn = await asyncpg.connect(_get_db_url())
    try:
        for code, name in DEPARTMENTS:
            await conn.execute(
                """
                INSERT INTO departments (id, code, name, created_at)
                VALUES ($1, $2, $3, now())
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
                """,
                uuid.uuid4(),
                code,
                name,
            )
        print("Departments seeded:")
        for code, name in DEPARTMENTS:
            print(f"  {code}: {name}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
