# AI-Powered Customer Complaint Management System

A full-stack pharmaceutical QMS complaint intake and triage application for API and FDF quality teams.

The system combines a structured complaint log form with an AI assistant that can extract complaint details from pasted text or uploaded documents, update form fields from natural-language prompts, and support QA triage review.

## Features

- Structured complaint intake form for regulated QMS records.
- AI chat assistant for complaint questions and form updates.
- Natural-language corrections, such as changing product strength or complaint dates.
- AI extraction from pasted complaint text.
- Document extraction from `PDF`, `DOCX`, `TXT`, and `EML` uploads.
- Product and batch identification, including product name, strength/grade, lot number, dates, quantity affected, complaint type, severity, priority, summary, and risk flags.
- PostgreSQL persistence for saved complaints.
- Deterministic fallback extraction for development when `GROQ_API_KEY` is not configured.

## Stack

- Frontend: React, TypeScript, Redux Toolkit, Vite
- Backend: FastAPI, SQLAlchemy, Pydantic
- AI workflow: LangGraph
- LLM provider: Groq
- Document parsing: pypdf for PDFs, built-in DOCX/TXT/EML parsers
- Database: PostgreSQL

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── complaint_graph.py
│   │   │   └── document_text.py
│   │   ├── api/routes.py
│   │   ├── db/
│   │   ├── schemas.py
│   │   └── main.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── features/complaints/
│   │   ├── App.tsx
│   │   └── styles.css
│   └── package.json
├── docker-compose.yml
└── package.json
```

## Local Setup

### 1. Start PostgreSQL

```bash
docker compose up -d db
```

The local database uses:

```text
Database: complaints_qms
User: qms_user
Password: qms_password
Port: 5432
```

### 2. Configure Backend Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://qms_user:qms_password@localhost:5432/complaints_qms
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GROQ_CONTEXT_MODEL=llama-3.3-70b-versatile
FRONTEND_ORIGIN=http://localhost:5173
```

Set `GROQ_API_KEY` to enable live AI extraction and chat. Without it, the backend still runs but uses fallback behavior for extraction and limited assistant responses.

### 3. Install and Run Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend API docs:

```text
http://localhost:8000/docs
```

### 4. Install and Run Frontend

From the repository root:

```bash
npm install --prefix frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` requests to `http://localhost:8000`.

## Using the App

## Demo Assets

This repository includes a sample complaint PDF for testing document extraction:

[demo-complaint.pdf](./demo-complaint.pdf)

The sample document contains a complaint for `Metformin hydrochloride API`, grade `IP/BP`, batch `MFH260712A`, with discoloration and foreign speck details.

### Chat Assistant

Use the chat panel to:

- Paste raw complaint text.
- Ask questions about the current complaint record.
- Correct fields using natural language.
- Upload complaint documents.

Examples:

```text
Customer reported discoloration in Metformin hydrochloride API grade IP/BP. Batch MFH260712A. Quantity affected 25 kg.
```

```text
Set the complaint date to today.
```

```text
Sorry, the product strength was 500 mg.
```

```text
What fields are still missing for QA triage?
```

The assistant returns a chat response and, when appropriate, form-field updates. The frontend applies those updates automatically.

### Demo Prompts

Use these prompts to test common flows:

```text
Customer reported discoloration in Metformin hydrochloride API grade IP/BP. Batch MFH260712A. Manufacturing date 2026-07-12. Expiry 2028-07. Quantity affected 25 kg. No injury reported.
```

```text
Set the complaint date to today.
```

```text
Sorry, the affected quantity was 40 kg.
```

```text
Change the batch number to MFH260712B.
```

```text
The product grade should be USP, not IP/BP.
```

```text
What QA information is missing before this can be saved?
```

```text
Does this require investigation or pharmacovigilance review?
```

### Document Upload

Click the upload icon in the chat header and choose a document.

Supported formats:

