# Development Lifecycle: Proposal Pipeline

A web application that runs the Digital Architecture Team's proposal-to-implementation workflow: proposal intake and reformatting, AI review against the team checklist, human signoff, delivery planning into Jira, GitLab merge-request alignment review and adjudication, and the carry-forward baseline for the next feature set.

The full specification is in [`docs/spec.md`](docs/spec.md). Start there.

## What is in this repository today

| Path | Status | What it is |
| --- | --- | --- |
| `docs/spec.md` | Done (draft v0.1) | Specification and build plan: workflow, architecture, data model, integrations, AI contracts, phases |
| `docs/api-contract.md` | Done | Every route the frontend calls, for the backend to implement |
| `docs/build/phase-0.md`, `phase-1.md` | Done | Build prompts for Devin, one per phase |
| `frontend/` | Built, Phase 1 scope | React + TypeScript app. Runs standalone against an in-browser mock API with fixture data; switch to the real backend with one env var |
| `backend/` | Not started | FastAPI + SQLAlchemy + Alembic (Phase 0) |
| `worker/` | Not started | Job runner that invokes Devin CLI, Jira, GitLab (Phase 0) |
| `deploy/windows/` | Not started | IIS `web.config`, PowerShell install scripts, Scheduled Task registration, backup (Phase 0) |
| `ai_bundle/v1/.devin/` | Empty | Drop the team's skill bundle here (skills and workflow templates) |

## Run the frontend now

Requires Node 20 or later.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. It starts in **mock mode**: four fixture proposals in different states, six fixture users, and simulated AI stages that take a few seconds so you can watch a proposal move. Use the user picker in the header to act as each role (submitter, signoff roles, admin). "Reset data" restores the fixtures.

Try the Phase 1 flow end to end:

1. New proposal → paste a paragraph of plain text → Create. The template check says it is nonconforming; Stage 1 reformats it.
2. On the proposal, read the generated draft, confirm it, then Submit for review.
3. Watch Stage 2 run; open the Review tab for the scorecard, gaps, and conditions.
4. If it is Returned, edit the draft (every save is a new version), resubmit, and see the re-review mark prior gaps addressed or still open.
5. Switch users to each required signoff role and record decisions. The signoff rule moves it to Approved, Returned, or Rejected.

Checks: `npm run typecheck`, `npm test`, `npm run build`.

To use a real backend: copy `frontend/.env.example` to `frontend/.env`, set `VITE_API_MODE=live`, and run FastAPI on `127.0.0.1:8000` (the Vite dev server proxies `/api`). In production IIS serves `frontend/dist` and does the proxying.

## Next steps

1. Verify the four assumptions in spec section 12, especially that the VM can run Devin CLI.
2. Run `docs/build/phase-0.md` with Devin to build the backend foundations, worker, and Windows deployment scripts.
3. Run `docs/build/phase-1.md` to build the backend for intake through signoff and switch the frontend to live mode.
4. Phases 2 to 5 (Jira planning, alignment and adjudication, carry-forward, hardening) are scoped in spec section 9; their prompts are written after Phase 1 ships.

## Layout

```
/frontend            React + TypeScript + Vite (built)
/backend             FastAPI app, Alembic migrations, tests (Phase 0)
/worker              Worker entrypoint (Phase 0)
/deploy/windows      web.config, Install-IIS.ps1, Register-Api.ps1, Register-Worker.ps1, Backup-Db.ps1 (Phase 0)
/ai_bundle/v1/.devin Skill bundle: skills/ and workflow/templates/ (copy from the team)
/docs                spec.md, api-contract.md, build/
```
