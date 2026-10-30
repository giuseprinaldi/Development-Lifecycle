// Fixture data for the mock API. Names, services, and proposals are invented.
// Replace freely; nothing here is referenced by id outside the mock.

import type { Role, Service, User } from '../../types'

export const FIXTURE_USERS: User[] = [
  {
    id: 'u-joe',
    username: 'GOLDLINK\\jrinaldi',
    displayName: 'Joe Rinaldi',
    email: 'joe.rinaldi@example.com',
    roles: ['project_manager', 'admin'],
    active: true,
  },
  {
    id: 'u-avery',
    username: 'GOLDLINK\\achen',
    displayName: 'Avery Chen',
    email: 'avery.chen@example.com',
    roles: ['tech_lead'],
    active: true,
  },
  {
    id: 'u-morgan',
    username: 'GOLDLINK\\mpatel',
    displayName: 'Morgan Patel',
    email: 'morgan.patel@example.com',
    roles: ['architecture_reviewer'],
    active: true,
  },
  {
    id: 'u-sam',
    username: 'GOLDLINK\\sokafor',
    displayName: 'Sam Okafor',
    email: 'sam.okafor@example.com',
    roles: ['proposal_owner', 'submitter'],
    active: true,
  },
  {
    id: 'u-riley',
    username: 'GOLDLINK\\rbrooks',
    displayName: 'Riley Brooks',
    email: 'riley.brooks@example.com',
    roles: ['submitter'],
    active: true,
  },
  {
    id: 'u-dana',
    username: 'EXT\\dwhitfield',
    displayName: 'Dana Whitfield',
    email: 'dana.whitfield@customer.example.com',
    roles: ['external_customer'],
    active: true,
  },
]

export const FIXTURE_SERVICES: Service[] = [
  { id: 'svc-reporting', name: 'Reporting Service', description: 'Scheduled and on-demand reports for operations.' },
  { id: 'svc-ingest', name: 'Ingest Pipeline', description: 'Batch and streaming ingest into the warehouse.' },
  { id: 'svc-portal', name: 'Operator Portal', description: 'Internal web portal for operators and analysts.' },
]

export const DEFAULT_REQUIRED_SIGNOFF: Role[] = [
  'proposal_owner',
  'project_manager',
  'tech_lead',
  'architecture_reviewer',
]
export const DEFAULT_OPTIONAL_SIGNOFF: Role[] = ['external_customer']

export const TICKET_READINESS_FIELDS = [
  'Benefit Hypothesis',
  'Business Value',
  'PI',
  'Project Code',
  'Task Code#',
  'Budget Hours',
  'Team',
]

