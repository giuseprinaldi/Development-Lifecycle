# API contract (Phase 1)

The frontend in `/frontend` was built first, against a mock. This file lists every route it calls so the FastAPI backend can be built to match. Shapes are the TypeScript types in `frontend/src/types.ts`; the backend's Pydantic models should mirror them (camelCase in JSON, as the frontend expects).

Authentication: none in the app. IIS performs Windows Authentication and forwards `X-Remote-User: DOMAIN\user`. The backend trusts that header only from loopback in production (spec section 4).

Errors: non-2xx with a JSON body `{ "detail": "<message>" }`. The frontend shows `detail` verbatim.

| Method | Route | Request | Response | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/me` | – | `User` | Creates the user row on first sight |
| GET | `/api/admin/users` | – | `User[]` | admin only |
| PUT | `/api/admin/users/{userId}/roles` | `{ roles: Role[] }` | `User` | admin only; audit row |
| GET | `/api/services` | – | `Service[]` | |
| GET | `/api/proposals` | query `state?`, `service_id?`, `mine?=true` | `ProposalListItem[]` | newest `updatedAt` first |
| GET | `/api/proposals/{id}` | – | `ProposalDetail` | `id` may be the code (PROP-0001) or the uuid |
| POST | `/api/proposals` | `CreateProposalInput` (`serviceId`, `title`, `markdown`, `fileName?`) | `ProposalDetail` | JSON with text. For `.docx`, add a multipart variant that converts server-side (mammoth) and have the frontend post the file when `fileName` ends in `.docx` |
| PUT | `/api/proposals/{id}/draft` | `{ markdown }` | `ProposalDetail` | New version, source=edited; requirement rows reconciled by ID |
| POST | `/api/proposals/{id}/confirm-draft` | `{}` | `ProposalDetail` | Clears `needsConfirmation` |
| POST | `/api/proposals/{id}/submit` | `{}` | `ProposalDetail` | 400 with missing sections if nonconforming; enqueues `review_proposal` |
| POST | `/api/proposals/{id}/signoff` | `SignoffInput` (`decision`, `notes`) | `ProposalDetail` | 403 without a signoff role; notes required for return/reject |
| PUT | `/api/proposals/{id}/signoff-roles` | `{ required: Role[], optional: Role[] }` | `ProposalDetail` | admin only |
| PATCH | `/api/conditions/{conditionId}` | `{ status, note }` | `Condition` | tech_lead, project_manager, admin |
| GET | `/api/jobs/{id}` | – | `Job` | |
| POST | `/api/jobs/{id}/retry` | `{}` | `Job` | failed jobs only |

## `ProposalDetail`

One call returns everything the detail page needs, so the page can poll it while a job runs:

```
{
  proposal, service,
  versions[], requirements[], reviews[], checks[], conditions[], signoffs[], jobs[], audit[]
}
```

`proposal.waitingOn` is a display string the backend computes (role labels, "submitter", "review job", "planning (Phase 2)").

## Enums the backend must enforce

- `ProposalState`: Draft, In Review, Returned, Awaiting Signoff, Rejected, Approved, Planning, In Development, Alignment Review, Adjudication, Closing, Closed
- `Role`: submitter, proposal_owner, project_manager, tech_lead, architecture_reviewer, external_customer, admin
- `CheckStatus`: Yes, Partial, No, N/A
- `Recommendation`: Approve, Approve with conditions, Needs revision
- `SignoffDecision`: approve, approve_with_conditions, return, reject
- `VersionSource`: uploaded, generated, edited
- `ConditionStatus`: open, resolved, carried
- `JobState`: queued, running, succeeded, failed
- `JobType`: reformat_proposal, review_proposal

## Rules the backend applies (frontend only previews them)

- Recommendation rule: spec section 8. The frontend's copy is `frontend/src/lib/rules.ts: computeRecommendation`.
- Signoff rule: spec section 7. `computeSignoffOutcome` in the same file.
- Template conformance and requirements parsing: `frontend/src/lib/template.ts`. The backend's parser is authoritative; keep both in step or expose a `POST /api/proposals/parse` endpoint and have the frontend call it instead.
