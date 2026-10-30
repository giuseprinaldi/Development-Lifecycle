import { diffLines } from 'diff'
import { useState } from 'react'
import { formatDateTime } from '../lib/format'
import type { ProposalDetail, User } from '../types'
import { MarkdownView } from './common'

export function VersionsTab({ detail, users }: { detail: ProposalDetail; users: User[] }) {
  const versions = [...detail.versions].sort((a, b) => b.versionNo - a.versionNo)
  const [leftId, setLeftId] = useState(versions[1]?.id ?? versions[0]?.id ?? '')
  const [rightId, setRightId] = useState(versions[0]?.id ?? '')
  const [view, setView] = useState<'diff' | 'read'>(versions.length > 1 ? 'diff' : 'read')
  const left = versions.find((v) => v.id === leftId)
  const right = versions.find((v) => v.id === rightId)
  const nameOf = (id: string) => users.find((u) => u.id === id)?.displayName ?? id

  const parts = left && right ? diffLines(left.markdown, right.markdown) : []
  const added = parts.filter((p) => p.added).reduce((n, p) => n + (p.count ?? 0), 0)
  const removed = parts.filter((p) => p.removed).reduce((n, p) => n + (p.count ?? 0), 0)

  return (
    <div className="stack">
      <div className="card">
        <h3>Versions</h3>
        <table className="data">
          <thead>
            <tr>
              <th>Version</th>
              <th>Source</th>
              <th>By</th>
              <th>When</th>
              <th>Template</th>
              <th>Requirements</th>
              <th>Conforming</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="num">
                  v{v.versionNo} {v.id === detail.proposal.currentVersionId ? <span className="chip accent">current</span> : null}
                </td>
                <td>{v.source}</td>
                <td>{v.createdBy === 'worker' ? 'Stage 1 (AI)' : nameOf(v.createdBy)}</td>
                <td className="muted">{formatDateTime(v.createdAt)}</td>
                <td className="muted">{v.templateVersion}</td>
                <td className="num">{v.parsed.requirements.length}</td>
                <td>{v.parsed.conforming ? <span className="chip good">yes</span> : <span className="chip warn">no</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: '0.6rem' }}>
          <h3 className="mb0">Compare</h3>
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)} style={{ width: 'auto' }} aria-label="From version">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNo}
              </option>
            ))}
          </select>
          <span className="muted">→</span>
          <select value={rightId} onChange={(e) => setRightId(e.target.value)} style={{ width: 'auto' }} aria-label="To version">
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.versionNo}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="chip good">+{added}</span>
          <span className="chip bad">−{removed}</span>
          <button className={`btn sm ${view === 'diff' ? 'primary' : ''}`} onClick={() => setView('diff')}>
            Diff
          </button>
          <button className={`btn sm ${view === 'read' ? 'primary' : ''}`} onClick={() => setView('read')}>
            Read v{right?.versionNo}
          </button>
        </div>
        {view === 'diff' ? (
          leftId === rightId ? (
            <p className="muted">Pick two different versions.</p>
          ) : (
            <div className="diff">
              {parts.map((p, i) =>
                p.value.split('\n').map((line, j, arr) =>
                  j === arr.length - 1 && line === '' ? null : (
                    <div key={`${i}-${j}`} className={`line ${p.added ? 'add' : p.removed ? 'del' : 'ctx'}`}>
                      {p.added ? '+ ' : p.removed ? '− ' : '  '}
                      {line}
                    </div>
                  ),
                ),
              )}
            </div>
          )
        ) : right ? (
          <MarkdownView source={right.markdown} />
        ) : null}
      </div>
    </div>
  )
}
