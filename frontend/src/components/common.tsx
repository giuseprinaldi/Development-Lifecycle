import type { ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatDateTime } from '../lib/format'
import { STATE_DESCRIPTIONS } from '../lib/rules'
import type { CheckStatus, Job, ProposalState, Recommendation, Role, SignoffDecision } from '../types'
import { PROPOSAL_STATES, ROLE_LABELS, SIGNOFF_DECISION_LABELS } from '../types'

export function StateBadge({ state }: { state: ProposalState }) {
  const tone =
    state === 'Approved' || state === 'Closed'
      ? 'good'
      : state === 'Rejected'
        ? 'bad'
        : state === 'Returned'
          ? 'warn'
          : state === 'Awaiting Signoff' || state === 'Adjudication' || state === 'Planning' || state === 'Closing'
            ? 'accent'
            : ''
  return (
    <span className={`chip ${tone}`} title={STATE_DESCRIPTIONS[state]}>
      {state}
    </span>
  )
}

export function RecommendationChip({ value }: { value: Recommendation | null }) {
  if (!value) return <span className="chip dim">No review yet</span>
  const tone = value === 'Approve' ? 'good' : value === 'Approve with conditions' ? 'warn' : 'bad'
  return <span className={`chip ${tone}`}>{value}</span>
}

export function CheckChip({ status }: { status: CheckStatus }) {
  const tone = status === 'Yes' ? 'good' : status === 'Partial' ? 'warn' : status === 'No' ? 'bad' : 'dim'
  return <span className={`chip ${tone}`}>{status}</span>
}

export function DecisionChip({ decision }: { decision: SignoffDecision | null }) {
  if (!decision) return <span className="chip dim">Pending</span>
  const tone = decision === 'approve' ? 'good' : decision === 'approve_with_conditions' ? 'warn' : decision === 'return' ? 'warn' : 'bad'
  return <span className={`chip ${tone}`}>{SIGNOFF_DECISION_LABELS[decision]}</span>
}

export function RoleChips({ roles }: { roles: Role[] }) {
  if (!roles.length) return <span className="muted">none</span>
  return (
    <span className="chip-row">
      {roles.map((r) => (
        <span key={r} className="chip">
          {ROLE_LABELS[r]}
        </span>
      ))}
    </span>
  )
}

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="md">
      <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
    </div>
  )
}

export function JobLine({ job }: { job: Job }) {
  const label =
    job.type === 'reformat_proposal' ? 'Stage 1: reformat to template' : 'Stage 2: proposal review'
  const verb =
    job.state === 'queued' ? 'queued' : job.state === 'running' ? 'running' : job.state === 'succeeded' ? 'done' : 'failed'
  return (
    <div className="job">
      <span className={`dot ${job.state}`} />
      <span>
        <strong>{label}</strong> {verb}
        {job.finishedAt ? <span className="muted"> · {formatDateTime(job.finishedAt)}</span> : null}
        {job.error ? <span className="muted"> · {job.error}</span> : null}
      </span>
    </div>
  )
}

/** Where this proposal is along the full lifecycle. Later states are Phase 2+ and shown for orientation. */
export function StateStrip({ state }: { state: ProposalState }) {
  const main: ProposalState[] = PROPOSAL_STATES.filter((s) => s !== 'Returned' && s !== 'Rejected')
  const idx = main.indexOf(state)
  return (
    <div className="state-strip" aria-label="Lifecycle position">
      {main.map((s, i) => (
        <span key={s} style={{ display: 'contents' }}>
          <span className={`st ${i < idx ? 'done' : i === idx ? 'now' : ''}`}>{s}</span>
          {i < main.length - 1 ? <span className="arrow">→</span> : null}
        </span>
      ))}
      {state === 'Returned' || state === 'Rejected' ? (
        <span className={`st ${state === 'Rejected' ? '' : ''}`} style={{ marginLeft: '0.5rem', background: state === 'Rejected' ? 'var(--bad-weak)' : 'var(--warn-weak)', color: state === 'Rejected' ? 'var(--bad)' : 'var(--warn)' }}>
          currently {state}
        </span>
      ) : null}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : String(error)
  return <div className="alert bad">{msg}</div>
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {typeof t.count === 'number' ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