/** A conforming proposal, used for PROP-0001 and as the model for others. */
export const PROPOSAL_RECONCILIATION = `# Software Proposal: Nightly Reconciliation Report

## Document Control
- Proposal Title: Nightly Reconciliation Report
- Proposal ID: PROP-0001
- Version: 1
- Status: In Review
- Author: Sam Okafor
- Proposal Owner: Sam Okafor
- Stakeholders: Operations lead, Finance analyst group, Reporting Service team
- Approval Authority: Digital Architecture Team signoff roles
- Date Created: 2026-10-20
- Last Updated: 2026-10-27
- Target System / Service / Product: Reporting Service
- Related Proposal / ADR / Iteration: ADR-014 (report scheduling)
- Related Carry-Forward Baseline (if any): None

---

## 1. Executive Summary
### Problem
Operations reconciles the previous day's shipment counts against the warehouse ledger by hand each morning. The comparison takes two analysts about ninety minutes and is skipped on roughly one morning in five.

### Proposed Change
Add a scheduled reconciliation job to the Reporting Service that compares shipment counts with ledger entries overnight and publishes a report of mismatches before the morning stand-up.

### Expected Outcome
Analysts start the day with a mismatch list instead of producing one. Manual reconciliation effort drops to reviewing exceptions only.

---

## 2. Business / Mission Context
- Business or mission driver: Reduce manual reconciliation effort and catch ledger mismatches the same day they occur.
- Who is impacted: Two operations analysts, the finance analyst group, and the on-call Reporting Service engineer.
- Why this matters now: Mismatches found late in the month have required rework of three invoicing runs this quarter.
- Expected value or improvement: About 30 analyst hours a month returned to exception handling; mismatches surfaced within 12 hours.

---

## 3. Current-State Summary
### Current State
Analysts export two spreadsheets from the warehouse and the shipment system, join them by shipment ID, and eyeball the differences.

### Pain Points
- The export formats change without notice and break the spreadsheet join.
- The comparison is skipped under time pressure.
- There is no record of which mismatches were investigated.

### Why the Current State Is Not Sufficient
The process depends on two people's availability and leaves no audit trail.

---

## 4. Proposed Scope
### In Scope
- Nightly job comparing shipment counts to ledger entries by shipment ID and date.
- Report of mismatches with counts, deltas, and links to source records.
- Delivery of the report to the existing Reporting Service distribution list.

### Out of Scope
- Automatic correction of ledger entries.
- Real-time or intraday reconciliation.
- Changes to the shipment system or warehouse schemas.

### Deferred / Future Consideration
- Trend view of mismatch counts over time.
- Self-service re-run from the Operator Portal.

---

## 5. Proposed Solution Overview
### Summary of the Approach
A scheduled task in the Reporting Service reads both sources through their existing read-only views, performs the comparison in SQL, and renders the result with the current report template engine.

### Affected Areas
- Services / applications: Reporting Service (new scheduled job and report template)
- Data sources / systems: Warehouse ledger view, shipment system read replica
- Users / operators: Operations analysts, finance analysts
- External or vendor systems: None
- Infrastructure / platform areas: Existing report scheduler; no new infrastructure

### Things Intentionally Unchanged
- Source schemas and access paths.
- The distribution list and delivery mechanism.

---

## 6. Goals and Success Outcomes
### Goals
- Publish the reconciliation report before 06:30 local on every business day.
- Record every mismatch with enough detail to investigate without re-running exports.

### Success Outcomes
- Manual reconciliation time falls from about 90 minutes to under 20 minutes a day within one month of release.
- Zero skipped reconciliation days in the first quarter after release.

### Non-Goals
- Replacing the finance team's month-end close process.

---

## 7. Constraints, Assumptions, and Dependencies
### Constraints
- Read-only access to both sources; no writes.
- The job runs inside the existing scheduler window (01:00 to 05:00).

### Assumptions
- Shipment ID is a stable join key across both systems.

### Dependencies
- Warehouse ledger view remains available with its current columns.
- Reporting Service template engine supports the new layout.

---

## 8. Risks and Unknowns
### Known Risks
- Source views change shape without notice, as the current exports do.
- Comparison volume on month-end days may exceed the scheduler window.

### Unknowns
- Whether shipment IDs are reused across years in the shipment system.

### Questions That Still Need Answers
- Who owns investigation of a mismatch once it is reported?

---

## 9. Initial Requirements / Expectations
Use plain, high-level statements. These do not need full implementation detail at proposal time.

| ID | Requirement / Expectation | Requirement Class | Notes |
|---|---|---|---|
| R-01 | The service shall compare shipment counts to ledger entries for the previous business day, keyed by shipment ID. | Shall | |
| R-02 | The service shall publish a mismatch report to the existing distribution list before 06:30 local time. | Shall | |
| R-03 | The service shall record each mismatch with both source values, the delta, and links to the source records. | Shall | |
| R-04 | The service should flag runs that exceed the scheduler window and notify the on-call engineer. | Should | |
| R-05 | The service should expose the last run status to the Operator Portal. | Should | Depends on portal API availability |

---

## 10. Open Notes / Unknowns (Optional)
### Decisions Still Needed
- Mismatch ownership (see section 8).

### Follow-Up Expected During Design or Review
- Confirm month-end volume against the scheduler window with a sample run.

---

## 11. Stakeholder Signoff
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Proposal Owner | Sam Okafor | Pending | | |
| Project Manager | | Pending | | |
| Tech Lead | | Pending | | |
| Architecture Reviewer | | Pending | | |
| External Customer (Optional) | | Optional | | |
`

