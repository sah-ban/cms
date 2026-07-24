# AI-Powered Customer Complaint Management System

Pharmaceutical manufacturing complaint intake and triage system for API and FDF quality teams.

The application models a regulated QMS complaint workflow: customer complaint intake, product and batch identification, severity and priority classification, QA investigation, CAPA linkage, and AI-assisted extraction from complaint text.

## Stack

- Frontend: React, TypeScript, Redux Toolkit, Vite, Inter font
- Backend: FastAPI, SQLAlchemy, Pydantic
- AI agent framework: LangGraph
- LLM provider: Groq, default model `gemma2-9b-it`
- Database: PostgreSQL

## Quick Start

1. Start the database:

```bash
docker compose up -d db
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

Set `GROQ_API_KEY` when you are ready to use live AI extraction. Without it, the backend returns a deterministic development extraction.

3. Run the backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

4. Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and calls the backend at `http://localhost:8000`.

## QMS Notes

The complaint module is designed around pharmaceutical QMS expectations:

- Complaint records must capture product, lot, complainant, complaint nature, investigation findings, follow-up, and rationale when an investigation is not required.
- QA triage determines whether the complaint indicates a possible specification failure, patient risk, adverse event, recall signal, deviation, or CAPA need.
- API and FDF contexts require batch traceability, expiry/manufacturing dates, strength or grade, impacted quantity, and manufacturing site visibility.
- AI output is assistive only. Regulated decisions remain owned by qualified QA users.

