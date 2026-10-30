import { useMemo, useState } from 'react'
import { useConfirmDraft, useSubmit, useUpdateDraft } from '../hooks/queries'
import { canEditDraft } from '../lib/rules'
import { parseProposal } from '../lib/template'
import type { ProposalDetail, User } from '../types'
import { ErrorNote, MarkdownView } from './common'

// Rendered with key={currentVersionId} by the parent so editor state resets per version.
export function DraftTab({ detail, me }: { detail: ProposalDetail; me: User }) {
  const { proposal, versions } = detail
  const current = versions.find((v) => v.id === proposal.currentVersionId) ?? versions[versions.length - 1]
  const [text, setText] = useState(current?.markdown ?? '')
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const update = useUpdateDraft(proposal.id)
  const confirm = useConfirmDraft(proposal.id)
  const submit = useSubmit(proposal.id)

  const parsed = useMemo(() => parseProposal(text), [text])
  const dirty = text !== (current?.markdown ?? '')
  const editable = canEditDraft(proposal) && (proposal.submitterId === me.id || me.roles.includes('admin'))
  const activeJob = detail.jobs.find((j) => j.state === 'queued' || j.state === 'running')
  const lastReview = [...detail.reviews].reverse()[0]

  if (!current) return <div className="alert bad">This proposal has no version yet.</div>

  const submitBlockers: string[] = []
  if (!parsed.conforming) submitBlockers.push(parsed.sectionsMissing.length ? `Missing: ${parsed.sectionsMissing.join('; ')}` : 'Section 9 has no requirement rows')
  if (dirty) submitBlockers.push('Save your edits first')
  if (proposal.needsConfirmation) submitBlockers.push('Confirm the reformatted draft')
  if (activeJob) submitBlockers.push('A stage is still running')

  return (
    <div className="stack">
      {activeJob ? (
        <div className="alert info">
          {activeJob.type === 'reformat_proposal' ? 'Stage 1 is reformatting the proposal into the template. ' : 'Stage 2 is reviewing the proposal. '}
          This page updates on its own when it finishes.
        </div>
      ) : null}

      {proposal.needsConfirmation && editable ? (
        <div className="alert warn">
          <strong>Review the reformatted draft before submitting.</strong> Stage 1 rewrote your text into the template and marked anything it could not find as <em>Unresolved</em>. Edit what you need, then confirm. You are the author of record, not the AI.
          <div className="row mt">
            <button className="btn primary sm" onClick={() => confirm.mutate()} disabled={confirm.isPending || dirty}>
              I've reviewed it, confirm this draft
            </button>
            {dirty ? <span className="muted">Save your edits first.</span> : null}
          </div>
        </div>
      ) : null}

      {proposal.state === 'Returned' && lastReview ? (
        <div className="alert warn">
          <strong>Returned for revision.</strong> {lastReview.rationale}
          {lastReview.gaps.length ? (
            <ul style={{ marginBottom: 0 }}>
              {lastReview.gaps.slice(0, 6).map((g) => (
                <li key={g}>{g}</li>
              ))}
              {lastReview.gaps.length > 6 ? <li className="muted">and {lastReview.gaps.length - 6} more on the Review tab</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <h3 className="mb0">
            Version {current.versionNo} <span className="muted">· {current.source}</span>
          </h3>
          <span className="spacer" />
          {editable ? (
            <>
              <button className={`btn sm ${mode === 'preview' ? 'primary' : ''}`} onClick={() => setMode('preview')}>
                Preview
              </button>
              <button className={`btn sm ${mode === 'edit' ? 'primary' : ''}`} onClick={() => setMode('edit')}>
                Edit
              </button>
            </>
          ) : null}
        </div>

        {mode === 'edit' && editable ? (
          <div className="grid-2">
            <div>
              <textarea className="mono" value={text} onChange={(e) => setText(e.target.value)} aria-label="Proposal markdown" />
              <div className="row mt">
                <button className="btn primary" onClick={() => update.mutate(text)} disabled={!dirty || update.isPending}>
                  {update.isPending ? 'Saving…' : `Save as version ${current.versionNo + 1}`}
                </button>
                <button className="btn" onClick={() => setText(current.markdown)} disabled={!dirty}>
                  Discard changes
                </button>
                <span className="muted">Every save is a new version. Requirement IDs (R-01…) stay linked across versions.</span>
              </div>
              <ErrorNote error={update.error} />
            </div>
            <div>
              <ConformancePanel parsed={parsed} />
            </div>
          </div>
        ) : (
          <MarkdownView source={current.markdown} />
        )}
      </div>

      {editable ? (
        <div className="card">
          <div className="row">
            <div>
              <h3 className="mb0">Submit for review</h3>
              <div className="meta">Runs Stage 2 against the review checklist. {proposal.state === 'Returned' ? 'This is a resubmission, so the reviewer sees the prior review and reports which gaps were addressed.' : ''}</div>
            </div>
            <span className="spacer" />
            <button className="btn primary" onClick={() => submit.mutate()} disabled={submitBlockers.length > 0 || submit.isPending} title={submitBlockers.join('. ')}>
              {submit.isPending ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
          {submitBlockers.length ? (
            <ul className="muted" style={{ marginBottom: 0 }}>
              {submitBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          <ErrorNote error={submit.error} />
          <ErrorNote error={confirm.error} />
        </div>
      ) : null}
    </div>
  )
}

export function ConformancePanel({ parsed }: { parsed: ReturnType<typeof parseProposal> }) {
  return (
    <div>
      {parsed.conforming ? (
        <div className="alert good">Conforms to the template. {parsed.requirements.length} requirement rows.</div>
      ) : (
        <div className="alert warn">Not yet conforming.</div>
      )}
      {parsed.sectionsMissing.length ? (
        <>
          <h4 className="mt mb0">Missing sections</h4>
          <ul>
            {parsed.sectionsMissing.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      ) : null}
      {parsed.problems.length ? (
        <>
          <h4 className="mt mb0">Requirement problems</h4>
          <ul>
            {parsed.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : null}
      {parsed.requirements.length ? (
        <>
          <h4 className="mt mb0">Requirements parsed</h4>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Class</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              {parsed.requirements.map((r) => (
                <tr key={r.reqId}>
                  <td className="num">{r.reqId}</td>
                  <td>{r.cls ?? <span className="chip bad">none</span>}</td>
                  <td>{r.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  )
}
