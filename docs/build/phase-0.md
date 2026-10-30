NOTE FOR THIS REPOSITORY: the frontend already exists in /frontend (React 19, TypeScript, Vite, TanStack Query, React Router) with a mock API and tests. Do not scaffold or replace it. Deliverable 6 (frontend shell) is done. Your frontend work in this phase is limited to: keep `npm run build` green, and make `/api/me` from the real backend satisfy `frontend/src/api/live.ts`. Read docs/api-contract.md.

You are building Phase 0 (foundations) of an internal web application called Proposal Pipeline. Read docs/spec.md first; it is the source of truth. Build only what this prompt lists. Do not build features from later phases.

## Target environment
- Windows Server VM, domain-joined, IIS in front. Python 3.12. Node 20 LTS. PostgreSQL 16.
- Write Windows-compatible paths and scripts (PowerShell, not bash). Do not assume systemd, cron, or a Unix shell.
- Development happens on a machine without IIS; provide the dev mode specified below.

## Stack (fixed; do not substitute)
- Backend: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, psycopg 3, uvicorn. requirements.txt pinned to exact versions.
- Frontend: React 18, TypeScript, Vite, React Router, TanStack Query. A light component library is allowed (Radix or Mantine). Build output is static files.
- Worker: a separate Python entrypoint that imports the backend package.
- Tests: pytest (backend), Vitest (frontend).

## Repository layout
/backend/app  (api, models, schemas, services, jobs)
/backend/alembic
/backend/tests
/frontend
/worker  (entrypoint only)
/deploy/windows  (web.config, Install-IIS.ps1, Register-Api.ps1, Register-Worker.ps1, Backup-Db.ps1)
/ai_bundle/v1/.devin  (placeholder README; the team drops the skill bundle here)
/docs  (spec.md, build/)

## Deliverables
1. Schema v1 as an Alembic migration: users, roles, user_roles, services, feature_sets, proposals, proposal_versions, requirements, reviews, review_checks, conditions, signoffs, jobs, audit_log, app_config. Columns per docs/spec.md section 5. Indexes on every foreign key and on jobs(state, created_at).
2. Authentication middleware. Read X-Remote-User. In APP_ENV=production, trust it only when the request comes from 127.0.0.1. In APP_ENV=development with DEV_FAKE_USER set, use that username. In APP_ENV=production with DEV_FAKE_USER set, refuse to start with a clear error. Auto-create a users row on first sight. GET /api/me returns username, display_name, roles.
3. Role management. Admin-only endpoints to list users and assign or remove roles. Seed the first admin from INITIAL_ADMIN on first migration.
4. Job queue. Worker loop claims with SELECT ... FOR UPDATE SKIP LOCKED, dispatches by type from a handler registry, records state, attempts, log_text, result_json, and timings. Implement one handler, noop. Graceful shutdown on Ctrl-C and on the Windows stop signal.
5. Devin runner. A function run_stage(job_dir, prompt, model, permission_mode, timeout_s) that invokes `devin -p "<prompt>" --permission-mode <mode> --model <model> --respect-workspace-trust false` with cwd=job_dir, captures stdout, stderr, and exit code, enforces the timeout, and returns a result object. DEVIN_BIN sets the executable path. Implement a hello_stage handler: write inputs/hello.txt, ask Devin to write out/result.json as {"ok": true, "echo": "<file contents>"}, validate with Pydantic, store the result.
6. Frontend shell. Layout, header showing the signed-in user and roles, empty Proposals and Admin pages. Calls /api/me on load.
7. Deployment scripts in /deploy/windows:
   - web.config: static files from /frontend/dist; rewrite /api/* to http://127.0.0.1:8000; set X-Remote-User from LOGON_USER; remove any inbound X-Remote-User; Windows Authentication required, Anonymous disabled.
   - Install-IIS.ps1: enable Web-Server and Web-Windows-Auth; check for URL Rewrite and ARR and print install instructions if missing; create the app pool and site.
   - Register-Api.ps1 and Register-Worker.ps1: register Scheduled Tasks that run at startup under a given service account and restart on failure.
   - Backup-Db.ps1: pg_dump to a dated file in a configured folder; delete files older than 30 days.
8. README.md: local dev setup (Postgres, env vars, alembic upgrade, run API, run worker, run frontend) and production install steps in order.

## Configuration (environment variables; document each in .env.example with placeholders)
APP_ENV, DATABASE_URL, DEV_FAKE_USER, INITIAL_ADMIN, DEVIN_BIN, DEVIN_MODEL_DEFAULT, JOB_POLL_SECONDS, STAGE_TIMEOUT_SECONDS.

## Acceptance tests (write them; all must pass)
- Alembic upgrade from an empty database succeeds; downgrade to base succeeds.
- APP_ENV=development, DEV_FAKE_USER=GOLDLINK\\test: GET /api/me returns that user and creates the row.
- APP_ENV=production with DEV_FAKE_USER set: startup exits non-zero with a clear message.
- APP_ENV=production: a request with X-Remote-User from a non-loopback address is rejected with 401.
- A noop job is claimed and marked succeeded within two poll intervals.
- The runner handles a missing executable and a timeout without crashing the worker; the job is marked failed with the reason.
- hello_stage succeeds when DEVIN_BIN points at a stub script that writes the expected result.json. Provide the stub for CI; the real CLI is used manually on the VM.
- Frontend builds without warnings and renders the username from /api/me.

## Rules
- No secrets in the repository. Tokens appear only in .env.example as placeholders.
- Every endpoint has Pydantic request and response models.
- Every role change writes an audit_log row.
- Small typed functions; docstrings where behavior is not obvious.
- If this prompt conflicts with docs/spec.md, follow the spec and record the conflict in docs/build/phase-0-notes.md.
- When finished, write docs/build/phase-0-notes.md: what was built, how to run it, what you could not verify on this machine (IIS, Scheduled Tasks, the real Devin CLI), and the exact manual steps to verify those on the VM.