- `PDF`
- `DOCX`
- `TXT`
- `EML`

Maximum file size:

```text
10 MB
```

The backend extracts readable text from the document, sends it through the complaint extraction workflow, and returns structured complaint fields to populate the form.

Example fields the AI can extract:

- Product Name: `Metformin hydrochloride`
- Product Strength/Grade: `API grade IP/BP`
- Batch/Lot Number: `MFH260712A`
- Quantity Affected: `25 kg`
- Complaint Type: `Discoloration`
- Complaint Date
- Description
- Severity, priority, summary, and risk flags

## API Endpoints

Base path:

```text
/api
```

### Health

```http
GET /api/health
```

Returns:

```json
{ "status": "ok" }
```

### Extract from Text

```http
POST /api/ai/intake
Content-Type: application/json
```

Body:

```json
{
  "text": "Customer reported black particles in Ibuprofen 200mg tablets. Batch LOT-12345, expiry 12/2027."
}
```

### Extract from Document

```http
POST /api/ai/document
Content-Type: multipart/form-data
```

Form field:

```text
file=<PDF, DOCX, TXT, or EML>
```

Example:

```bash
curl -X POST http://localhost:8000/api/ai/document \
  -F file=@demo-complaint.pdf
```

### AI Chat

```http
POST /api/ai/chat
Content-Type: application/json
```

Body:

```json
{
  "question": "Make the strength 500 mg.",
  "complaint": {
    "product_name": "Ibuprofen",
    "product_strength_grade": "250mg"
  }
}
```

Response:

```json
{
  "answer": "Product strength grade updated to 500mg.",
  "updates": {
    "product_strength_grade": "500mg"
  }
}
```

### Complaints

```http
GET /api/complaints
POST /api/complaints
```

Saved complaints are persisted to PostgreSQL.

## Validation

Run frontend lint and build:

```bash
npm run lint
npm run build
```

Run a backend syntax check:

```bash
backend/.venv/bin/python -m compileall backend/app
```

Manual verification flow:

1. Start PostgreSQL, backend, and frontend.
2. Paste complaint text into chat and verify the form populates.
3. Upload a readable PDF/TXT/DOCX/EML and verify fields populate.
4. Ask a correction prompt, such as `make it 500 mg`, and verify the correct field updates.
5. Save the complaint and confirm no backend database error is logged.

## Deployment Notes

This repository currently includes a local `docker-compose.yml` for PostgreSQL only. It does not yet include production Dockerfiles for the frontend/backend application services.

For EasyPanel or another VPS deployment, use separate services:

- PostgreSQL database
- FastAPI backend on port `8000`
- Frontend static build served by a web server
- Reverse proxy routing:
  - `/` to the frontend
  - `/api` to the backend

Do not rely on the Vite development proxy in production. The Vite proxy only exists during `npm run dev`.

When deploying in Docker, `localhost` inside a container means that same container. Use the database service hostname in `DATABASE_URL`, for example:

```env
DATABASE_URL=postgresql+psycopg://user:password@db:5432/complaints_qms
FRONTEND_ORIGIN=https://your-domain.com
```

## Security and QMS Notes

- Keep secrets in `backend/.env`.
- Never commit `GROQ_API_KEY` or production database credentials.
- AI output is assistive only.
- QA users remain responsible for regulated decisions, triage, investigation, CAPA, recall, and pharmacovigilance routing.
- Review every AI-populated field before saving a complaint record.

## Common Issues

### Backend cannot connect to database

Check `DATABASE_URL`, PostgreSQL availability, and whether the hostname is correct for local or containerized execution.

### PDF upload fails

Make sure dependencies are installed:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

Scanned image-only PDFs may not contain extractable text. OCR is not implemented yet.

### Bad Gateway in deployment

Check that the reverse proxy points to the correct service and port. The backend listens on `8000`; the frontend dev server listens on `5173` only for local development.
