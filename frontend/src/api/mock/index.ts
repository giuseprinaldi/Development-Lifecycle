// Mock API client. Same contract as the live client; everything happens in
// the browser. Long-running stages are simulated with timers so the UI's
// job-progress states can be seen.

import { computeSignoffOutcome, waitingOnRoles } from '../../lib/rules'
import { ROLE_LABELS } from '../../types'
import { parseProposal } from '../../lib/template'
import type {
  Condition,
  ConditionStatus,
  CreateProposalInput,
  Job,
  Proposal,
  ProposalDetail,
  ProposalListItem,
  ProposalVersion,
  Review,
  Role,
  Service,
  SignoffInput,
  User,
} from '../../types'
import { ApiError, type ApiClient, type ProposalFilter } from '../types'
import { DEFAULT_OPTIONAL_SIGNOFF, DEFAULT_REQUIRED_SIGNOFF } from './fixtures'
import { mockReformat } from './review'
import {
  addVersion,
  audit,
  clearState,
  loadState,
  nextId,
  nowIso,
  recordReview,
  saveState,
  type MockState,
} from './store'

const LATENCY_MS = 180
const STAGE_RUNNING_AFTER_MS = 1200
const STAGE_DONE_AFTER_MS = 4200

let state: MockState = loadState()
const timers = new Set<ReturnType<typeof setTimeout>>()

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), LATENCY_MS))
}

function fail(status: number, message: string): never {
  throw new ApiError(status, message)
}

function me(): User {
  const u = state.users.find((u) => u.id === state.currentUserId)
  if (!u) fail(401, 'No signed-in user.')
  return u
}

function isAdmin(u: User): boolean {
  return u.roles.includes('admin')
}

function proposalOr404(id: string): Proposal {
  const p = state.proposals.find((p) => p.id === id || p.code === id)
  if (!p) fail(404, `Proposal ${id} not found.`)
  return p
}

function currentVersion(p: Proposal): ProposalVersion {
  const v = state.versions.find((v) => v.id === p.currentVersionId)
  if (!v) fail(500, 'Proposal has no current version.')
  return v
}

function refreshWaitingOn(p: Proposal): void {
  const roles = waitingOnRoles(p, state.signoffs)
  if (p.state === 'In Review') p.waitingOn = 'review job'
  else if (p.state === 'Rejected' || p.state === 'Closed') p.waitingOn = ''
  else if (p.state === 'Approved') p.waitingOn = 'planning (Phase 2)'
  else p.waitingOn = roles.map((r) => (r === 'submitter' ? 'submitter' : ROLE_LABELS[r])).join(', ')
}

