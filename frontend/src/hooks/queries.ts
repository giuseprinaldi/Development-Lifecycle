// TanStack Query hooks. Every mutation invalidates the proposal it touched
// and the list, so screens stay in step without manual refetching.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ProposalFilter } from '../api/client'
import type { ConditionStatus, CreateProposalInput, Role, SignoffInput } from '../types'

export const keys = {
  me: ['me'] as const,
  users: ['users'] as const,
  services: ['services'] as const,
  proposals: (filter: ProposalFilter) => ['proposals', filter] as const,
  proposal: (id: string) => ['proposal', id] as const,
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.me(), staleTime: 60_000 })
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api.listUsers() })
}

export function useServices() {
  return useQuery({ queryKey: keys.services, queryFn: () => api.listServices(), staleTime: 5 * 60_000 })
}

export function useProposals(filter: ProposalFilter) {
  return useQuery({ queryKey: keys.proposals(filter), queryFn: () => api.listProposals(filter) })
}

/** Polls while a job is active so stage progress shows without a manual refresh. */
export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: keys.proposal(id ?? ''),
    queryFn: () => api.getProposal(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const d = query.state.data
      const active = d?.jobs.some((j) => j.state === 'queued' || j.state === 'running')
      return active ? 1500 : false
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return (id?: string) => {
    void qc.invalidateQueries({ queryKey: ['proposals'] })
    if (id) void qc.invalidateQueries({ queryKey: keys.proposal(id) })
  }
}

export function useCreateProposal() {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateProposalInput) => api.createProposal(input),
    onSuccess: (d) => inv(d.proposal.id),
  })
}

export function useUpdateDraft(id: string) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (markdown: string) => api.updateDraft(id, markdown), onSuccess: () => inv(id) })
}

export function useConfirmDraft(id: string) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: () => api.confirmDraft(id), onSuccess: () => inv(id) })
}

export function useSubmit(id: string) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: () => api.submit(id), onSuccess: () => inv(id) })
}

export function useSignoff(id: string) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (input: SignoffInput) => api.signoff(id, input), onSuccess: () => inv(id) })
}

export function useSetSignoffRoles(id: string) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { required: Role[]; optional: Role[] }) => api.setSignoffRoles(id, v.required, v.optional),
    onSuccess: () => inv(id),
  })
}

export function useUpdateCondition(proposalId: string) {
  const inv = useInvalidate()
  return useMutation({
    mutationFn: (v: { conditionId: string; status: ConditionStatus; note: string }) => api.updateCondition(v.conditionId, v.status, v.note),
    onSuccess: () => inv(proposalId),
  })
}

export function useRetryJob(proposalId: string) {
  const inv = useInvalidate()
  return useMutation({ mutationFn: (jobId: string) => api.retryJob(jobId), onSuccess: () => inv(proposalId) })
}

export function useSetUserRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { userId: string; roles: Role[] }) => api.setUserRoles(v.userId, v.roles),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.users })
      void qc.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useSwitchableUsers(enabled: boolean) {
  return useQuery({ queryKey: ['switchable-users'], queryFn: () => api.listSwitchableUsers(), enabled, staleTime: 5 * 60_000 })
}

export function useSwitchUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.switchUser(userId),
    onSuccess: () => void qc.invalidateQueries(),
  })
}

export function useResetMock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.resetMockData(),
    onSuccess: () => void qc.invalidateQueries(),
  })
}
