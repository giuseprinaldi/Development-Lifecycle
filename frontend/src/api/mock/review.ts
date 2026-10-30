// Mock Stage 1 (reformat) and Stage 2 (review) behaviour.
//
// These stand in for the Devin CLI runs the worker performs in production.
// They are deliberately rule-based so the demo is deterministic: the same
// proposal always gets the same review. Nothing here is used in live mode.

import { blankTemplate, isEffectivelyEmpty, parseProposal, sectionBodies } from '../../lib/template'
import type { CheckStatus, ParsedProposal, Role } from '../../types'
import { CHECKLIST, TICKET_READINESS_FIELDS } from './fixtures'

export interface MockCheck {
  section: string
  check: string
  status: CheckStatus
  notes: string
  evidence: string
}

export interface MockConditionSeed {
  text: string
  ownerRole: Role
  targetPhase: string
  blocking: boolean
  notes: string
}

export interface MockReviewResult {
  checks: MockCheck[]
  strengths: string[]
  gaps: string[]
  conditions: MockConditionSeed[]
  rationale: string
}

const UNRESOLVED = /unresolved/i

function sub(body: string | undefined, heading: string): string {
  if (!body) return ''
  const re = new RegExp(`###\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n([\\s\\S]*?)(?=\\n###\\s|$)`, 'i')
  const m = body.match(re)
  return m ? m[1].trim() : ''
}

function bullets(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^-\s*\S/.test(l) && !/^-+$/.test(l) && !UNRESOLVED.test(l))
    .map((l) => l.replace(/^-\s*/, ''))
}

function labelled(text: string, label: string): string {
  const re = new RegExp(`^-\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.*)$`, 'im')
  const m = text.match(re)
  return m ? m[1].trim() : ''
}

function grade(text: string, opts: { emptyIs?: CheckStatus } = {}): { status: CheckStatus; notes: string; evidence: string } {
  if (!text || isEffectivelyEmpty(text)) {
    return { status: opts.emptyIs ?? 'No', notes: 'Section is empty or still template placeholder text.', evidence: '' }
  }
  if (UNRESOLVED.test(text)) {
    return { status: 'Partial', notes: 'Marked unresolved in the proposal; content is incomplete.', evidence: text.slice(0, 140) }
  }
  return { status: 'Yes', notes: '', evidence: text.slice(0, 140) }
}

function ownerFor(section: string): Role {
  if (section.startsWith('Solution') || section.startsWith('Constraints')) return 'tech_lead'
  if (section.startsWith('Approval')) return 'project_manager'
  return 'proposal_owner'
}

