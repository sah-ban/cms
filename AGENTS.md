# Repository Guidelines

## Project Structure & Module Organization

This repository is a small full-stack QMS application. `backend/app/` contains the FastAPI service: `api/` for HTTP routes, `db/` for SQLAlchemy models and sessions, and `ai/` for LangGraph/Groq complaint extraction. `frontend/src/` contains the React and TypeScript UI; keep complaint state and types under `src/features/complaints/`. Root `docker-compose.yml` provides the local PostgreSQL service, and `README.md` contains product and setup context.

## Build, Test, and Development Commands

- `docker compose up -d db`: start the local PostgreSQL 16 database.
- `cd backend; python -m venv .venv; .venv\Scripts\Activate.ps1; pip install -r requirements.txt`: create and populate the backend environment on Windows.
- `cd backend; uvicorn app.main:app --reload --port 8000`: run the API locally with reload.
- `npm install --prefix frontend`: install frontend dependencies.
- `npm run dev`: run the Vite app through the root script at `http://localhost:5173`.
- `npm run build`: type-check and production-build the frontend.
- `npm run lint`: run ESLint against the frontend.

## Coding Style & Naming Conventions

Use 2 spaces in frontend TypeScript and TSX, and follow the existing ESLint and TypeScript configuration. Use PascalCase for React components and exported types, camelCase for functions, variables, and Redux selectors, and feature-oriented filenames. In Python, follow PEP 8 naming with 4-space indentation and snake_case. Keep FastAPI schemas, routes, AI workflow code, and persistence concerns separated by module.

## Testing Guidelines

There is currently no committed automated test suite or coverage threshold. Before opening a change, run `npm run lint` and `npm run build`, then manually verify the complaint intake and triage flow with the API and PostgreSQL running. If adding tests, use `test_*.py` for backend tests and `*.test.ts` or `*.test.tsx` for frontend tests, colocated with the code they cover.

## Commit & Pull Request Guidelines

Recent commits use short, imperative, sentence-style subjects, such as `Fix Groq AI JSON parsing and improve fallback extraction`. Keep commits focused and use the same style. Pull requests should explain the behavior change, list validation commands, link the relevant issue or task, and include screenshots for UI changes. Call out database, environment-variable, or API contract changes explicitly.

## Security & Configuration

Keep secrets in `backend/.env`; never commit `GROQ_API_KEY` or production database credentials. Update `backend/.env.example` when configuration changes. Treat AI extraction as assistive: QA users retain responsibility for regulated decisions.
