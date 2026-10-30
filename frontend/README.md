# frontend

React 19 + TypeScript + Vite. React Router for pages, TanStack Query for data, `react-markdown` for proposal rendering, `diff` for version comparison. No UI framework; one stylesheet in `src/index.css`.

## Modes

`VITE_API_MODE` in `.env` (copy from `.env.example`):

- `mock` (default): `src/api/mock/` keeps state in memory and in `localStorage`, seeds fixture users, services, and proposals, and simulates Stage 1 (reformat) and Stage 2 (review) with timers. The reviewer is rule-based so results are deterministic. Nothing leaves the browser.
- `live`: `src/api/live.ts` calls `/api/*`. The Vite dev server proxies to `http://127.0.0.1:8000`; in production IIS does it. Route list: `docs/api-contract.md`.

Both implement the same `ApiClient` interface in `src/api/types.ts`, so pages do not know which is active.

## Layout

```
src/types.ts              domain types and enums (mirror the backend's Pydantic models)
src/api/                  ApiClient interface, live client, mock client + fixtures + mock reviewer
src/lib/template.ts       proposal template sections, conformance parser, requirements table parser
src/lib/rules.ts          recommendation rule, signoff rule, state helpers (spec sections 7 and 8)
src/hooks/queries.ts      TanStack Query hooks
src/components/           layout, shared chips, and the proposal detail tabs
src/pages/                Proposals list, New proposal, Proposal detail, Waiting on me, Admin
```

## Scripts

```
npm run dev        start on http://localhost:5173
npm run typecheck  tsc
npm test           vitest (parser, reformatter, reviewer, rules)
npm run lint       oxlint
npm run build      production build to dist/
```

## Notes for the backend build

- `src/lib/template.ts` and `src/lib/rules.ts` duplicate backend logic on purpose, so the UI can preview conformance and outcomes. The backend is authoritative. If they drift, add a `parse` endpoint and delete the frontend copy.
- The detail page polls `GET /api/proposals/{id}` every 1.5 s while a job is queued or running. Keep that endpoint cheap.
- `.docx` upload is read client-side only as text in mock mode; live mode should post the file for server-side conversion (see the contract).