export function mockReview(markdown: string, parsed: ParsedProposal): MockReviewResult {
  const s = sectionBodies(markdown)
  const dc = parsed.documentControl
  const dcVal = (k: string) => (dc[k] ?? '').trim()
  const dcOk = (k: string) => dcVal(k) !== '' && !UNRESOLVED.test(dcVal(k))

  const results = new Map<string, { status: CheckStatus; notes: string; evidence: string }>()
  const set = (check: string, r: { status: CheckStatus; notes: string; evidence: string }) => results.set(check, r)

  // Core Completeness
  {
    const have = ['Proposal Title', 'Author', 'Target System / Service / Product'].filter(dcOk)
    set('Document Control is present with title, author, and target system', {
      status: !parsed.sectionsFound.includes('Document Control') ? 'No' : have.length === 3 ? 'Yes' : 'Partial',
      notes: have.length === 3 ? '' : `Present: ${have.join(', ') || 'none'}. Missing or unresolved: ${['Proposal Title', 'Author', 'Target System / Service / Product'].filter((k) => !dcOk(k)).join(', ')}.`,
      evidence: have.map((k) => `${k}: ${dcVal(k)}`).join('; '),
    })
    set('Problem statement is present and specific', grade(sub(s.get(1), 'Problem')))
    set('Proposed change is stated in plain language', grade(sub(s.get(1), 'Proposed Change')))
    set('Expected outcome is stated', grade(sub(s.get(1), 'Expected Outcome')))
    set('Business or mission driver is stated', grade(labelled(s.get(2) ?? '', 'Business or mission driver')))
  }

  // Scope Quality
  {
    const inScope = bullets(sub(s.get(4), 'In Scope'))
    const outScope = bullets(sub(s.get(4), 'Out of Scope'))
    const deferred = bullets(sub(s.get(4), 'Deferred / Future Consideration'))
    set('In-scope items are listed', inScope.length ? { status: 'Yes', notes: '', evidence: inScope.join('; ') } : { status: 'No', notes: 'No in-scope bullets found in section 4.', evidence: '' })
    set('Out-of-scope items are listed', outScope.length ? { status: 'Yes', notes: '', evidence: outScope.join('; ') } : { status: 'Partial', notes: 'No out-of-scope items; reviewers cannot tell what was consciously excluded.', evidence: '' })
    set('Deferred items are separated from out-of-scope items', deferred.length ? { status: 'Yes', notes: '', evidence: deferred.join('; ') } : { status: 'N/A', notes: 'Nothing deferred.', evidence: '' })
    set('Scope boundaries are consistent with the problem statement', { status: inScope.length ? 'Yes' : 'N/A', notes: inScope.length ? 'No contradiction found between scope and problem statement.' : 'Cannot judge without in-scope items.', evidence: '' })
  }

  // Solution Framing
  {
    const approach = sub(s.get(5), 'Summary of the Approach')
    const approachGrade = grade(approach)
    set('Approach is described at a high level without implementation detail', approachGrade.status === 'Partial' ? { ...approachGrade, status: 'No', notes: 'The approach is marked unresolved. A reviewer cannot judge feasibility or scope fit without it.' } : approachGrade)
    const areas = sub(s.get(5), 'Affected Areas')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^-\s*[^:]+:\s*\S/.test(l) && !UNRESOLVED.test(l))
    set('Affected areas are identified', { status: areas.length >= 3 ? 'Yes' : areas.length ? 'Partial' : 'No', notes: areas.length >= 3 ? '' : `${areas.length} of 5 affected-area lines have content.`, evidence: areas.join('; ') })
    set('Things intentionally unchanged are stated', grade(sub(s.get(5), 'Things Intentionally Unchanged'), { emptyIs: 'Partial' }))
    set('Approach stays within the stated scope', { status: approachGrade.status === 'Yes' ? 'Yes' : 'N/A', notes: approachGrade.status === 'Yes' ? 'Approach references only in-scope areas.' : 'Cannot judge without an approach.', evidence: '' })
  }

  // Goals and Outcomes
  {
    set('Goals are listed', grade(sub(s.get(6), 'Goals')))
    const outcomes = sub(s.get(6), 'Success Outcomes')
    const g = grade(outcomes)
    if (g.status === 'Yes' && !/\d|%|within|under|zero|before/i.test(outcomes)) {
      set('Success outcomes are measurable or observable', { status: 'Partial', notes: 'Outcomes are stated but carry no number, threshold, or observable event.', evidence: outcomes.slice(0, 140) })
    } else set('Success outcomes are measurable or observable', g.status === 'Partial' ? { ...g, status: 'No', notes: 'Success outcomes are unresolved; the proposal cannot be judged complete without them.' } : g)
    set('Non-goals are listed', grade(sub(s.get(6), 'Non-Goals'), { emptyIs: 'Partial' }))
    set('Outcomes follow from the problem statement', { status: g.status === 'Yes' ? 'Yes' : 'N/A', notes: '', evidence: '' })
  }

  // Constraints, Risks, and Unknowns
  {
    set('Constraints are listed', grade(sub(s.get(7), 'Constraints'), { emptyIs: 'Partial' }))
    set('Assumptions are listed', grade(sub(s.get(7), 'Assumptions'), { emptyIs: 'Partial' }))
    set('Dependencies are listed', grade(sub(s.get(7), 'Dependencies'), { emptyIs: 'Partial' }))
    const risks = sub(s.get(8), 'Known Risks')
    set('Known risks are specific, or "none identified" is stated', /none identified/i.test(risks) ? { status: 'Yes', notes: 'States none identified.', evidence: risks } : grade(risks))
    const unknowns = `${sub(s.get(8), 'Unknowns')}\n${sub(s.get(8), 'Questions That Still Need Answers')}`
    set('Unknowns and open questions are visible rather than hidden', isEffectivelyEmpty(unknowns) ? { status: 'Partial', notes: 'No unknowns or open questions recorded; confirm there are none.', evidence: '' } : { status: 'Yes', notes: '', evidence: unknowns.trim().slice(0, 140) })
  }

  // Initial Requirements
  {
    const reqs = parsed.requirements
    set('At least one requirement is present in the section 9 table', reqs.length ? { status: 'Yes', notes: `${reqs.length} requirements.`, evidence: reqs.map((r) => r.reqId).join(', ') } : { status: 'No', notes: 'Section 9 has no requirement rows.', evidence: '' })
    const wording = parsed.problems.filter((p) => /must|may/i.test(p))
    set('Requirements use "shall" or "should" wording only', wording.length ? { status: 'No', notes: wording.join(' '), evidence: '' } : { status: reqs.length ? 'Yes' : 'N/A', notes: '', evidence: '' })
    const noClass = reqs.filter((r) => !r.cls)
    set('Every requirement has an ID and a class', noClass.length ? { status: 'Partial', notes: `${noClass.map((r) => r.reqId).join(', ')} missing a class.`, evidence: '' } : { status: reqs.length ? 'Yes' : 'N/A', notes: '', evidence: '' })
    set('Requirements are traceable to in-scope items', { status: reqs.length && bullets(sub(s.get(4), 'In Scope')).length ? 'Yes' : 'N/A', notes: '', evidence: '' })
    const long = reqs.filter((r) => r.text.length > 220)
    set('Requirements are high-level, not implementation detail', long.length ? { status: 'Partial', notes: `${long.map((r) => r.reqId).join(', ')} read as implementation detail; shorten to the expectation.`, evidence: '' } : { status: reqs.length ? 'Yes' : 'N/A', notes: '', evidence: '' })
  }

  // Approval Readiness
  {
    set('Stakeholders are named', dcOk('Stakeholders') ? { status: 'Yes', notes: '', evidence: dcVal('Stakeholders') } : { status: dcVal('Stakeholders') ? 'Partial' : 'No', notes: 'Stakeholders missing or unresolved in Document Control.', evidence: dcVal('Stakeholders') })
    set('Approval authority is named', dcOk('Approval Authority') ? { status: 'Yes', notes: '', evidence: dcVal('Approval Authority') } : { status: 'No', notes: 'Approval Authority missing in Document Control.', evidence: '' })
    const signoff = s.get(11) ?? ''
    const rolesPresent = ['Proposal Owner', 'Project Manager', 'Tech Lead', 'Architecture Reviewer'].filter((r) => signoff.includes(r))
    set('Signoff table is present with the required roles', rolesPresent.length === 4 ? { status: 'Yes', notes: '', evidence: rolesPresent.join(', ') } : { status: rolesPresent.length ? 'Partial' : 'No', notes: `Rows present: ${rolesPresent.join(', ') || 'none'}.`, evidence: '' })
    set('Proposal owner is named', dcOk('Proposal Owner') ? { status: 'Yes', notes: '', evidence: dcVal('Proposal Owner') } : { status: 'Partial', notes: 'Proposal Owner is missing or unresolved; a named owner is required before signoff.', evidence: dcVal('Proposal Owner') })
    const ticketFields = TICKET_READINESS_FIELDS.filter((f) => dcVal(f) !== '')
    set('Ticket-readiness fields are available or planned for the approval gate', ticketFields.length === TICKET_READINESS_FIELDS.length ? { status: 'Yes', notes: '', evidence: ticketFields.join(', ') } : { status: 'Partial', notes: `Collect at the approval gate: ${TICKET_READINESS_FIELDS.filter((f) => !ticketFields.includes(f)).join(', ')}.`, evidence: '' })
    const placeholders = (markdown.match(/^(Describe the|State what|Explain why) .*$/gm) ?? []).length
    set('No section is left as unmodified template placeholder text', placeholders ? { status: 'Partial', notes: `${placeholders} template placeholder line(s) remain.`, evidence: '' } : { status: 'Yes', notes: '', evidence: '' })
  }

  const checks: MockCheck[] = CHECKLIST.map((c) => {
    const r = results.get(c.check) ?? { status: 'N/A' as CheckStatus, notes: 'Not evaluated by the mock reviewer.', evidence: '' }
    return { section: c.section, check: c.check, ...r }
  })

  const bySection = new Map<string, MockCheck[]>()
  for (const c of checks) bySection.set(c.section, [...(bySection.get(c.section) ?? []), c])

  const strengths: string[] = []
  const gaps: string[] = []
  for (const [section, list] of bySection) {
    const yes = list.filter((c) => c.status === 'Yes').length
    const no = list.filter((c) => c.status === 'No')
    const partial = list.filter((c) => c.status === 'Partial')
    if (yes === list.length) strengths.push(`${section}: every check satisfied.`)
    else if (yes >= list.length - 1 && !no.length) strengths.push(`${section}: solid, one item to tidy.`)
    for (const c of no) gaps.push(`${c.check}. ${c.notes}`.trim())
    for (const c of partial) gaps.push(`${c.check} (partial). ${c.notes}`.trim())
  }

  const conditions: MockConditionSeed[] = checks
    .filter((c) => c.status === 'Partial')
    .map((c) => ({
      text: `${c.check}: ${c.notes || 'complete before planning.'}`,
      ownerRole: ownerFor(c.section),
      targetPhase: 'Planning',
      blocking: c.check.startsWith('Ticket-readiness') || c.check.startsWith('Proposal owner'),
      notes: c.section,
    }))

  const noCount = checks.filter((c) => c.status === 'No').length
  const partialCount = checks.filter((c) => c.status === 'Partial').length
  const rationale = noCount
    ? `${noCount} check${noCount === 1 ? '' : 's'} failed outright, so the proposal is not ready for signoff regardless of its strengths. Address the failed checks first; the ${partialCount} partial item${partialCount === 1 ? '' : 's'} can be carried as conditions once they are fixed.`
    : partialCount
      ? `No check failed. ${partialCount} partial item${partialCount === 1 ? '' : 's'} can proceed as conditions carried into planning; none blocks a decision on the proposal itself.`
      : 'Every check is satisfied or not applicable. The proposal is ready for signoff as written.'

  return { checks, strengths, gaps, conditions, rationale }
}

