import argparse
import asyncio
import os
import sys
from getpass import getpass
from pathlib import Path
import uuid

import asyncpg
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
    # asyncpg expects postgresql://, not postgresql+asyncpg://
    return url.replace("postgresql+asyncpg://", "postgresql://")


def _prompt_if_missing(value: str | None, label: str, is_secret: bool = False) -> str:
    if value:
        return value
    if is_secret:
        return getpass(label + ": ")
    return input(label + ": ").strip()


def _validate_iin(iin: str) -> None:
    if len(iin) != 12 or not iin.isdigit():
        print("IIN must contain exactly 12 digits.")
        sys.exit(1)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create an operator user")
    parser.add_argument("--email", help="Operator email")
    parser.add_argument("--iin", help="Operator IIN")
    parser.add_argument("--department-code", help="Operator department code")
    parser.add_argument("--full-name", help="Operator full name")
    parser.add_argument("--password", help="Operator password (omit to prompt)")
    args = parser.parse_args()

    email = _prompt_if_missing(args.email, "Email")
    iin = _prompt_if_missing(args.iin, "IIN")
    department_code = _prompt_if_missing(args.department_code, "Department code")
    full_name = _prompt_if_missing(args.full_name, "Full name")
    password = _prompt_if_missing(args.password, "Password", is_secret=True)

    _validate_iin(iin)
    if len(password) < 8 or len(password) > 128:
        print("Password must be 8-128 characters.")
        sys.exit(1)

    db_url = _get_db_url()
    conn = await asyncpg.connect(db_url)
    try:
        department_id = await conn.fetchval(
            "SELECT id FROM departments WHERE code=$1",
            department_code,
        )
        if department_id is None:
            print("Department not found. Run scripts/seed_departments.py first.")
            sys.exit(1)

        existing = await conn.fetchval(
            "SELECT 1 FROM users WHERE email=$1 OR iin=$2",
            email,
            iin,
        )
        if existing:
            print("A user with this email or IIN already exists.")
            sys.exit(1)

        hashed = pwd_context.hash(password)
        await conn.execute(
            """
            INSERT INTO users (
                id,
                full_name,
                email,
                iin,
                department_id,
                hashed_password,
                role,
                mfa_enabled,
                totp_secret,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'operator', false, null, now())
            """,
            uuid.uuid4(),
            full_name,
            email,
            iin,
            department_id,
            hashed,
        )
        print("Operator user created:")
        print(f"  Email: {email}")
        print(f"  IIN: ********{iin[-4:]}")
        print(f"  Department: {department_code}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