function detail(p: Proposal): ProposalDetail {
  refreshWaitingOn(p)
  const service = state.services.find((s) => s.id === p.serviceId) ?? { id: p.serviceId, name: 'Unknown service', description: '' }
  return {
    proposal: p,
    service,
    versions: state.versions.filter((v) => v.proposalId === p.id).sort((a, b) => a.versionNo - b.versionNo),
    requirements: state.requirements.filter((r) => r.proposalId === p.id),
    reviews: state.reviews.filter((r) => r.proposalId === p.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
    checks: state.checks.filter((c) => state.reviews.some((r) => r.id === c.reviewId && r.proposalId === p.id)),
    conditions: state.conditions.filter((c) => c.proposalId === p.id),
    signoffs: state.signoffs.filter((s) => s.proposalId === p.id),
    jobs: state.jobs.filter((j) => j.proposalId === p.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    audit: state.audit.filter((a) => a.entityId === p.id || state.reviews.some((r) => r.id === a.entityId && r.proposalId === p.id) || state.versions.some((v) => v.id === a.entityId && v.proposalId === p.id)).sort((a, b) => b.at.localeCompare(a.at)),
  }
}

function persist(): void {
  saveState(state)
}

function schedule(fn: () => void, ms: number): void {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}

/** Simulate the worker: queued → running → succeeded, mutating state along the way. */
function runJob(job: Job): void {
  schedule(() => {
    job.state = 'running'
    job.startedAt = nowIso()
    job.attempts += 1
    job.log += `${job.log ? '\n' : ''}claimed by worker-1\ndevin -p "<${job.type} prompt>" --permission-mode plan --respect-workspace-trust false`
    persist()
  }, STAGE_RUNNING_AFTER_MS)

  schedule(() => {
    const p = state.proposals.find((p) => p.id === job.proposalId)
    if (!p) return
    try {
      if (job.type === 'reformat_proposal') {
        const v = currentVersion(p)
        const user = state.users.find((u) => u.id === p.submitterId)
        const generated = mockReformat(v.markdown, p.title, user?.displayName ?? 'Unknown')
        const v2 = addVersion(state, p, generated, 'generated', 'worker')
        p.needsConfirmation = true
        job.log += `\nwrote out/proposal.md (version ${v2.versionNo})\nvalidated out/result.json against Stage1Result`
        audit(state, 'worker', 'version.generated', 'proposal_version', v2.id, String(v.versionNo), String(v2.versionNo))
      } else if (job.type === 'review_proposal') {
        const v = currentVersion(p)
        const prior = [...state.reviews].reverse().find((r) => r.proposalId === p.id && r.proposalVersionId !== v.id) ?? null
        const review: Review = recordReview(state, p, v, nowIso(), prior)
        const before = p.state
        p.state = review.recommendation === 'Needs revision' ? 'Returned' : 'Awaiting Signoff'
        job.log += `\n${prior ? 're-review mode: prior review attached\n' : ''}validated out/result.json against Stage2Result\n33 checks recorded\ncomputed recommendation: ${review.recommendation}${review.modelRecommendation !== review.recommendation ? ` (model said ${review.modelRecommendation}; disagreement logged)` : ''}`
        audit(state, 'worker', 'review.completed', 'review', review.id, before, p.state)
      }
      job.state = 'succeeded'
    } catch (e) {
      job.state = 'failed'
      job.error = e instanceof Error ? e.message : String(e)
    }
    job.finishedAt = nowIso()
    p.updatedAt = nowIso()
    refreshWaitingOn(p)
    persist()
  }, STAGE_DONE_AFTER_MS)
}

function enqueue(type: Job['type'], proposalId: string): Job {
  const job: Job = {
    id: nextId(state, 'job'),
    type,
    proposalId,
    state: 'queued',
    attempts: 0,
    log: '',
    error: null,
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
  }
  state.jobs.push(job)
  runJob(job)
  return job
}

// Resume anything that was mid-flight when the page last unloaded.
for (const j of state.jobs) {
  if (j.state === 'queued' || j.state === 'running') runJob(j)
}

export const mockClient: ApiClient = {
  mode: 'mock',

  async me() {
    return delay(me())
  },

  async listUsers() {
    if (!isAdmin(me())) fail(403, 'Admin role required.')
    return delay(state.users)
  },

  async setUserRoles(userId, roles) {
    const actor = me()
    if (!isAdmin(actor)) fail(403, 'Admin role required.')
    const u = state.users.find((u) => u.id === userId)
    if (!u) fail(404, 'User not found.')
    const before = u.roles.join(',')
    u.roles = [...new Set(roles)]
    audit(state, actor.displayName, 'user.roles_changed', 'user', u.id, before, u.roles.join(','))
    persist()
    return delay(u)
  },

  async listServices() {
    return delay(state.services as Service[])
  },

  async listProposals(filter: ProposalFilter = {}) {
    const user = me()
    const items: ProposalListItem[] = state.proposals
      .filter((p) => !filter.state || filter.state === 'all' || p.state === filter.state)
      .filter((p) => !filter.serviceId || p.serviceId === filter.serviceId)
      .filter((p) => !filter.mine || p.submitterId === user.id)
      .map((p) => {
        refreshWaitingOn(p)
        const latest = [...state.reviews].reverse().find((r) => r.proposalId === p.id)
        return {
          proposal: p,
          serviceName: state.services.find((s) => s.id === p.serviceId)?.name ?? 'Unknown',
          submitterName: state.users.find((u) => u.id === p.submitterId)?.displayName ?? 'Unknown',
          latestRecommendation: latest?.recommendation ?? null,
        }
      })
      .sort((a, b) => b.proposal.updatedAt.localeCompare(a.proposal.updatedAt))
    return delay(items)
  },

  async getProposal(id) {
    return delay(detail(proposalOr404(id)))
  },

  async createProposal(input: CreateProposalInput) {
    const user = me()
    if (!input.title.trim()) fail(400, 'Title is required.')
    if (!input.markdown.trim()) fail(400, 'Proposal text is required.')
    if (!state.services.some((s) => s.id === input.serviceId)) fail(400, 'Choose a service.')
    const n = state.proposals.length + 1
    const p: Proposal = {
      id: nextId(state, 'prop'),
      code: `PROP-${String(n).padStart(4, '0')}`,
      serviceId: input.serviceId,
      title: input.title.trim(),
      state: 'Draft',
      currentVersionId: '',
      requiredSignoffRoles: [...DEFAULT_REQUIRED_SIGNOFF],
      optionalSignoffRoles: [...DEFAULT_OPTIONAL_SIGNOFF],
      needsConfirmation: false,
      submitterId: user.id,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      waitingOn: 'submitter',
    }
    state.proposals.push(p)
    const v1 = addVersion(state, p, input.markdown, 'uploaded', user.id)
    audit(state, user.displayName, 'proposal.created', 'proposal', p.id, null, 'Draft')
    if (!v1.parsed.conforming) {
      enqueue('reformat_proposal', p.id)
      audit(state, 'system', 'job.enqueued', 'proposal', p.id, null, 'reformat_proposal')
    }
    persist()
    return delay(detail(p))
  },

  async updateDraft(id, markdown) {
    const user = me()
    const p = proposalOr404(id)
    if (p.state !== 'Draft' && p.state !== 'Returned') fail(409, `Cannot edit a proposal in state ${p.state}.`)
    if (p.submitterId !== user.id && !isAdmin(user)) fail(403, 'Only the submitter can edit the draft.')
    const v = addVersion(state, p, markdown, 'edited', user.id)
    p.needsConfirmation = false
    audit(state, user.displayName, 'version.edited', 'proposal_version', v.id, String(v.versionNo - 1), String(v.versionNo))
    persist()
    return delay(detail(p))
  },

  async confirmDraft(id) {
    const user = me()
    const p = proposalOr404(id)
    if (p.submitterId !== user.id && !isAdmin(user)) fail(403, 'Only the submitter can confirm the draft.')
    p.needsConfirmation = false
    audit(state, user.displayName, 'draft.confirmed', 'proposal', p.id, null, String(currentVersion(p).versionNo))
    persist()
    return delay(detail(p))
  },

  async submit(id) {
    const user = me()
    const p = proposalOr404(id)
    if (p.state !== 'Draft' && p.state !== 'Returned') fail(409, `Cannot submit a proposal in state ${p.state}.`)
    if (p.submitterId !== user.id && !isAdmin(user)) fail(403, 'Only the submitter can submit.')
    const v = currentVersion(p)
    const parsed = parseProposal(v.markdown)
    if (!parsed.conforming) {
      fail(400, `Proposal does not conform to the template. Missing: ${parsed.sectionsMissing.join('; ') || 'requirements table rows'}.`)
    }
    if (p.needsConfirmation) fail(400, 'Review the reformatted draft and confirm it before submitting.')
    const before = p.state
    p.state = 'In Review'
    p.updatedAt = nowIso()
    enqueue('review_proposal', p.id)
    audit(state, user.displayName, 'proposal.submitted', 'proposal', p.id, before, 'In Review')
    persist()
    return delay(detail(p))
  },

  async signoff(id, input: SignoffInput) {
    const user = me()
    const p = proposalOr404(id)
    if (p.state !== 'Awaiting Signoff') fail(409, `Proposal is ${p.state}, not awaiting signoff.`)
    const eligible = new Set<Role>([...p.requiredSignoffRoles, ...p.optionalSignoffRoles])
    const roles = user.roles.filter((r) => eligible.has(r))
    if (!roles.length) fail(403, 'You do not hold a signoff role on this proposal.')
    if ((input.decision === 'return' || input.decision === 'reject') && !input.notes.trim()) {
      fail(400, 'Notes are required when returning or rejecting.')
    }
    const v = currentVersion(p)
    for (const role of roles) {
      const existing = state.signoffs.find((s) => s.proposalVersionId === v.id && s.role === role)
      if (existing) {
        existing.decision = input.decision
        existing.notes = input.notes
        existing.userId = user.id
        existing.decidedAt = nowIso()
      } else {
        state.signoffs.push({ id: nextId(state, 'so'), proposalId: p.id, proposalVersionId: v.id, versionNo: v.versionNo, role, userId: user.id, decision: input.decision, notes: input.notes, decidedAt: nowIso() })
      }
      audit(state, user.displayName, 'signoff.recorded', 'proposal', p.id, null, `${role}: ${input.decision}`)
    }
    const outcome = computeSignoffOutcome(p.requiredSignoffRoles, state.signoffs.filter((s) => s.proposalVersionId === v.id))
    if (outcome.state !== p.state) {
      const before = p.state
      p.state = outcome.state
      audit(state, 'system', `proposal.${outcome.state.toLowerCase().replace(/ /g, '_')}`, 'proposal', p.id, before, outcome.state)
      if (outcome.state === 'Approved') {
        for (const c of state.conditions.filter((c) => c.proposalId === p.id && c.status === 'open')) c.status = 'carried'
      }
    }
    p.updatedAt = nowIso()
    persist()
    return delay(detail(p))
  },

  async setSignoffRoles(id, required: Role[], optional: Role[]) {
    const user = me()
    if (!isAdmin(user)) fail(403, 'Admin role required.')
    const p = proposalOr404(id)
    const before = `${p.requiredSignoffRoles.join(',')} | ${p.optionalSignoffRoles.join(',')}`
    p.requiredSignoffRoles = [...new Set(required)]
    p.optionalSignoffRoles = [...new Set(optional)].filter((r) => !p.requiredSignoffRoles.includes(r))
    audit(state, user.displayName, 'proposal.signoff_roles_changed', 'proposal', p.id, before, `${p.requiredSignoffRoles.join(',')} | ${p.optionalSignoffRoles.join(',')}`)
    persist()
    return delay(detail(p))
  },

  async updateCondition(conditionId, status: ConditionStatus, note) {
    const user = me()
    const allowed: Role[] = ['tech_lead', 'project_manager', 'admin']
    if (!user.roles.some((r) => allowed.includes(r))) fail(403, 'Tech Lead, Project Manager, or Admin required.')
    const c = state.conditions.find((c) => c.id === conditionId)
    if (!c) fail(404, 'Condition not found.')
    if (status === 'resolved' && !note.trim()) fail(400, 'A note is required to resolve a condition.')
    const before = c.status
    c.status = status
    c.resolvedNote = status === 'resolved' ? note : c.resolvedNote
    audit(state, user.displayName, 'condition.updated', 'condition', c.id, before, status)
    persist()
    return delay(c as Condition)
  },

  async getJob(id) {
    const j = state.jobs.find((j) => j.id === id)
    if (!j) fail(404, 'Job not found.')
    return delay(j)
  },

  async retryJob(id) {
    const j = state.jobs.find((j) => j.id === id)
    if (!j) fail(404, 'Job not found.')
    if (j.state !== 'failed') fail(409, 'Only failed jobs can be retried.')
    j.state = 'queued'
    j.error = null
    j.log += '\nretry requested'
    runJob(j)
    persist()
    return delay(j)
  },

  async listSwitchableUsers() {
    return delay(state.users)
  },

  async switchUser(userId) {
    const u = state.users.find((u) => u.id === userId)
    if (!u) fail(404, 'User not found.')
    state.currentUserId = u.id
    persist()
    return delay(u)
  },

  async resetMockData() {
    for (const t of timers) clearTimeout(t)
    timers.clear()
    clearState()
    state = loadState()
  },
}
