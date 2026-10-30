// Proposal template knowledge: section list, conformance parser, and the
// section-9 requirements table parser.
//
// The backend owns the authoritative parser (spec section 5, "Rules the schema
// enforces"). This copy drives the mock API and the live preview in the draft
// editor, so a submitter sees the same missing-section list the server will
// report. Keep the two in step.

import type { ParsedProposal, ParsedRequirement, RequirementClass } from '../types'

export const TEMPLATE_VERSION = 'proposal-template v1'

export interface TemplateSection {
  number: number
  heading: string
  required: boolean
}

export const TEMPLATE_SECTIONS: TemplateSection[] = [
  { number: 1, heading: 'Executive Summary', required: true },
  { number: 2, heading: 'Business / Mission Context', required: true },
  { number: 3, heading: 'Current-State Summary', required: true },
  { number: 4, heading: 'Proposed Scope', required: true },
  { number: 5, heading: 'Proposed Solution Overview', required: true },
  { number: 6, heading: 'Goals and Success Outcomes', required: true },
  { number: 7, heading: 'Constraints, Assumptions, and Dependencies', required: true },
  { number: 8, heading: 'Risks and Unknowns', required: true },
  { number: 9, heading: 'Initial Requirements / Expectations', required: true },
  { number: 10, heading: 'Open Notes / Unknowns (Optional)', required: false },
  { number: 11, heading: 'Stakeholder Signoff', required: true },
]

export const DOCUMENT_CONTROL_HEADING = 'Document Control'

const NUMBERED_HEADING = /^##\s+(\d+)\.\s+(.+?)\s*$/
const PLAIN_HEADING = /^##\s+(.+?)\s*$/
const DOC_CONTROL_LINE = /^-\s+([^:]+):\s*(.*)$/
const REQ_ID = /^R-\d+$/i

interface Section {
  number: number | null
  heading: string
  lines: string[]
}

function splitSections(markdown: string): Section[] {
  const sections: Section[] = []
  let current: Section | null = null
  for (const raw of markdown.split(/\r?\n/)) {
    const numbered = raw.match(NUMBERED_HEADING)
    const plain = numbered ? null : raw.match(PLAIN_HEADING)
    if (numbered) {
      current = { number: Number(numbered[1]), heading: numbered[2], lines: [] }
      sections.push(current)
    } else if (plain) {
      current = { number: null, heading: plain[1], lines: [] }
      sections.push(current)
    } else if (current) {
      current.lines.push(raw)
    }
  }
  return sections
}

function inferClass(text: string): RequirementClass | null {
  const t = text.toLowerCase()
  if (/\bshall\b/.test(t)) return 'Shall'
  if (/\bshould\b/.test(t)) return 'Should'
  return null
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((c) => c.trim())
}

export function parseRequirementsTable(lines: string[]): {
  requirements: ParsedRequirement[]
  problems: string[]
} {
  const requirements: ParsedRequirement[] = []
  const problems: string[] = []
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue
    const cells = splitRow(line)
    if (cells.length < 2) continue
    const [id, text = '', cls = '', notes = ''] = cells
    if (!REQ_ID.test(id)) continue
    if (!text) continue
    const declared = cls.toLowerCase() === 'shall' ? 'Shall' : cls.toLowerCase() === 'should' ? 'Should' : null
    const inferred = inferClass(text)
    const finalClass = declared ?? inferred
    if (declared && inferred && declared !== inferred) {
      problems.push(`${id}: class column says ${declared} but the text reads as ${inferred}.`)
    }
    if (/\b(must|may)\b/i.test(text)) {
      problems.push(`${id}: uses "must" or "may"; the template allows only "shall" and "should" in this table.`)
    }
    if (!finalClass) {
      problems.push(`${id}: no requirement class and the text has neither "shall" nor "should".`)
    }
    requirements.push({ reqId: id.toUpperCase(), text, cls: finalClass, notes })
  }
  return { requirements, problems }
}

