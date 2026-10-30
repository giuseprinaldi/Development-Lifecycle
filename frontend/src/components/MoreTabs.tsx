import { useState } from 'react'
import { useRetryJob, useUpdateCondition } from '../hooks/queries'
import { formatDateTime } from '../lib/format'
import { ROLE_LABELS, type Condition, type ProposalDetail, type User } from '../types'
import { Empty, ErrorNote, JobLine } from './common'

export function RequirementsTab({ detail }: { detail: ProposalDetail }) {
  const reqs = [...detail.requirements].sort((a, b) => a.reqId.localeCompare(b.reqId, undefined, { numeric: true }))
  if (!reqs.length) return <div className="card"><Empty>No requirements parsed yet. Section 9 of the proposal needs rows like <code>| R-01 | The service shall … | Shall | |</code>.</Empty></div>
  return (
    <div className="card">
      <h3>Requirements</h3>
      <p className="meta">The traceable unit. IDs stay stable across versions; in later phases each becomes a story's acceptance criterion and a row in the alignment review.</p>
      <table className="data">
        <thead>
          <tr>
            <th>ID</th>
            <th>Class</th>
            <th>Requirement</th>
            <th>Notes</th>
            <th>Versions</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {reqs.map((r) => (
            <tr key={r.id} style={r.status === 'removed' ? { opacity: 0.55 } : undefined}>
              <td className="num">{r.reqId}</td>
              <td>{r.cls ? <span className={`chip ${r.cls === 'Shall' ? 'accent' : ''}`}>{r.cls}</span> : <span className="chip bad">none</span>}</td>
              <td>{r.text}</td>
              <td className="muted">{r.notes}</td>
              <td className="num muted">
                v{r.firstVersionNo}
                {r.lastVersionNo !== r.firstVersionNo ? `–v${r.lastVersionNo}` : ''}
              </td>
              <td>{r.status === 'active' ? <span className="chip good">active</span> : <span className="chip dim">removed</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ConditionsTab({ detail, me }: { detail: ProposalDetail; me: User }) {
  const update = useUpdateCondition(detail.proposal.id)
  const canEdit = me.roles.some((r) => r === 'tech_lead' || r === 'project_manager' || r === 'admin')
  const [noteFor, setNoteFor] = useState<Record<string, string>>({})
  const conditions = detail.conditions
  if (!conditions.length) return <div className="card"><Empty>No conditions. They appear when a review marks a check Partial.</Empty></div>

  const act = (c: Condition, status: Condition['status']) => update.mutate({ conditionId: c.id, status, note: noteFor[c.id] ?? '' })

  return (
    <div className="card">
      <h3>Conditions</h3>
      <p className="meta">Blocking conditions must be resolved before planning closes. Carried conditions travel into the next phase and the carry-forward baseline.</p>
      <ErrorNote error={update.error} />
      <table className="data">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Owner</th>
            <th>Blocking</th>
            <th>Status</th>
            {canEdit ? <th>Action</th> : null}
          </tr>
        </thead>
        <tbody>
          {conditions.map((c) => (
            <tr key={c.id}>
              <td>
                {c.text}
                {c.resolvedNote ? <div className="muted">Resolved: {c.resolvedNote}</div> : null}
              </td>
              <td>{ROLE_LABELS[c.ownerRole]}</td>
              <td>{c.blocking ? <span className="chip bad">Yes</span> : <span className="chip dim">No</span>}</td>
              <td>
                <span className={`chip ${c.status === 'resolved' ? 'good' : c.status === 'carried' ? 'accent' : 'warn'}`}>{c.status}</span>
              </td>
              {canEdit ? (
                <td>
                  {c.status !== 'resolved' ? (
                    <div className="row">
                      <input type="text" placeholder="Resolution note" value={noteFor[c.id] ?? ''} onChange={(e) => setNoteFor({ ...noteFor, [c.id]: e.target.value })} style={{ width: 220 }} />
                      <button className="btn sm" onClick={() => act(c, 'resolved')} disabled={!(noteFor[c.id] ?? '').trim() || update.isPending}>
                        Resolve
                      </button>
                      {c.status === 'open' ? (
                        <button className="btn sm" onClick={() => act(c, 'carried')} disabled={update.isPending}>
                          Carry
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button className="btn sm ghost" onClick={() => act(c, 'open')} disabled={update.isPending}>
                      Reopen
                    </button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ActivityTab({ detail }: { detail: ProposalDetail }) {
  const retry = useRetryJob(detail.proposal.id)
  return (
    <div className="stack">
      <div className="card">
        <h3>Stage runs</h3>
        {detail.jobs.length ? (
          <div className="stack">
            {[...detail.jobs].reverse().map((j) => (
              <div key={j.id}>
                <div className="row">
                  <JobLine job={j} />
                  <span className="spacer" />
                  {j.state === 'failed' ? (
                    <button className="btn sm" onClick={() => retry.mutate(j.id)} disabled={retry.isPending}>
                      Retry
                    </button>
                  ) : null}
                </div>
                {j.log ? <pre style={{ marginTop: '0.4rem' }}>{j.log}</pre> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted mb0">No AI stages have run for this proposal.</p>
        )}
      </div>
      <div className="card">
        <h3>Audit trail</h3>
        <ul className="timeline">
          {detail.audit.map((a) => (
            <li key={a.id}>
              <span className="when">{formatDateTime(a.at)}</span>
              <span className="what">
                <strong>{a.actor}</strong> {a.action.replace(/[._]/g, ' ')}
                {a.before || a.after ? (
                  <small>
                    {a.before ? `${a.before} → ` : ''}
                    {a.after}
                  </small>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
