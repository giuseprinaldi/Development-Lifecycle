// Business rules from docs/spec.md. The backend applies these authoritatively;
// the frontend uses them to pre-compute what will happen (so the signoff page
// can say "one more approval and this is Approved") and to drive the mock API.

import type {
  CheckStatus,
  Proposal,
  ProposalState,
  Recommendation,
  Role,
  Signoff,
  SignoffDecision,
} from '../types'

export const CORE_COMPLETENESS = 'Core Completeness'

/** Spec section 8: recommendation rule. Any No → Needs revision; Partials → Approve with conditions; else Approve. */
export function computeRecommendation(
  checks: { section: string; status: CheckStatus }[],
): Recommendation {
  if (checks.some((c) => c.status === 'No')) return 'Needs revision'
  if (checks.some((c) => c.status === 'Partial')) return 'Approve with conditions'
  return 'Approve'
}

export type SignoffOutcome =
  | { state: 'Approved' }
  | { state: 'Returned'; by: Role[] }
  | { state: 'Rejected'; by: Role[] }
  | { state: 'Awaiting Signoff'; missing: Role[] }

/** Spec section 7: any reject → Rejected; any return → Returned; all required approve → Approved. */
export function computeSignoffOutcome(
  requiredRoles: Role[],
  signoffs: Pick<Signoff, 'role' | 'decision'>[],
): SignoffOutcome {
  const required = new Set(requiredRoles)
  const byRole = new Map<Role, SignoffDecision>()
  for (const s of signoffs) if (required.has(s.role)) byRole.set(s.role, s.decision)

  const rejecters = [...byRole].filter(([, d]) => d === 'reject').map(([r]) => r)
  if (rejecters.length) return { state: 'Rejected', by: rejecters }
  const returners = [...byRole].filter(([, d]) => d === 'return').map(([r]) => r)
  if (returners.length) return { state: 'Returned', by: returners }
  const missing = requiredRoles.filter((r) => !byRole.has(r))
  if (missing.length) return { state: 'Awaiting Signoff', missing }
  return { state: 'Approved' }
}

export const TERMINAL_STATES: ProposalState[] = ['Rejected', 'Closed']

export const STATE_DESCRIPTIONS: Record<ProposalState, string> = {
  Draft: 'Being written or reformatted. The submitter owns the text and submits it for review.',
  'In Review': 'Stage 2 is running the proposal review checklist.',
  Returned: 'Needs revision. The submitter edits and resubmits; the review runs in re-review mode.',
  'Awaiting Signoff': 'Review passed. Required signoff roles decide.',
  Rejected: 'Terminal. A human rejected the proposal.',
  Approved: 'All required roles signed off. Delivery planning is next (Phase 2).',
  Planning: 'Delivery plan drafted and awaiting approval before Jira creation (Phase 2).',
  'In Development': 'Tickets created; developers link a merge request when done (Phase 3).',
  'Alignment Review': 'Stage 4 is reviewing the merge request against the proposal (Phase 3).',
  Adjudication: 'Adjudicators disposition each finding (Phase 3).',
  Closing: 'Carry-forward baseline generated and awaiting confirmation (Phase 4).',
  Closed: 'Done. The baseline seeds the next feature set.',
}

/** Which role group a state is waiting on, for the list view and "Waiting on me". */
export function waitingOnRoles(p: Proposal, signoffs: Signoff[]): Role[] {
  switch (p.state) {
    case 'Awaiting Signoff': {
      const decided = new Set(
        signoffs.filter((s) => s.proposalVersionId === p.currentVersionId).map((s) => s.role),
      )
      return p.requiredSignoffRoles.filter((r) => !decided.has(r))
    }
    case 'Draft':
    case 'Returned':
      return ['submitter']
    case 'Planning':
      return ['project_manager', 'tech_lead']
    case 'Adjudication':
      return ['tech_lead', 'architecture_reviewer']
    case 'Closing':
      return ['proposal_owner', 'tech_lead']
    default:
      return []
  }
}

export function canSubmit(p: Proposal, conforming: boolean): boolean {
  return (p.state === 'Draft' || p.state === 'Returned') && conforming
}

export function canEditDraft(p: Proposal): boolean {
  return p.state === 'Draft' || p.state === 'Returned'
}

export function userMaySignoff(p: Proposal, userRoles: Role[]): Role[] {
  if (p.state !== 'Awaiting Signoff') return []
  const eligible = new Set([...p.requiredSignoffRoles, ...p.optionalSignoffRoles])
  return userRoles.filter((r) => eligible.has(r))
}