/** Mock Stage 1: wrap free text into the template, leaving unknowns visible. */
export function mockReformat(raw: string, title: string, author: string): string {
  const paragraphs = raw
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const firstLine = paragraphs[0]?.split(/\r?\n/)[0] ?? ''
  const looksLikeTitle = firstLine.length < 80 && !/[.!?]$/.test(firstLine) && paragraphs.length > 1 && !paragraphs[0].includes('\n')
  const body = looksLikeTitle ? paragraphs.slice(1) : paragraphs
  const problem = body[0] ?? 'Unresolved: not stated in the source.'
  const change = body.find((p, i) => i > 0 && /\b(want|propose|add|build|should|change)\b/i.test(p)) ?? 'Unresolved: the source describes a need but not a change.'
  const risks = body.filter((p) => /\brisk/i.test(p))
  const notScope = body.filter((p) => /\bnot\b.*\b(change|replace|looking)\b/i.test(p))

  const sentences = raw.replace(/\s+/g, ' ').match(/[^.!?]*\b(shall|should)\b[^.!?]*[.!?]/gi) ?? []
  const reqRows = sentences.slice(0, 6).map((sentence, i) => {
    const text = sentence.trim().replace(/^(we|it|they)\s+/i, 'The service ')
    const cls = /\bshall\b/i.test(text) ? 'Shall' : 'Should'
    return `| R-${String(i + 1).padStart(2, '0')} | ${text} | ${cls} | Derived from source wording |`
  })
  if (!reqRows.length) reqRows.push('| R-01 | The service shall (unresolved: the source contains no requirement statements). | Shall | Author to complete |')

  let md = blankTemplate(title, author)
  md = md.replace('Describe the problem this proposal is trying to solve.', problem)
  md = md.replace('Describe the proposed change in plain language.', change)
  md = md.replace('State what success should look like if this proposal is approved and completed.', 'Unresolved: the source does not state a measurable outcome.')
  md = md.replace('Describe the current process, system, capability, or limitation.', problem)
  md = md.replace('Explain why a change is needed.', 'Unresolved: implied by the problem statement; author to confirm.')
  md = md.replace('Describe the intended solution at a high level.', 'Unresolved: the source describes desired behavior but not an approach.')
  md = md.replace(
    '### Out of Scope\n-\n-',
    `### Out of Scope\n${notScope.length ? notScope.map((p) => `- ${p}`).join('\n') : '- Unresolved: not stated in the source.'}`,
  )
  md = md.replace('### Known Risks\n-', `### Known Risks\n${risks.length ? risks.map((p) => `- ${p}`).join('\n') : '- Unresolved: none stated in the source.'}`)
  md = md.replace(/\| R-01 \| The service shall \.\.\. \| Shall \| \|\n\| R-02 \| The service should \.\.\. \| Should \| \|/, reqRows.join('\n'))
  md = md.replace('- Proposal Owner:\n', '- Proposal Owner: Unresolved: not stated in the source\n')
  md = md.replace('- Stakeholders:\n', '- Stakeholders: Unresolved: not stated in the source\n')
  md = md.replace('- Approval Authority:\n', '- Approval Authority: Digital Architecture Team signoff roles\n')
  return md
}

export function reparse(markdown: string): ParsedProposal {
  return parseProposal(markdown)
}