/** A free-form document someone pasted in. Not in the template; the mock reformats it. */
export const PROPOSAL_ALERT_ROUTING_RAW = `Alert routing by on-call schedule

Right now every alert from the ingest pipeline goes to the whole team channel. At night that means six people get woken up for something one person needs to look at, and during the day it means the alerts get ignored because there are too many.

What I want: alerts should be routed to whoever is on call according to the schedule we already keep in the shared calendar. If the on-call person doesn't acknowledge within 15 minutes, it should escalate to the secondary. The service should keep a log of who was paged and when.

We should not change how alerts are generated, just where they go. Also not looking to replace the calendar with a paging product right now, though that might make sense later.

Risks: the calendar isn't always kept up to date. If it's wrong the alert goes to the wrong person.
`

/** The mock's reformatted version of the raw text above (what Stage 1 would produce). */
export const PROPOSAL_ALERT_ROUTING_V2 = `# Software Proposal: Alert routing by on-call schedule

## Document Control
- Proposal Title: Alert routing by on-call schedule
- Proposal ID: PROP-0002
- Version: 2
- Status: Draft
- Author: Riley Brooks
- Proposal Owner: Unresolved: not stated in the source
- Stakeholders: Ingest Pipeline team (inferred from source)
- Approval Authority: Digital Architecture Team signoff roles
- Date Created: 2026-10-24
- Last Updated: 2026-10-24
- Target System / Service / Product: Ingest Pipeline
- Related Proposal / ADR / Iteration: Unresolved
- Related Carry-Forward Baseline (if any): None

---

## 1. Executive Summary
### Problem
Every alert from the ingest pipeline goes to the whole team channel. At night six people are woken for something one person needs to handle; during the day alerts are ignored because there are too many.

### Proposed Change
Route alerts to the on-call person from the existing shared calendar schedule, escalate to the secondary after 15 minutes without acknowledgement, and log who was paged and when.

### Expected Outcome
Unresolved: the source does not state a measurable outcome.

---

## 2. Business / Mission Context
- Business or mission driver: Reduce unnecessary paging and alert fatigue.
- Who is impacted: Ingest Pipeline team members on the alert channel.
- Why this matters now: Unresolved: not stated in the source.
- Expected value or improvement: Unresolved: not quantified in the source.

---

## 3. Current-State Summary
### Current State
All ingest alerts post to a single team channel regardless of time or on-call assignment.

### Pain Points
- Night-time alerts wake the whole team.
- Daytime alerts are ignored due to volume.

### Why the Current State Is Not Sufficient
The channel has no notion of who is responsible, so alerts are either over-delivered or ignored.

---

## 4. Proposed Scope
### In Scope
- Routing alerts to the current on-call person from the shared calendar.
- Escalation to the secondary after 15 minutes without acknowledgement.
- A log of who was paged and when.

### Out of Scope
- Changes to how alerts are generated.
- Replacing the calendar with a paging product.

### Deferred / Future Consideration
- Adopting a paging product (source: "might make sense later").

---

## 5. Proposed Solution Overview
### Summary of the Approach
Unresolved: the source describes the desired behavior but not an approach.

### Affected Areas
- Services / applications: Ingest Pipeline alerting
- Data sources / systems: Shared on-call calendar
- Users / operators: Ingest Pipeline team
- External or vendor systems: Unresolved
- Infrastructure / platform areas: Unresolved

### Things Intentionally Unchanged
- Alert generation.

---

## 6. Goals and Success Outcomes
### Goals
- Alerts reach the responsible person first.

### Success Outcomes
- Unresolved: no measurable outcomes in the source.

### Non-Goals
- Replacing the shared calendar.

---

## 7. Constraints, Assumptions, and Dependencies
### Constraints
- Unresolved: none stated.

### Assumptions
- The shared calendar is the source of truth for on-call assignment.

### Dependencies
- Shared calendar remains readable by the service.

---

## 8. Risks and Unknowns
### Known Risks
- The calendar is not always kept up to date; a wrong entry routes the alert to the wrong person.

### Unknowns
- Unresolved: acknowledgement mechanism is not specified.

### Questions That Still Need Answers
- How does the on-call person acknowledge an alert?

---

## 9. Initial Requirements / Expectations
Use plain, high-level statements. These do not need full implementation detail at proposal time.

| ID | Requirement / Expectation | Requirement Class | Notes |
|---|---|---|---|
| R-01 | The service shall route each alert to the on-call person named in the shared calendar at the time of the alert. | Shall | |
| R-02 | The service shall escalate to the secondary on-call person when an alert is not acknowledged within 15 minutes. | Shall | Acknowledgement mechanism unresolved |
| R-03 | The service should keep a log of who was paged and when. | Should | Source wording: "should keep a log" |

---

## 10. Open Notes / Unknowns (Optional)
### Decisions Still Needed
- Acknowledgement mechanism.
- Proposal owner.

### Follow-Up Expected During Design or Review
- Measurable outcome for alert fatigue.

---

## 11. Stakeholder Signoff
| Role | Name | Decision | Date | Notes |
|---|---|---|---|---|
| Proposal Owner | | Pending | | |
| Project Manager | | Pending | | |
| Tech Lead | | Pending | | |
| Architecture Reviewer | | Pending | | |
| External Customer (Optional) | | Optional | | |
`

