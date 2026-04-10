# gov_portal

## Create operator user

From the backend folder (with backend/.env configured and DB running):

```powershell
.\.venv\Scripts\python scripts\create_operator.py
```

Optional flags:

```powershell
.\.venv\Scripts\python scripts\create_operator.py --email operator@example.com --full-name "Operator User"
```
