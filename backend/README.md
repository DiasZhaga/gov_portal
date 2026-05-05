# Backend Notes

The main project documentation is in the repository root `README.md`.

Useful backend bootstrap commands from the `backend` folder:

```powershell
alembic upgrade head
.\.venv\Scripts\python scripts\seed_departments.py
.\.venv\Scripts\python scripts\create_operator.py --email operator@example.gov --iin 990709451634 --full-name "Operator User" --department-code civil_registry
python -m uvicorn app.main:app --reload --port 8000
```