export const PROPOSAL_DARK_MODE = PROPOSAL_RECONCILIATION.replace(
  /# Software Proposal: Nightly Reconciliation Report[\s\S]*?## 1\. Executive Summary/,
  `# Software Proposal: Operator Portal dark mode

## Document Control
- Proposal Title: Operator Portal dark mode
- Proposal ID: PROP-0003
- Version: 1
- Status: Approved
- Author: Riley Brooks
- Proposal Owner: Sam Okafor
- Stakeholders: Operator Portal users, Portal team
- Approval Authority: Digital Architecture Team signoff roles
- Date Created: 2026-10-06
- Last Updated: 2026-10-15
- Target System / Service / Product: Operator Portal
- Related Proposal / ADR / Iteration: None
- Related Carry-Forward Baseline (if any): None

---

## 1. Executive Summary`,
)
  .replace(
    /### Problem\n[\s\S]*?### Proposed Change\n[\s\S]*?### Expected Outcome\n[\s\S]*?\n\n---/,
    `### Problem
Night-shift operators work in dim rooms and report eye strain from the portal's white background.

### Proposed Change
Add a dark theme to the Operator Portal, selectable per user and remembered across sessions.

### Expected Outcome
Operators can choose a theme suited to their environment; no other behavior changes.

---`,
  )
  .replace(/\| R-0[1-5] \|[^\n]*\n/g, '')
  .replace(
    '|---|---|---|---|\n',
    `|---|---|---|---|
| R-01 | The service shall offer a dark theme selectable from the user menu. | Shall | |
| R-02 | The service shall remember the selected theme across sessions for the signed-in user. | Shall | |
| R-03 | The service should meet the existing contrast guideline in both themes. | Should | |
`,
  )

