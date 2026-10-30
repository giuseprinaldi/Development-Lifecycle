// In-memory state for the mock API, persisted to localStorage so a demo
// survives a page reload. Reset from the header menu.

import { computeRecommendation } from '../../lib/rules'
import { TEMPLATE_VERSION, parseProposal } from '../../lib/template'
import type {
  AuditEntry,
  Condition,
  Job,
  ParsedProposal,
  Proposal,
  ProposalVersion,
  Requirement,
  Review,
  ReviewCheck,
  Service,
  Signoff,
  User,
  VersionSource,
} from '../../types'
import {
  DEFAULT_OPTIONAL_SIGNOFF,
  DEFAULT_REQUIRED_SIGNOFF,
  FIXTURE_SERVICES,
  FIXTURE_USERS,
  PROPOSAL_ALERT_ROUTING_RAW,
  PROPOSAL_ALERT_ROUTING_V2,
  PROPOSAL_DARK_MODE,
  PROPOSAL_RECONCILIATION,
  PROPOSAL_SCHEMA_REGISTRY,
} from './fixtures'
import { mockReview } from './review'

export interface MockState {
  version: 1
  currentUserId: string
  users: User[]
  services: Service[]
  proposals: Proposal[]
  versions: ProposalVersion[]
  requirements: Requirement[]
  reviews: Review[]
  checks: ReviewCheck[]
  conditions: Condition[]
  signoffs: Signoff[]
  jobs: Job[]
  audit: AuditEntry[]
  seq: number
}

const STORAGE_KEY = 'proposal-pipeline-mock-v1'

export function nextId(state: MockState, prefix: string): string {
  state.seq += 1
  return `${prefix}-${state.seq.toString(36)}`
}

export function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60000).toISOString()
}

export function audit(state: MockState, actor: string, action: string, entityType: string, entityId: string, before: string | null, after: string | null): void {
  state.audit.push({ id: nextId(state, 'aud'), actor, action, entityType, entityId, before, after, at: nowIso() })
}

/** Create a version and reconcile requirement rows by stable ID. */
export function addVersion(
  state: MockState,
  proposal: Proposal,
  markdown: string,
  source: VersionSource,
  createdBy: string,
  at: string = nowIso(),
): ProposalVersion {
  const versionNo = state.versions.filter((v) => v.proposalId === proposal.id).length + 1
  const parsed: ParsedProposal = parseProposal(markdown)
  const version: ProposalVersion = {
    id: nextId(state, 'ver'),
    proposalId: proposal.id,
    versionNo,
    markdown,
    parsed,
    source,
    templateVersion: TEMPLATE_VERSION,
    createdBy,
    createdAt: at,
  }
  state.versions.push(version)
  proposal.currentVersionId = version.id
  proposal.updatedAt = at

  const existing = state.requirements.filter((r) => r.proposalId === proposal.id)
  const seen = new Set<string>()
  for (const pr of parsed.requirements) {
    seen.add(pr.reqId)
    const row = existing.find((r) => r.reqId === pr.reqId)
    if (row) {
      row.text = pr.text
      row.cls = pr.cls
      row.notes = pr.notes
      row.status = 'active'
      row.lastVersionNo = versionNo
    } else {
      state.requirements.push({
        id: nextId(state, 'req'),
        proposalId: proposal.id,
        reqId: pr.reqId,
        text: pr.text,
        cls: pr.cls,
        notes: pr.notes,
        status: 'active',
        firstVersionNo: versionNo,
        lastVersionNo: versionNo,
      })
    }
  }
  for (const row of existing) {
    if (!seen.has(row.reqId) && row.status === 'active') row.status = 'removed'
  }
  return version
}

