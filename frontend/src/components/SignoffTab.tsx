import { useState } from 'react'
import { useSetSignoffRoles, useSignoff } from '../hooks/queries'
import { formatDateTime } from '../lib/format'
import { computeSignoffOutcome, userMaySignoff } from '../lib/rules'
import { ROLES, ROLE_LABELS, SIGNOFF_DECISIONS, SIGNOFF_DECISION_LABELS, type ProposalDetail, type Role, type SignoffDecision, type User } from '../types'
import { DecisionChip, ErrorNote, MarkdownView } from './common'

export function SignoffTab({ detail, me, users }: { detail: ProposalDetail; me: User; users: User[] }) {
  const { proposal, signoffs } = detail
  const current = detail.versions.find((v) => v.id === proposal.currentVersionId)
  const forVersion = signoffs.filter((s) => s.proposalVersionId === proposal.currentVersionId)
  const myRoles = userMaySignoff(proposal, me.roles)
  const signoff = useSignoff(proposal.id)
  const [decision, setDecision] = useState<SignoffDecision>('approve')
  const [notes, setNotes] = useState('')
  const [editRoles, setEditRoles] = useState(false)

  const outcome = computeSignoffOutcome(proposal.requiredSignoffRoles, forVersion)
  const nameOf = (id: string) => users.find((u) => u.id === id)?.displayName ?? id
  const allRoles: Role[] = [...proposal.requiredSignoffRoles, ...proposal.optionalSignoffRoles]
  const needsNotes = decision === 'return' || decision === 'reject'
  const previousVersionSignoffs = signoffs.filter((s) => s.proposalVersionId !== proposal.currentVersionId)

  return (
    <div className="stack">
      {proposal.state === 'Awaiting Signoff' ? (
        <div className="alert info">
          {outcome.state === 'Awaiting Signoff'
            ? `Waiting on ${outcome.missing.map((r) => ROLE_LABELS[r]).join(', ')}. When every required role has approved, the proposal moves to Approved.`
            : `Outcome: ${outcome.state}.`}
        </div>
      ) : proposal.state === 'Approved' ? (
        <div className="alert good">Approved by every required role. Delivery planning is the next step (Phase 2).</div>
      ) : proposal.state === 'Rejected' ? (
        <div className="alert bad">Rejected. This is terminal; a new proposal is needed to try again.</div>
      ) : (
        <div className="alert info">Signoff opens once the review recommends Approve or Approve with conditions. Current state: {proposal.state}.</div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: '0.5rem' }}>
          <h3 className="mb0">Decisions on version {current?.versionNo ?? '?'}</h3>
          <span className="spacer" />
          {me.roles.includes('admin') ? (
            <button className="btn sm" onClick={() => setEditRoles((v) => !v)}>
              {editRoles ? 'Done' : 'Edit required roles'}
            </button>
          ) : null}
        </div>
        {editRoles ? <RolesEditor detail={detail} onDone={() => setEditRoles(false)} /> : null}
        <table className="data">
          <thead>
            <tr>
              <th>Role</th>
              <th>Required</th>
              <th>Decision</th>
              <th>Name</th>
              <th>Date</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {allRoles.map((role) => {
              const s = forVersion.find((x) => x.role === role)
              return (
                <tr key={role}>
                  <td>
                    <strong>{ROLE_LABELS[role]}</strong>
                  </td>
                  <td>{proposal.requiredSignoffRoles.includes(role) ? 'Required' : <span className="muted">Optional</span>}</td>
                  <td>
                    <DecisionChip decision={s?.decision ?? null} />
                  </td>
                  <td>{s ? nameOf(s.userId) : <span className="muted">—</span>}</td>
                  <td className="muted">{s ? formatDateTime(s.decidedAt) : ''}</td>
                  <td>{s?.notes}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {myRoles.length ? (
        <div className="card">
          <h3>
            Your decision <span className="muted">as {myRoles.map((r) => ROLE_LABELS[r]).join(' and ')}</span>
          </h3>
          <div className="checks" style={{ marginBottom: '0.75rem' }}>
            {SIGNOFF_DECISIONS.map((d) => (
              <label key={d}>
                <input type="radio" name="decision" checked={decision === d} onChange={() => setDecision(d)} /> {SIGNOFF_DECISION_LABELS[d]}
              </label>
            ))}
          </div>
          <label className="field">
            <span>Notes {needsNotes ? '(required for return and reject)' : '(optional)'}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} />
          </label>
          {decision === 'reject' ? <div className="alert bad" style={{ marginBottom: '0.75rem' }}>Reject is terminal. The AI never recommends it; only a person can. Return instead if the proposal should come back revised.</div> : null}
          <div className="row">
            <button className={`btn ${decision === 'reject' ? 'danger' : 'primary'}`} onClick={() => signoff.mutate({ decision, notes }, { onSuccess: () => setNotes('') })} disabled={signoff.isPending || (needsNotes && !notes.trim())}>
              {signoff.isPending ? 'Recording…' : `Record ${SIGNOFF_DECISION_LABELS[decision].toLowerCase()}`}
            </button>
            {forVersion.some((s) => myRoles.includes(s.role)) ? <span className="muted">You already decided on this version; recording again replaces it.</span> : null}
          </div>
          <ErrorNote error={signoff.error} />
        </div>
      ) : proposal.state === 'Awaiting Signoff' ? (
        <div className="card">
          <p className="muted mb0">You do not hold a signoff role on this proposal. Roles: {me.roles.map((r) => ROLE_LABELS[r]).join(', ') || 'none'}.</p>
        </div>
      ) : null}

      {previousVersionSignoffs.length ? (
        <div className="card">
          <h3>Earlier versions</h3>
          <table className="data">
            <tbody>
              {previousVersionSignoffs.map((s) => (
                <tr key={s.id}>
                  <td className="num">v{s.versionNo}</td>
                  <td>{ROLE_LABELS[s.role]}</td>
                  <td>
                    <DecisionChip decision={s.decision} />
                  </td>
                  <td>{nameOf(s.userId)}</td>
                  <td className="muted">{formatDateTime(s.decidedAt)}</td>
                  <td>{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {current ? (
        <div className="card">
          <h3>The proposal being signed off</h3>
          <MarkdownView source={current.markdown} />
        </div>
      ) : null}
    </div>
  )
}

function RolesEditor({ detail, onDone }: { detail: ProposalDetail; onDone: () => void }) {
  const { proposal } = detail
  const [required, setRequired] = useState<Role[]>(proposal.requiredSignoffRoles)
  const [optional, setOptional] = useState<Role[]>(proposal.optionalSignoffRoles)
  const save = useSetSignoffRoles(proposal.id)
  const candidates = ROLES.filter((r) => r !== 'admin' && r !== 'submitter')
  const toggle = (list: Role[], set: (v: Role[]) => void, r: Role) => set(list.includes(r) ? list.filter((x) => x !== r) : [...list, r])
  return (
    <div className="alert info" style={{ marginBottom: '0.75rem' }}>
      <div className="grid-2">
        <div>
          <strong>Required</strong>
          <div className="checks">
            {candidates.map((r) => (
              <label key={r}>
                <input type="checkbox" checked={required.includes(r)} onChange={() => toggle(required, setRequired, r)} /> {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <strong>Optional</strong>
          <div className="checks">
            {candidates.map((r) => (
              <label key={r}>
                <input type="checkbox" checked={optional.includes(r)} disabled={required.includes(r)} onChange={() => toggle(optional, setOptional, r)} /> {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="row mt">
        <button className="btn primary sm" onClick={() => save.mutate({ required, optional }, { onSuccess: onDone })} disabled={save.isPending || !required.length}>
          Save roles
        </button>
        <ErrorNote error={save.error} />
      </div>
    </div>
  )
}
