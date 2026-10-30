import { describe, expect, it } from 'vitest'
import { PROPOSAL_ALERT_ROUTING_RAW, PROPOSAL_RECONCILIATION } from '../api/mock/fixtures'
import { mockReformat, mockReview } from '../api/mock/review'
import { blankTemplate, parseProposal } from './template'

describe('parseProposal', () => {
  it('accepts the fixture proposal as conforming', () => {
    const p = parseProposal(PROPOSAL_RECONCILIATION)
    expect(p.conforming).toBe(true)
    expect(p.sectionsMissing).toEqual([])
    expect(p.requirements.map((r) => r.reqId)).toEqual(['R-01', 'R-02', 'R-03', 'R-04', 'R-05'])
    expect(p.requirements[3].cls).toBe('Should')
    expect(p.documentControl['Proposal Owner']).toBe('Sam Okafor')
  })

  it('reports free text as nonconforming with the missing sections', () => {
    const p = parseProposal(PROPOSAL_ALERT_ROUTING_RAW)
    expect(p.conforming).toBe(false)
    expect(p.sectionsMissing).toContain('Document Control')
    expect(p.sectionsMissing).toContain('9. Initial Requirements / Expectations')
    expect(p.sectionsMissing).not.toContain('10. Open Notes / Unknowns (Optional)')
  })

  it('treats a template with no requirement rows as nonconforming', () => {
    const md = blankTemplate('X', 'Y').replace(/\| R-0[12] \|[^\n]*\n/g, '')
    const p = parseProposal(md)
    expect(p.sectionsMissing).toEqual([])
    expect(p.conforming).toBe(false)
  })

  it('flags must/may wording and class mismatches', () => {
    const md = PROPOSAL_RECONCILIATION.replace(
      '| R-04 | The service should flag runs that exceed the scheduler window and notify the on-call engineer. | Should | |',
      '| R-04 | The service must flag long runs. | Shall | |',
    )
    const p = parseProposal(md)
    expect(p.problems.some((x) => x.includes('R-04') && x.includes('must'))).toBe(true)
  })
})

describe('mockReformat', () => {
  it('produces a conforming proposal from free text and keeps unknowns visible', () => {
    const md = mockReformat(PROPOSAL_ALERT_ROUTING_RAW, 'Alert routing', 'Riley Brooks')
    const p = parseProposal(md)
    expect(p.conforming).toBe(true)
    expect(md).toContain('Unresolved')
    expect(p.requirements.length).toBeGreaterThan(0)
  })
})

describe('mockReview', () => {
  it('scores the fixture proposal with no failed checks', () => {
    const parsed = parseProposal(PROPOSAL_RECONCILIATION)
    const r = mockReview(PROPOSAL_RECONCILIATION, parsed)
    expect(r.checks).toHaveLength(33)
    expect(r.checks.filter((c) => c.status === 'No')).toHaveLength(0)
    expect(r.conditions.length).toBeGreaterThan(0)
  })
})
