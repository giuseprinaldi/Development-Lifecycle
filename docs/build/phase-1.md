NOTE FOR THIS REPOSITORY: the frontend for this phase already exists in /frontend, built against a mock API (`frontend/src/api/mock`). The route list and shapes it expects are in docs/api-contract.md and `frontend/src/api/live.ts`. Build the backend to that contract; change the frontend only where the contract has to change, and update both. The Frontend section below describes what is already built, so treat it as acceptance criteria to verify against the live backend (set VITE_API_MODE=live), not as work to do.

You are building Phase 1 (intake to signoff) of Proposal Pipeline. Phase 0 is complete; do not rebuild or restructure it. Read docs/spec.md sections 2, 3, 5, 7, and 8, and read the proposal template and review checklist in ai_bundle/v1/.devin/workflow/templates/ before starting.

Scope: a proposal moves from Draft through In Review, Returned, and Awaiting Signoff to Approved or Rejected. No planning, Jira, GitLab, or alignment work in this phase.

## Backend

1. Proposal creation
   - POST /api/proposals with service_id, title, and either markdown text or an uploaded .md, .txt, or .docx file (convert .docx with mammoth; keep the original bytes). Create the proposal with a sequential code PROP-0001, version 1 with source=uploaded, state=Draft.
   - Conformance check: parse the markdown for the Document Control block and the eleven numbered "## N. Heading" sections of the proposal template. Parse the section 9 table into requirement rows (ID, text, class, notes). Store parsed_json with sections_found, sections_missing, and requirements. Conforming means every section is present and the requirements table parses with at least one row.
   - Nonconforming: enqueue run_stage with stage=reformat_proposal. Conforming: no AI run; the draft is submittable immediately.

2. Stage 1 handler (reformat_proposal)
   - Job directory: copy the active bundle's .devin folder; write inputs/original.md; write schema.json for Stage1Result.
   - Prompt: run the generate-proposal skill. Tell it to derive the problem statement and scope from inputs/original.md, to preserve the author's content, to leave anything missing visible as unresolved rather than inventing it, and to write the proposal to out/proposal.md. Also write out/result.json matching schema.json with requirements[], sections_missing[], unresolved[].
   - On success: create version 2 with source=generated, parsed from out/proposal.md. Create requirement rows from the table with their IDs. State stays Draft; set needs_confirmation=true.

3. Draft editing and confirmation
   - PUT /api/proposals/{id}/draft with markdown: create a new version with source=edited and re-parse. Link requirements by ID: same ID is the same row, a missing ID is marked removed, a new ID is added. Never renumber.
   - POST /api/proposals/{id}/submit: requires a conforming current version. State to In Review. Enqueue run_stage with stage=review_proposal. Audit row.

4. Stage 2 handler (review_proposal)
   - Inputs: inputs/proposal.md; inputs/approval-expectations.md generated from app_config listing the ticket-readiness fields (Benefit Hypothesis, Business Value, PI, Project Code, Task Code#, Budget Hours, Team); in re-review mode also inputs/prior-review.md and inputs/prior-review.json.
   - Prompt: run the review-proposal skill with those paths; output to out/<stem>-review.md; also write out/result.json matching Stage2Result.
   - Validate. Apply the recommendation rule from spec section 8. If the model's recommendation differs, store both and use the computed one; log the disagreement.
   - Create the reviews row, review_checks rows, and conditions rows. State to Returned on Needs revision, otherwise Awaiting Signoff. Audit row.

5. Signoff
   - Required roles per proposal default from app_config (proposal_owner, project_manager, tech_lead, architecture_reviewer); external_customer optional. Admin can edit the set per proposal.
   - POST /api/proposals/{id}/signoff: the caller must hold one of the required or optional roles for that proposal. decision in {approve, approve_with_conditions, return, reject}; notes required for return and reject. One decision per role per version; a later decision by the same role replaces the earlier one while the state is still Awaiting Signoff.
   - Rule: any reject from a required role sets Rejected (terminal); any return sets Returned; when every required role has approve or approve_with_conditions, set Approved. Optional roles are recorded but never block. Audit rows.

6. Conditions: GET per proposal; PATCH status (open, resolved, carried) by tech_lead, project_manager, or admin; resolved requires a note.

7. Versions: list versions; fetch one version's markdown; unified diff between two versions.

8. Resubmit after Returned: PUT draft then POST submit. The review job runs in re-review mode with the latest review attached.

## Frontend
- Proposals list: filter by state and service; columns code, title, state, last activity, waiting on.
- New proposal: service picker, title, paste or upload; shows the conformance result; shows job progress while reformatting.
- Draft page: markdown editor with side-by-side preview; a banner "Review the reformatted draft before submitting" when needs_confirmation; Submit disabled until conforming, with the missing sections listed.
- Review page: checks grouped by the seven checklist sections with status chips and notes; strengths; gaps; conditions table; recommendation and rationale; model and bundle version in the footer. For a re-review, show prior gaps with addressed or still open.
- Signoff page: table of roles with decision, name, date, notes; the signed-in user's decision form when they hold a role for this proposal; the full proposal rendered below; conditions listed.
- Version history with diff.
- A "Waiting on me" view for signoff roles.

## Acceptance tests
- Uploading a conforming proposal creates version 1, enqueues no job, and the draft is submittable.
- Uploading a nonconforming proposal enqueues reformat_proposal; with the Devin stub returning the fixture proposal.md and result.json, version 2 is created with source=generated, requirements are parsed, and needs_confirmation is true.
- Editing the draft creates a new version; a requirement with the same ID is linked, a removed ID is marked removed, a new ID is added.
- Submit on a nonconforming version returns 400 listing the missing sections.
- Submit enqueues review_proposal. With a stub result containing one No in Core Completeness and a stated recommendation of Approve, the computed recommendation is Needs revision, the state is Returned, and the disagreement is logged.
- With a stub result of all Yes and Partial, the state is Awaiting Signoff and one condition row exists per Partial.
- Signoff: a user without a role on the proposal gets 403; a return moves to Returned; a reject moves to Rejected and further signoffs are refused; approvals from all required roles move to Approved; an optional External Customer decision does not block.
- Every state change has an audit_log row with actor and before and after state.
- The Phase 0 dev-mode guard still passes.
- Frontend: the signoff form is hidden for users without a role on the proposal; Submit is disabled while nonconforming.

## Fixtures
Create tests/fixtures with one conforming proposal, one nonconforming proposal, one Stage 1 stub output, and three Stage 2 stub outputs (needs revision, approve with conditions, approve).

## Rules
Same as Phase 0. When finished, write docs/build/phase-1-notes.md including the exact prompt strings sent to Devin for each stage, so they can be reviewed and tuned without reading code.
