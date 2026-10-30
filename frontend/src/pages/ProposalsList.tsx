import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, ErrorNote, RecommendationChip, StateBadge } from '../components/common'
import { useMe, useProposals, useServices } from '../hooks/queries'
import { relativeTime } from '../lib/format'
import { PROPOSAL_STATES, type ProposalState } from '../types'

export function ProposalsList() {
  const [state, setState] = useState<ProposalState | 'all'>('all')
  const [serviceId, setServiceId] = useState('')
  const [mine, setMine] = useState(false)
  const me = useMe()
  const services = useServices()
  const q = useProposals({ state, serviceId: serviceId || undefined, mine })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Proposals</h1>
          <div className="sub">Every proposal in the pipeline, newest activity first.</div>
        </div>
        <Link to="/proposals/new" className="btn primary">
          New proposal
        </Link>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: '0.75rem' }}>
          <select value={state} onChange={(e) => setState(e.target.value as ProposalState | 'all')} style={{ width: 'auto' }} aria-label="Filter by state">
            <option value="all">All states</option>
            {PROPOSAL_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} style={{ width: 'auto' }} aria-label="Filter by service">
            <option value="">All services</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="checks">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Submitted by me
          </label>
          <span className="spacer" />
          <span className="muted">{q.data ? `${q.data.length} shown` : ''}</span>
        </div>
        <ErrorNote error={q.error} />
        {q.isLoading ? (
          <Empty>Loading…</Empty>
        ) : !q.data?.length ? (
          <Empty>No proposals match. {me.data ? <Link to="/proposals/new">Start one.</Link> : null}</Empty>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Service</th>
                <th>State</th>
                <th>Last review</th>
                <th>Waiting on</th>
                <th>Submitted by</th>
                <th className="right">Updated</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map(({ proposal: p, serviceName, submitterName, latestRecommendation }) => (
                <tr key={p.id}>
                  <td className="num">
                    <Link to={`/proposals/${p.id}`} className="rowlink">
                      {p.code}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/proposals/${p.id}`} className="rowlink">
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
                  <td className="muted">{p.waitingOn || '—'}</td>
                  <td>{submitterName}</td>
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
