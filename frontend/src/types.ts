// Domain types for the Proposal Pipeline frontend.
// These mirror docs/spec.md sections 5 and 8. The backend's Pydantic models
// are the source of truth; keep this file in step with them.

export const PROPOSAL_STATES = [
  'Draft',
  'In Review',
  'Returned',
  'Awaiting Signoff',
  'Rejected',
  'Approved',
  'Planning',
  'In Development',
  'Alignment Review',
  'Adjudication',
  'Closing',
  'Closed',
] as const
export type ProposalState = (typeof PROPOSAL_STATES)[number]

export const ROLES = [
  'submitter',
  'proposal_owner',
  'project_manager',
  'tech_lead',
  'architecture_reviewer',
  'external_customer',
  'admin',
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  submitter: 'Submitter',
  proposal_owner: 'Proposal Owner',
  project_manager: 'Project Manager',
  tech_lead: 'Tech Lead',
  architecture_reviewer: 'Architecture Reviewer',
  external_customer: 'External Customer',
  admin: 'Admin',
}

export const CHECK_STATUSES = ['Yes', 'Partial', 'No', 'N/A'] as const
export type CheckStatus = (typeof CHECK_STATUSES)[number]

export const RECOMMENDATIONS = ['Approve', 'Approve with conditions', 'Needs revision'] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

export type RequirementClass = 'Shall' | 'Should'

export const SIGNOFF_DECISIONS = ['approve', 'approve_with_conditions', 'return', 'reject'] as const
export type SignoffDecision = (typeof SIGNOFF_DECISIONS)[number]

export const SIGNOFF_DECISION_LABELS: Record<SignoffDecision, string> = {
  approve: 'Approve',
  approve_with_conditions: 'Approve with conditions',
  return: 'Return for revision',
  reject: 'Reject',
}

export type VersionSource = 'uploaded' | 'generated' | 'edited'
export type ConditionStatus = 'open' | 'resolved' | 'carried'
export type JobState = 'queued' | 'running' | 'succeeded' | 'failed'
export type JobType = 'reformat_proposal' | 'review_proposal'

export interface User {
  id: string
  username: string // DOMAIN\user
  displayName: string
  email: string
  roles: Role[]
  active: boolean
}

export interface Service {
  id: string
  name: string
  description: string
}

export interface ParsedRequirement {
  reqId: string
  text: string
  cls: RequirementClass | null
  notes: string
}

export interface ParsedProposal {
  conforming: boolean
  sectionsFound: string[]
  sectionsMissing: string[]
  documentControl: Record<string, string>
  requirements: ParsedRequirement[]
  problems: string[]
}

export interface ProposalVersion {
  id: string
  proposalId: string
  versionNo: number
  markdown: string
  parsed: ParsedProposal
  source: VersionSource
  templateVersion: string
  createdBy: string
  createdAt: string
}

export interface Requirement {
  id: string
  proposalId: string
  reqId: string
  text: string
  cls: RequirementClass | null
  notes: string
  status: 'active' | 'removed'
  firstVersionNo: number
  lastVersionNo: number
}

export interface Proposal {
  id: string
  code: string
  serviceId: string
  title: string
  state: ProposalState
  currentVersionId: string
  requiredSignoffRoles: Role[]
  optionalSignoffRoles: Role[]
  needsConfirmation: boolean
  submitterId: string
  createdAt: string
  updatedAt: string
  waitingOn: string
}

export interface ReviewCheck {
  id: string
  reviewId: string
  section: string
  check: string
  status: CheckStatus
  notes: string
  evidence: string
}

export interface PriorGap {
  text: string
  status: 'addressed' | 'still open'
}

export interface Review {
  id: string
  proposalId: string
  proposalVersionId: string
  versionNo: number
  kind: 'proposal' | 'alignment'
  recommendation: Recommendation
  modelRecommendation: Recommendation
  rationale: string
  strengths: string[]
  gaps: string[]
  model: string
  bundleVersion: string
  checklistVersion: string
  startedAt: string
  finishedAt: string
  reReviewOfReviewId: string | null
  priorGaps: PriorGap[]
}

export interface Condition {
  id: string
  reviewId: string
  proposalId: string
  text: string
  ownerRole: Role
  targetPhase: string
  blocking: boolean
  status: ConditionStatus
  notes: string
  resolvedNote: string | null
}

export interface Signoff {
  id: string
  proposalId: string
  proposalVersionId: string
  versionNo: number
  role: Role
  userId: string
  decision: SignoffDecision
  notes: string
  decidedAt: string
}

export interface Job {
  id: string
  type: JobType
  proposalId: string
  state: JobState
  attempts: number
  log: string
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  entityType: string
  entityId: string
  before: string | null
  after: string | null
  at: string
}

export interface ProposalDetail {
  proposal: Proposal
  service: Service
  versions: ProposalVersion[]
  requirements: Requirement[]
  reviews: Review[]
  checks: ReviewCheck[]
  conditions: Condition[]
  signoffs: Signoff[]
  jobs: Job[]
  audit: AuditEntry[]
}

export interface ProposalListItem {
  proposal: Proposal
  serviceName: string
  submitterName: string
  latestRecommendation: Recommendation | null
}

export interface CreateProposalInput {
  serviceId: string
  title: string
  markdown: string
  fileName?: string
}

export interface SignoffInput {
  decision: SignoffDecision
  notes: string
}