/** Run the mock reviewer against a version and record everything it produces. */
export function recordReview(
  state: MockState,
  proposal: Proposal,
  version: ProposalVersion,
  at: string = nowIso(),
  priorReview: Review | null = null,
): Review {
  const result = mockReview(version.markdown, version.parsed)
  const computed = computeRecommendation(result.checks)
  // The "model" sometimes disagrees with the rule; the app stores both and uses the computed one.
  const modelRecommendation = computed === 'Needs revision' && result.checks.filter((c) => c.status === 'No').length === 1 ? 'Approve with conditions' : computed

  const review: Review = {
    id: nextId(state, 'rev'),
    proposalId: proposal.id,
    proposalVersionId: version.id,
    versionNo: version.versionNo,
    kind: 'proposal',
    recommendation: computed,
    modelRecommendation,
    rationale: result.rationale,
    strengths: result.strengths,
    gaps: result.gaps,
    model: 'mock-reviewer (rule-based stand-in for Devin CLI)',
    bundleVersion: 'ai_bundle v1 (mock)',
    checklistVersion: 'mock-checklist v1',
    startedAt: at,
    finishedAt: at,
    reReviewOfReviewId: priorReview?.id ?? null,
    priorGaps: [],
  }
  if (priorReview) {
    const priorChecks = state.checks.filter((c) => c.reviewId === priorReview.id && c.status !== 'Yes' && c.status !== 'N/A')
    review.priorGaps = priorChecks.map((pc) => {
      const now = result.checks.find((c) => c.check === pc.check)
      return { text: pc.check, status: now && (now.status === 'Yes' || now.status === 'N/A') ? 'addressed' : 'still open' }
    })
  }
  state.reviews.push(review)
  for (const c of result.checks) {
    state.checks.push({ id: nextId(state, 'chk'), reviewId: review.id, ...c })
  }
  for (const seed of result.conditions) {
    state.conditions.push({
      id: nextId(state, 'cond'),
      reviewId: review.id,
      proposalId: proposal.id,
      text: seed.text,
      ownerRole: seed.ownerRole,
      targetPhase: seed.targetPhase,
      blocking: seed.blocking,
      status: 'open',
      notes: seed.notes,
      resolvedNote: null,
    })
  }
  return review
}

function makeProposal(state: MockState, code: string, serviceId: string, title: string, submitterId: string, createdAt: string): Proposal {
  const p: Proposal = {
    id: nextId(state, 'prop'),
    code,
    serviceId,
    title,
    state: 'Draft',
    currentVersionId: '',
    requiredSignoffRoles: [...DEFAULT_REQUIRED_SIGNOFF],
    optionalSignoffRoles: [...DEFAULT_OPTIONAL_SIGNOFF],
    needsConfirmation: false,
    submitterId,
    createdAt,
    updatedAt: createdAt,
    waitingOn: 'submitter',
  }
  state.proposals.push(p)
  return p
}

function userName(state: MockState, id: string): string {
  return state.users.find((u) => u.id === id)?.displayName ?? id
}

