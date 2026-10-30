import { describe, expect, it } from 'vitest'
import { computeRecommendation, computeSignoffOutcome } from './rules'

describe('computeRecommendation (spec section 8)', () => {
  it('any No means Needs revision regardless of other checks', () => {
    expect(
      computeRecommendation([
        { section: 'Scope Quality', status: 'Yes' },
        { section: 'Solution Framing', status: 'No' },
        { section: 'Approval Readiness', status: 'Partial' },
      ]),
    ).toBe('Needs revision')
  })
  it('Partials without a No mean Approve with conditions', () => {
    expect(computeRecommendation([{ section: 'A', status: 'Yes' }, { section: 'B', status: 'Partial' }])).toBe('Approve with conditions')
  })
  it('all Yes or N/A means Approve', () => {
    expect(computeRecommendation([{ section: 'A', status: 'Yes' }, { section: 'B', status: 'N/A' }])).toBe('Approve')
  })
})

describe('computeSignoffOutcome (spec section 7)', () => {
  const required = ['proposal_owner', 'project_manager', 'tech_lead', 'architecture_reviewer'] as const
  it('waits until every required role has decided', () => {
    const o = computeSignoffOutcome([...required], [{ role: 'tech_lead', decision: 'approve' }])
    expect(o.state).toBe('Awaiting Signoff')
    if (o.state === 'Awaiting Signoff') expect(o.missing).toEqual(['proposal_owner', 'project_manager', 'architecture_reviewer'])
  })
  it('any return wins over approvals', () => {
    const o = computeSignoffOutcome([...required], [
      { role: 'tech_lead', decision: 'approve' },
      { role: 'project_manager', decision: 'return' },
    ])
    expect(o.state).toBe('Returned')
  })
  it('any reject wins over a return', () => {
    const o = computeSignoffOutcome([...required], [
      { role: 'tech_lead', decision: 'reject' },
      { role: 'project_manager', decision: 'return' },
    ])
    expect(o.state).toBe('Rejected')
  })
  it('approve with conditions counts as approval; optional roles are ignored', () => {
    const o = computeSignoffOutcome([...required], [
      { role: 'proposal_owner', decision: 'approve' },
      { role: 'project_manager', decision: 'approve_with_conditions' },
      { role: 'tech_lead', decision: 'approve' },
      { role: 'architecture_reviewer', decision: 'approve' },
      { role: 'external_customer', decision: 'reject' },
    ])
    expect(o.state).toBe('Approved')
  })
})
