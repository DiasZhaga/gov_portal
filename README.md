# Gossector Portal MVP

Gossector Portal is a university MVP of a government service portal. Citizens can submit service requests and upload supporting documents, while operators review requests that belong only to their assigned department.

This repository is prepared for a Secure SDLC / OWASP Top 10 style assignment. The application is functional, but it is still an MVP and should not be presented as enterprise-ready production software.

## Main Business Scenario

1. A citizen registers with email, password, and IIN.
2. The citizen signs in, optionally completes MFA, and creates a service request.
3. The citizen can attach supporting documents to the request.
4. The backend routes the request to the correct department based on service type.
5. An operator sees only requests from their own department and updates request status.
6. The citizen can track request status and download their own uploaded files securely.

## User Roles

- `citizen` — registers, signs in, creates requests, uploads attachments, views own requests
- `operator` — signs in, sees only department-scoped requests, updates request statuses

## Key Features

- Citizen registration and login
- IIN validation and uniqueness checks
- JWT access tokens
- TOTP-based MFA setup, confirmation, verification, and disable flow
- Refresh token and logout flow
- Department-based request routing
- Role-based and object-level access control
- Secure attachment upload with file validation and streaming
- Secure attachment download through authenticated backend endpoint
- Backend logging and database audit events for critical actions

## Tech Stack

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- `python-jose` for JWT
- `passlib` + bcrypt for password hashing
- `pyotp` for TOTP MFA

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui components

## Project Structure

```text
backend/
  app/
    routers/        API routes
    config.py       settings and environment loading
    db.py           database setup
    models.py       SQLAlchemy models
    schemas.py      Pydantic schemas
    security.py     auth, token, MFA, and password helpers
  alembic/          database migrations
  scripts/          seed and operator bootstrap scripts

frontend/
  app/              Next.js App Router pages
  components/       reusable UI components
  lib/              API client, auth state, helpers, mock data
```

## Setup and Run

## 1. Database

From the `backend` folder:

```powershell
docker compose up -d
```

This starts PostgreSQL on `localhost:5432`.

## 2. Backend Setup

From the `backend` folder:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

Create `backend/.env` from `backend/.env.example` and set a strong `JWT_SECRET_KEY`.

Run migrations:

```powershell
alembic upgrade head
```

Seed departments:

```powershell
.\.venv\Scripts\python scripts\seed_departments.py
```

Create an operator account:

```powershell
.\.venv\Scripts\python scripts\create_operator.py --email operator@example.gov --iin 990709451634 --full-name "Operator User" --department-code civil_registry
```

Start the backend:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Backend health check:

```text
http://127.0.0.1:8000/health
```

## 3. Frontend Setup

From the `frontend` folder:

```powershell
pnpm install
```

Create `frontend/.env.local` from `frontend/.env.example`.

For normal local development with the real backend:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Start the frontend:

```powershell
pnpm dev
```

Frontend URL:

```text
http://127.0.0.1:3000
```

## 4. Creating New Migrations

From the `backend` folder:

```powershell
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

The application is configured for migration-based schema management. It should not create tables automatically at runtime.

## Environment Variables

Secrets must be stored in `.env` files and must not be committed to Git.

### Backend

Required or commonly used:

- `DATABASE_URL` — async SQLAlchemy database URL, for example `postgresql+asyncpg://...`
- `JWT_SECRET_KEY` — strong secret for signing JWT and MFA tokens
- `JWT_ALGORITHM` — defaults to `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES` — access token lifetime
- `UPLOAD_DIR` — local storage directory for attachments
- `MAX_UPLOAD_SIZE_BYTES` — per-file upload size limit

### Frontend

- `NEXT_PUBLIC_API_URL` — real backend base URL
- `NEXT_PUBLIC_ENABLE_MOCK_API` — optional explicit mock mode for development only

Mock mode is not enabled automatically. If `NEXT_PUBLIC_API_URL` is missing and mock mode is not explicitly enabled, the frontend fails closed with a configuration error.

## Implemented Security Mechanisms

- Password hashing with bcrypt via `passlib`
- JWT-based access tokens with purpose scoping
- TOTP MFA setup, verification, and disable flow
- Refresh token persistence with hashed refresh tokens in the database
- Logout endpoint that revokes refresh tokens
- Role-based access control for citizen and operator flows
- Object-level access control for requests and attachments
- Department-based scoping so operators only see their own department's requests
- Secure attachment upload:
  - extension allowlist
  - signature validation
  - upload size limit
  - streamed file handling with temporary files
- Secure attachment download via authenticated backend route
- Brute-force protection for login and MFA verification
- Application logging and audit events without logging passwords, tokens, raw MFA codes, or internal file paths

## Security and Quality Checks

Run from the `backend` folder after installing `requirements-dev.txt`:

```powershell
ruff check .
mypy app
bandit -r app
pip-audit -r requirements.txt
semgrep --config auto .
```

Useful frontend checks:

```powershell
pnpm lint
pnpm exec tsc --noEmit
```

These checks are currently manual. There is no CI/CD pipeline configured in this repository.

## Known Limitations and Residual Risks

- `totp_secret` is still stored in plaintext in the database
- Frontend tokens are stored in `localStorage`
- No password reset or account recovery flow
- No centralized alerting or SIEM integration
- Brute-force limiting is in-memory and local to one backend process
- Refresh tokens are not rotated on every refresh
- Attachment storage uses local disk, not object storage
- This MVP is designed for coursework and local/demo deployment, not hardened production deployment

## Demo Preparation Notes

Before demo or submission review, make sure you have:

1. Started PostgreSQL with Docker
2. Applied Alembic migrations
3. Seeded departments with `scripts/seed_departments.py`
4. Created at least one operator using `scripts/create_operator.py`
5. Configured `backend/.env` and `frontend/.env.local`

## License / Academic Note

This repository is prepared as a university MVP submission for secure software development coursework.