export function seedState(): MockState {
  const state: MockState = {
    version: 1,
    currentUserId: 'u-joe',
    users: structuredClone(FIXTURE_USERS),
    services: structuredClone(FIXTURE_SERVICES),
    proposals: [],
    versions: [],
    requirements: [],
    reviews: [],
    checks: [],
    conditions: [],
    signoffs: [],
    jobs: [],
    audit: [],
    seq: 1000,
  }
  const daysAgo = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString()

  // PROP-0001: reviewed, awaiting signoff, one approval in.
  {
    const p = makeProposal(state, 'PROP-0001', 'svc-reporting', 'Nightly reconciliation report', 'u-sam', daysAgo(9))
    const v1 = addVersion(state, p, PROPOSAL_RECONCILIATION, 'uploaded', 'u-sam', daysAgo(9))
    audit(state, userName(state, 'u-sam'), 'proposal.created', 'proposal', p.id, null, 'Draft')
    audit(state, userName(state, 'u-sam'), 'proposal.submitted', 'proposal', p.id, 'Draft', 'In Review')
    const job: Job = { id: nextId(state, 'job'), type: 'review_proposal', proposalId: p.id, state: 'succeeded', attempts: 1, log: 'devin -p ... review-proposal skill\nvalidated out/result.json\n33 checks recorded', error: null, createdAt: daysAgo(2, 3), startedAt: daysAgo(2, 3), finishedAt: daysAgo(2, 2) }
    state.jobs.push(job)
    const review = recordReview(state, p, v1, daysAgo(2, 2))
    p.state = review.recommendation === 'Needs revision' ? 'Returned' : 'Awaiting Signoff'
    audit(state, 'worker', 'review.completed', 'review', review.id, 'In Review', p.state)
    state.signoffs.push({ id: nextId(state, 'so'), proposalId: p.id, proposalVersionId: v1.id, versionNo: 1, role: 'tech_lead', userId: 'u-avery', decision: 'approve_with_conditions', notes: 'Fine to proceed. Confirm the month-end volume in a sample run before planning closes.', decidedAt: daysAgo(1, 4) })
    audit(state, userName(state, 'u-avery'), 'signoff.recorded', 'proposal', p.id, null, 'tech_lead: approve_with_conditions')
    p.updatedAt = daysAgo(1, 4)
  }

  // PROP-0002: pasted free text, reformatted, reviewed, returned.
  {
    const p = makeProposal(state, 'PROP-0002', 'svc-ingest', 'Alert routing by on-call schedule', 'u-riley', daysAgo(5))
    addVersion(state, p, PROPOSAL_ALERT_ROUTING_RAW, 'uploaded', 'u-riley', daysAgo(5))
    audit(state, userName(state, 'u-riley'), 'proposal.created', 'proposal', p.id, null, 'Draft')
    state.jobs.push({ id: nextId(state, 'job'), type: 'reformat_proposal', proposalId: p.id, state: 'succeeded', attempts: 1, log: 'devin -p ... generate-proposal skill\nwrote out/proposal.md\nvalidated out/result.json', error: null, createdAt: daysAgo(5), startedAt: daysAgo(5), finishedAt: daysAgo(4, 23) })
    const v2 = addVersion(state, p, PROPOSAL_ALERT_ROUTING_V2, 'generated', 'worker', daysAgo(4, 23))
    audit(state, 'worker', 'version.generated', 'proposal_version', v2.id, '1', '2')
    audit(state, userName(state, 'u-riley'), 'draft.confirmed', 'proposal', p.id, null, '2')
    audit(state, userName(state, 'u-riley'), 'proposal.submitted', 'proposal', p.id, 'Draft', 'In Review')
    state.jobs.push({ id: nextId(state, 'job'), type: 'review_proposal', proposalId: p.id, state: 'succeeded', attempts: 1, log: 'devin -p ... review-proposal skill\nvalidated out/result.json\n33 checks recorded\nmodel recommendation disagreed with computed rule; computed used', error: null, createdAt: daysAgo(4, 20), startedAt: daysAgo(4, 20), finishedAt: daysAgo(4, 19) })
    const review = recordReview(state, p, v2, daysAgo(4, 19))
    p.state = 'Returned'
    audit(state, 'worker', 'review.completed', 'review', review.id, 'In Review', 'Returned')
    p.updatedAt = daysAgo(4, 19)
  }

  // PROP-0003: approved by every required role.
  {
    const p = makeProposal(state, 'PROP-0003', 'svc-portal', 'Operator Portal dark mode', 'u-riley', daysAgo(23))
    const v1 = addVersion(state, p, PROPOSAL_DARK_MODE, 'uploaded', 'u-riley', daysAgo(23))
    audit(state, userName(state, 'u-riley'), 'proposal.created', 'proposal', p.id, null, 'Draft')
    audit(state, userName(state, 'u-riley'), 'proposal.submitted', 'proposal', p.id, 'Draft', 'In Review')
    state.jobs.push({ id: nextId(state, 'job'), type: 'review_proposal', proposalId: p.id, state: 'succeeded', attempts: 1, log: 'devin -p ... review-proposal skill\nvalidated out/result.json', error: null, createdAt: daysAgo(22), startedAt: daysAgo(22), finishedAt: daysAgo(22) })
    const review = recordReview(state, p, v1, daysAgo(22))
    audit(state, 'worker', 'review.completed', 'review', review.id, 'In Review', 'Awaiting Signoff')
    const decisions: [string, Signoff['role'], Signoff['decision'], string][] = [
      ['u-sam', 'proposal_owner', 'approve', ''],
      ['u-joe', 'project_manager', 'approve', 'Small, well bounded.'],
      ['u-avery', 'tech_lead', 'approve_with_conditions', 'Contrast check is a condition, not a blocker.'],
      ['u-morgan', 'architecture_reviewer', 'approve', ''],
    ]
    decisions.forEach(([uid, role, decision, notes], i) => {
      state.signoffs.push({ id: nextId(state, 'so'), proposalId: p.id, proposalVersionId: v1.id, versionNo: 1, role, userId: uid, decision, notes, decidedAt: daysAgo(20 - i) })
      audit(state, userName(state, uid), 'signoff.recorded', 'proposal', p.id, null, `${role}: ${decision}`)
    })
    p.state = 'Approved'
    audit(state, 'system', 'proposal.approved', 'proposal', p.id, 'Awaiting Signoff', 'Approved')
    for (const c of state.conditions.filter((c) => c.proposalId === p.id)) {
      c.status = 'carried'
    }
    p.updatedAt = daysAgo(16)
  }

  // PROP-0004: conforming draft, not yet submitted.
  {
    const p = makeProposal(state, 'PROP-0004', 'svc-ingest', 'Ingest schema registry', 'u-sam', daysAgo(1, 2))
    addVersion(state, p, PROPOSAL_SCHEMA_REGISTRY, 'uploaded', 'u-sam', daysAgo(1, 2))
    audit(state, userName(state, 'u-sam'), 'proposal.created', 'proposal', p.id, null, 'Draft')
  }

  return state
}

export function loadState(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockState
      if (parsed && parsed.version === 1) return parsed
    }
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seedState()
  saveState(fresh)
  return fresh
}

export function saveState(state: MockState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable; keep going in memory */
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
