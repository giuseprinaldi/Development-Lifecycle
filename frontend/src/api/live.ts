// Live client: talks to the FastAPI backend at /api on the same origin.
// IIS (production) or the Vite dev proxy (development) forwards these calls.
// Windows Authentication happens before the request reaches us, so there is
// no login flow here: /api/me simply reports who IIS says you are.

import type {
  Condition,
  ConditionStatus,
  CreateProposalInput,
  Job,
  ProposalDetail,
  ProposalListItem,
  Role,
  Service,
  SignoffInput,
  User,
} from '../types'
import { ApiError, type ApiClient, type ProposalFilter } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'same-origin',
  })
  if (!res.ok) {
    let detail: unknown = undefined
    try {
      detail = await res.json()
    } catch {
      /* no body */
    }
    const message =
      typeof detail === 'object' && detail && 'detail' in detail
        ? String((detail as { detail: unknown }).detail)
        : `${res.status} ${res.statusText}`
    throw new ApiError(res.status, message, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })
const patch = (body: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(body) })
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) })

export const liveClient: ApiClient = {
  mode: 'live',

  me: () => request<User>('/me'),
  listUsers: () => request<User[]>('/admin/users'),
  setUserRoles: (userId, roles) => request<User>(`/admin/users/${userId}/roles`, put({ roles })),

  listServices: () => request<Service[]>('/services'),

  listProposals: (filter: ProposalFilter = {}) => {
    const q = new URLSearchParams()
    if (filter.state && filter.state !== 'all') q.set('state', filter.state)
    if (filter.serviceId) q.set('service_id', filter.serviceId)
    if (filter.mine) q.set('mine', 'true')
    const qs = q.toString()
    return request<ProposalListItem[]>(`/proposals${qs ? `?${qs}` : ''}`)
  },
  getProposal: (id) => request<ProposalDetail>(`/proposals/${id}`),
  createProposal: (input: CreateProposalInput) => request<ProposalDetail>('/proposals', json(input)),
  updateDraft: (id, markdown) => request<ProposalDetail>(`/proposals/${id}/draft`, put({ markdown })),
  confirmDraft: (id) => request<ProposalDetail>(`/proposals/${id}/confirm-draft`, json({})),
  submit: (id) => request<ProposalDetail>(`/proposals/${id}/submit`, json({})),
  signoff: (id, input: SignoffInput) => request<ProposalDetail>(`/proposals/${id}/signoff`, json(input)),
  setSignoffRoles: (id, required: Role[], optional: Role[]) =>
    request<ProposalDetail>(`/proposals/${id}/signoff-roles`, put({ required, optional })),

  updateCondition: (conditionId, status: ConditionStatus, note) =>
    request<Condition>(`/conditions/${conditionId}`, patch({ status, note })),

  getJob: (id) => request<Job>(`/jobs/${id}`),
  retryJob: (id) => request<Job>(`/jobs/${id}/retry`, json({})),

  switchUser: async () => {
    throw new ApiError(400, 'Switching users is only available in mock mode.')
  },
  listSwitchableUsers: async () => {
    throw new ApiError(400, 'Switching users is only available in mock mode.')
  },
  resetMockData: async () => {
    throw new ApiError(400, 'Resetting data is only available in mock mode.')
  },
}