export const PROPOSAL_SCHEMA_REGISTRY = PROPOSAL_RECONCILIATION.replace(
  /# Software Proposal: Nightly Reconciliation Report[\s\S]*?## 1\. Executive Summary/,
  `# Software Proposal: Ingest schema registry

## Document Control
- Proposal Title: Ingest schema registry
- Proposal ID: PROP-0004
- Version: 1
- Status: Draft
- Author: Sam Okafor
- Proposal Owner: Sam Okafor
- Stakeholders: Ingest Pipeline team, downstream report owners
- Approval Authority: Digital Architecture Team signoff roles
- Date Created: 2026-10-28
- Last Updated: 2026-10-28
- Target System / Service / Product: Ingest Pipeline
- Related Proposal / ADR / Iteration: None
- Related Carry-Forward Baseline (if any): None

---

## 1. Executive Summary`,
)
  .replace(
    /### Problem\n[\s\S]*?### Proposed Change\n[\s\S]*?### Expected Outcome\n[\s\S]*?\n\n---/,
    `### Problem
Upstream feeds change column names and types without warning, and downstream reports break hours later.

### Proposed Change
Register the expected schema for each feed and validate incoming batches against it before load, quarantining batches that do not match.

### Expected Outcome
Schema drift is caught at ingest with a clear message, not discovered in a broken report.

---`,
  )
  .replace(/\| R-0[1-5] \|[^\n]*\n/g, '')
  .replace(
    '|---|---|---|---|\n',
    `|---|---|---|---|
| R-01 | The service shall validate every incoming batch against the registered schema for its feed before load. | Shall | |
| R-02 | The service shall quarantine a batch that fails validation and record the mismatch. | Shall | |
| R-03 | The service should notify the feed owner when a batch is quarantined. | Should | |
`,
  )

/** Mock checklist. Replace with the team's proposal-review-checklist.md when wiring the real Stage 2. */
export const CHECKLIST_VERSION = 'mock-checklist v1'

export interface ChecklistItem {
  section: string
  check: string
}

export const CHECKLIST: ChecklistItem[] = [
  { section: 'Core Completeness', check: 'Document Control is present with title, author, and target system' },
  { section: 'Core Completeness', check: 'Problem statement is present and specific' },
  { section: 'Core Completeness', check: 'Proposed change is stated in plain language' },
  { section: 'Core Completeness', check: 'Expected outcome is stated' },
  { section: 'Core Completeness', check: 'Business or mission driver is stated' },
  { section: 'Scope Quality', check: 'In-scope items are listed' },
  { section: 'Scope Quality', check: 'Out-of-scope items are listed' },
  { section: 'Scope Quality', check: 'Deferred items are separated from out-of-scope items' },
  { section: 'Scope Quality', check: 'Scope boundaries are consistent with the problem statement' },
  { section: 'Solution Framing', check: 'Approach is described at a high level without implementation detail' },
  { section: 'Solution Framing', check: 'Affected areas are identified' },
  { section: 'Solution Framing', check: 'Things intentionally unchanged are stated' },
  { section: 'Solution Framing', check: 'Approach stays within the stated scope' },
  { section: 'Goals and Outcomes', check: 'Goals are listed' },
  { section: 'Goals and Outcomes', check: 'Success outcomes are measurable or observable' },
  { section: 'Goals and Outcomes', check: 'Non-goals are listed' },
  { section: 'Goals and Outcomes', check: 'Outcomes follow from the problem statement' },
  { section: 'Constraints, Risks, and Unknowns', check: 'Constraints are listed' },
  { section: 'Constraints, Risks, and Unknowns', check: 'Assumptions are listed' },
  { section: 'Constraints, Risks, and Unknowns', check: 'Dependencies are listed' },
  { section: 'Constraints, Risks, and Unknowns', check: 'Known risks are specific, or "none identified" is stated' },
  { section: 'Constraints, Risks, and Unknowns', check: 'Unknowns and open questions are visible rather than hidden' },
  { section: 'Initial Requirements', check: 'At least one requirement is present in the section 9 table' },
  { section: 'Initial Requirements', check: 'Requirements use "shall" or "should" wording only' },
  { section: 'Initial Requirements', check: 'Every requirement has an ID and a class' },
  { section: 'Initial Requirements', check: 'Requirements are traceable to in-scope items' },
  { section: 'Initial Requirements', check: 'Requirements are high-level, not implementation detail' },
  { section: 'Approval Readiness', check: 'Stakeholders are named' },
  { section: 'Approval Readiness', check: 'Approval authority is named' },
  { section: 'Approval Readiness', check: 'Signoff table is present with the required roles' },
  { section: 'Approval Readiness', check: 'Proposal owner is named' },
  { section: 'Approval Readiness', check: 'Ticket-readiness fields are available or planned for the approval gate' },
  { section: 'Approval Readiness', check: 'No section is left as unmodified template placeholder text' },
]
