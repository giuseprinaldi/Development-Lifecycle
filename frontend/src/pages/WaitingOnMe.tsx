import { Link } from 'react-router-dom'
import { Empty, ErrorNote, RecommendationChip, StateBadge } from '../components/common'
import { useMe, useProposals } from '../hooks/queries'
import { relativeTime } from '../lib/format'
import { ROLE_LABELS, type Role } from '../types'

export function WaitingOnMe() {
  const me = useMe()
  const q = useProposals({ state: 'all' })
  const myRoles = new Set<Role>(me.data?.roles ?? [])

  const items = (q.data ?? []).filter(({ proposal: p }) => {
    if (p.state === 'Awaiting Signoff') {
      const waiting = p.waitingOn.split(',').map((s) => s.trim()).filter(Boolean)
      return [...myRoles].some((r) => waiting.includes(ROLE_LABELS[r]) || waiting.includes(r))
    }
    if ((p.state === 'Draft' || p.state === 'Returned') && p.submitterId === me.data?.id) return true
    return false
  })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Waiting on me</h1>
          <div className="sub">
            Proposals that need a decision or an edit from you as {[...myRoles].map((r) => ROLE_LABELS[r]).join(', ') || 'your roles'}.
          </div>
        </div>
      </div>
      <div className="card">
        <ErrorNote error={q.error} />
        {q.isLoading ? (
          <Empty>Loading…</Empty>
        ) : !items.length ? (
          <Empty>Nothing is waiting on you.</Empty>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Service</th>
                <th>State</th>
                <th>Review</th>
                <th>What's needed</th>
                <th className="right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ proposal: p, serviceName, latestRecommendation }) => (
                <tr key={p.id}>
                  <td className="num">
                    <Link to={`/proposals/${p.id}`} className="rowlink">
                      {p.code}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/proposals/${p.id}?tab=${p.state === 'Awaiting Signoff' ? 'signoff' : 'draft'}`} className="rowlink">
                      {p.title}
                    </Link>
                  </td>
                  <td>{serviceName}</td>
                  <td>
                    <StateBadge state={p.state} />
                  </td>
                  <td>
                    <RecommendationChip value={latestRecommendation} />
                  </td>
                  <td>{p.state === 'Awaiting Signoff' ? 'Your signoff decision' : p.state === 'Returned' ? 'Revise and resubmit' : p.needsConfirmation ? 'Confirm the reformatted draft' : 'Finish and submit the draft'}</td>
                  <td className="right muted">{relativeTime(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
