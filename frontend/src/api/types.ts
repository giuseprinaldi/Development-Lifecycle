import type {
  Condition,
  ConditionStatus,
  CreateProposalInput,
  Job,
  ProposalDetail,
  ProposalListItem,
  ProposalState,
  Role,
  Service,
  SignoffInput,
  User,
} from '../types'

export interface ProposalFilter {
  state?: ProposalState | 'all'
  serviceId?: string
  mine?: boolean
}

/**
 * Everything the UI needs from the server. The live client maps each method
 * to a /api route (see live.ts); the mock client implements the same contract
 * in memory so the app runs with no backend.
 */
export interface ApiClient {
  readonly mode: 'mock' | 'live'

  me(): Promise<User>
  listUsers(): Promise<User[]>
  setUserRoles(userId: string, roles: Role[]): Promise<User>

  listServices(): Promise<Service[]>

  listProposals(filter?: ProposalFilter): Promise<ProposalListItem[]>
  getProposal(id: string): Promise<ProposalDetail>
  createProposal(input: CreateProposalInput): Promise<ProposalDetail>
  updateDraft(id: string, markdown: string): Promise<ProposalDetail>
  confirmDraft(id: string): Promise<ProposalDetail>
  submit(id: string): Promise<ProposalDetail>
  signoff(id: string, input: SignoffInput): Promise<ProposalDetail>
  setSignoffRoles(id: string, required: Role[], optional: Role[]): Promise<ProposalDetail>

  updateCondition(conditionId: string, status: ConditionStatus, note: string): Promise<Condition>

  getJob(id: string): Promise<Job>
  retryJob(id: string): Promise<Job>

  /** Mock only: act as a different fixture user. Live client throws. */
  switchUser(userId: string): Promise<User>
  /** Mock only: the fixture users anyone may switch to. Live client throws. */
  listSwitchableUsers(): Promise<User[]>
  /** Mock only: wipe local state back to fixtures. */
  resetMockData(): Promise<void>
}

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}
