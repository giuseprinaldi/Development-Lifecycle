import { useState } from 'react'
import { formatDateTime } from '../lib/format'
import type { ProposalDetail, Review } from '../types'
import { CheckChip, Empty, RecommendationChip } from './common'

export function ReviewTab({ detail }: { detail: ProposalDetail }) {
  const reviews = [...detail.reviews].reverse()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const review: Review | undefined = reviews.find((r) => r.id === selectedId) ?? reviews[0]
  const running = detail.jobs.find((j) => j.type === 'review_proposal' && (j.state === 'queued' || j.state === 'running'))

  if (!review) {
    return (
      <div className="card">
        <Empty>{running ? 'Stage 2 is running. The scorecard appears here when it finishes.' : 'No review yet. Submit the proposal to run Stage 2.'}</Empty>
      </div>
    )
  }

  const checks = detail.checks.filter((c) => c.reviewId === review.id)
  const sections = [...new Set(checks.map((c) => c.section))]
  const counts = {
    Yes: checks.filter((c) => c.status === 'Yes').length,
    Partial: checks.filter((c) => c.status === 'Partial').length,
    No: checks.filter((c) => c.status === 'No').length,
    'N/A': checks.filter((c) => c.status === 'N/A').length,
  }
  const conditions = detail.conditions.filter((c) => c.reviewId === review.id)

  return (
    <div className="stack">
      {running ? <div className="alert info">A new review is running. This shows the previous result until it finishes.</div> : null}

      <div className="card">
        <div className="row" style={{ marginBottom: '0.5rem' }}>
          <h3 className="mb0">Review of version {review.versionNo}</h3>
          <RecommendationChip value={review.recommendation} />
          {review.modelRecommendation !== review.recommendation ? (
            <span className="chip dim" title="The model's stated recommendation differed from the rule in spec section 8. The computed one is used; the disagreement is logged for tuning.">
              model said {review.modelRecommendation}
            </span>
          ) : null}
          <span className="spacer" />
          {reviews.length > 1 ? (
            <select value={review.id} onChange={(e) => setSelectedId(e.target.value)} style={{ width: 'auto' }} aria-label="Choose review">
              {reviews.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.versionNo} · {formatDateTime(r.finishedAt)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <p>{review.rationale}</p>
        <div className="summary-bar">
          <span className="chip good">{counts.Yes} Yes</span>
          <span className="chip warn">{counts.Partial} Partial</span>
          <span className="chip bad">{counts.No} No</span>
          <span className="chip dim">{counts['N/A']} N/A</span>
        </div>
        <div className="meta">
          {review.model} · {review.bundleVersion} · {review.checklistVersion} · finished {formatDateTime(review.finishedAt)}
          {review.reReviewOfReviewId ? ' · re-review mode' : ''}
        </div>
      </div>

      {review.priorGaps.length ? (
        <div className="card">
          <h3>Prior gaps</h3>
          <p className="meta">What the previous review flagged, and whether this version addressed it.</p>
          <table className="data">
            <tbody>
              {review.priorGaps.map((g) => (
                <tr key={g.text}>
                  <td style={{ width: 120 }}>
                    <span className={`chip ${g.status === 'addressed' ? 'good' : 'warn'}`}>{g.status}</span>
                  </td>
                  <td>{g.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="card">
          <h3>Strengths</h3>
          {review.strengths.length ? (
            <ul>
              {review.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">None called out.</p>
          )}
        </div>
        <div className="card">
          <h3>Gaps</h3>
          {review.gaps.length ? (
            <ul>
              {review.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">None.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Checklist</h3>
        {sections.map((section) => {
          const list = checks.filter((c) => c.section === section)
          const bad = list.filter((c) => c.status === 'No').length
          const partial = list.filter((c) => c.status === 'Partial').length
          return (
            <div key={section} className="scorecard-section">
              <h4>
                {section}
                <span className={`chip ${bad ? 'bad' : partial ? 'warn' : 'good'}`}>{bad ? `${bad} failed` : partial ? `${partial} partial` : 'clear'}</span>
              </h4>
              {list.map((c) => (
                <div key={c.id} className="check-row">
                  <div>
                    <CheckChip status={c.status} />
                  </div>
                  <div>
                    <div>{c.check}</div>
                    {c.notes ? <div className="notes">{c.notes}</div> : null}
                    {c.evidence ? <div className="evidence">Evidence: {c.evidence}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {conditions.length ? (
        <div className="card">
          <h3>Conditions to carry forward</h3>
          <p className="meta">One per Partial. Blocking conditions must be resolved before planning; the rest travel with the proposal.</p>
          <table className="data">
            <thead>
              <tr>
                <th>Condition</th>
                <th>Owner role</th>
                <th>Target phase</th>
                <th>Blocking</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((c) => (
                <tr key={c.id}>
                  <td>{c.text}</td>
                  <td>{c.ownerRole.replace(/_/g, ' ')}</td>
                  <td>{c.targetPhase}</td>
                  <td>{c.blocking ? <span className="chip bad">Yes</span> : <span className="chip dim">No</span>}</td>
                  <td>
                    <span className={`chip ${c.status === 'resolved' ? 'good' : c.status === 'carried' ? 'accent' : 'warn'}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
