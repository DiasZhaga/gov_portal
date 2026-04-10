import argparse
import asyncio
import os
import sys
from getpass import getpass

import asyncpg
from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_db_url() -> str:
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


async def main() -> None:
    parser = argparse.ArgumentParser(description="Create an operator user")
    parser.add_argument("--email", help="Operator email")
    parser.add_argument("--full-name", help="Operator full name")
    parser.add_argument("--password", help="Operator password (omit to prompt)")
    args = parser.parse_args()

    email = _prompt_if_missing(args.email, "Email")
    full_name = _prompt_if_missing(args.full_name, "Full name")
    password = _prompt_if_missing(args.password, "Password", is_secret=True)

    if len(password) < 8 or len(password) > 128:
        print("Password must be 8-128 characters.")
        sys.exit(1)

    db_url = _get_db_url()
    conn = await asyncpg.connect(db_url)
    try:
        existing = await conn.fetchval("SELECT 1 FROM users WHERE email=$1", email)
        if existing:
            print("A user with this email already exists.")
            sys.exit(1)

        hashed = pwd_context.hash(password)
        await conn.execute(
            """
            INSERT INTO users (id, full_name, email, hashed_password, role, created_at)
            VALUES (gen_random_uuid(), $1, $2, $3, 'operator', now())
            """,
            full_name,
            email,
            hashed,
        )
        print("Operator user created:")
        print(f"  Email: {email}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