export function parseProposal(markdown: string): ParsedProposal {
  const sections = splitSections(markdown)
  const byNumber = new Map<number, Section>()
  for (const s of sections) if (s.number !== null && !byNumber.has(s.number)) byNumber.set(s.number, s)

  const docControlSection = sections.find(
    (s) => s.number === null && s.heading.toLowerCase() === DOCUMENT_CONTROL_HEADING.toLowerCase(),
  )
  const documentControl: Record<string, string> = {}
  if (docControlSection) {
    for (const line of docControlSection.lines) {
      const m = line.match(DOC_CONTROL_LINE)
      if (m) documentControl[m[1].trim()] = m[2].trim()
    }
  }

  const sectionsFound: string[] = []
  const sectionsMissing: string[] = []
  if (docControlSection) sectionsFound.push(DOCUMENT_CONTROL_HEADING)
  else sectionsMissing.push(DOCUMENT_CONTROL_HEADING)
  for (const t of TEMPLATE_SECTIONS) {
    const label = `${t.number}. ${t.heading}`
    if (byNumber.has(t.number)) sectionsFound.push(label)
    else if (t.required) sectionsMissing.push(label)
  }

  const reqSection = byNumber.get(9)
  const { requirements, problems } = reqSection
    ? parseRequirementsTable(reqSection.lines)
    : { requirements: [], problems: [] }
  if (reqSection && requirements.length === 0) {
    problems.push('Section 9 has no requirement rows (expected rows like "| R-01 | The service shall ... | Shall | |").')
  }

  const conforming = sectionsMissing.length === 0 && requirements.length > 0
  return { conforming, sectionsFound, sectionsMissing, documentControl, requirements, problems }
}

/** Section bodies by number, for the mock review heuristics. */
export function sectionBodies(markdown: string): Map<number, string> {
  const out = new Map<number, string>()
  for (const s of splitSections(markdown)) {
    if (s.number !== null) out.set(s.number, s.lines.join('\n').trim())
  }
  return out
}

/** True when a section body has nothing beyond template placeholders. */
export function isEffectivelyEmpty(body: string | undefined): boolean {
  if (!body) return true
  const meaningful = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^#{1,6}\s/.test(l) &&
        !/^-+\s*$/.test(l) &&
        !/^-\s*[^:]+:\s*$/.test(l) &&
        !/^(describe|state|explain|use) /i.test(l),
    )
  return meaningful.length === 0
}

/** Blank template, used by the mock reformatter and the "start from template" button. */
export function blankTemplate(title: string, author: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `# Software Proposal: ${title}

## Document Control
- Proposal Title: ${title}
- Proposal ID:
- Version: 1
- Status: Draft
- Author: ${author}
- Proposal Owner:
- Stakeholders:
- Approval Authority:
- Date Created: ${today}
- Last Updated: ${today}
- Target System / Service / Product:
- Related Proposal / ADR / Iteration:
- Related Carry-Forward Baseline (if any):

---

## 1. Executive Summary
### Problem
Describe the problem this proposal is trying to solve.

### Proposed Change
Describe the proposed change in plain language.

### Expected Outcome
State what success should look like if this proposal is approved and completed.

---

## 2. Business / Mission Context
- Business or mission driver:
- Who is impacted:
- Why this matters now:
- Expected value or improvement:

---

## 3. Current-State Summary
### Current State
Describe the current process, system, capability, or limitation.

### Pain Points
-
-

### Why the Current State Is Not Sufficient
Explain why a change is needed.

---

## 4. Proposed Scope
### In Scope
-
-

### Out of Scope
-
-

### Deferred / Future Consideration
-

---

## 5. Proposed Solution Overview
### Summary of the Approach
Describe the intended solution at a high level.

### Affected Areas
- Services / applications:
- Data sources / systems:
- Users / operators:
- External or vendor systems:
- Infrastructure / platform areas:

### Things Intentionally Unchanged
-

---

## 6. Goals and Success Outcomes
### Goals
-

### Success Outcomes
-

### Non-Goals
-

---

## 7. Constraints, Assumptions, and Dependencies
### Constraints
-

### Assumptions
-

### Dependencies
-

---

## 8. Risks and Unknowns
### Known Risks
-

### Unknowns
-

### Questions That Still Need Answers
-

---

## 9. Initial Requirements / Expectations
Use plain, high-level statements. Mandatory requirements use "The service shall ...". Recommended requirements use "The service should ...". Do not use "must" or "may" in this table.

| ID | Requirement / Expectation | Requirement Class | Notes |
|---|---|---|---|
| R-01 | The service shall ... | Shall | |
| R-02 | The service should ... | Should | |

---

## 10. Open Notes / Unknowns (Optional)
### Decisions Still Needed
-

### Follow-Up Expected During Design or Review
-

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
}
