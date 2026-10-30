import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorNote } from '../components/common'
import { useCreateProposal, useMe, useServices } from '../hooks/queries'
import { blankTemplate, parseProposal } from '../lib/template'

export function NewProposal() {
  const navigate = useNavigate()
  const me = useMe()
  const services = useServices()
  const create = useCreateProposal()
  const [serviceId, setServiceId] = useState('')
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)

  const parsed = useMemo(() => (markdown.trim() ? parseProposal(markdown) : null), [markdown])

  async function onFile(file: File | undefined) {
    if (!file) return
    setFileName(file.name)
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
    if (/\.docx$/i.test(file.name)) {
      // The backend converts .docx; the mock cannot. Ask for text instead.
      setMarkdown('')
      alert('In mock mode only .md and .txt uploads can be read. In live mode the backend converts .docx for you.')
      return
    }
    setMarkdown(await file.text())
  }

  function submit() {
    create.mutate(
      { serviceId, title, markdown, fileName: fileName ?? undefined },
      { onSuccess: (d) => navigate(`/proposals/${d.proposal.id}`) },
    )
  }

  const canSubmit = serviceId && title.trim() && markdown.trim() && !create.isPending

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New proposal</h1>
          <div className="sub">Paste or upload a proposal. If it isn't in the team template, Stage 1 reformats it and you confirm the result before review.</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <label className="field">
            <span>Service</span>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Choose a service…</option>
              {(services.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short name for the proposal" />
          </label>
          <label className="field">
            <span>Upload (.md or .txt; .docx in live mode)</span>
            <input type="file" accept=".md,.txt,.markdown,.docx" onChange={(e) => void onFile(e.target.files?.[0])} />
            {fileName ? <div className="help">Loaded {fileName}</div> : null}
          </label>
          <label className="field">
            <span>Or paste the proposal</span>
            <textarea className="mono" style={{ minHeight: 360 }} value={markdown} onChange={(e) => setMarkdown(e.target.value)} placeholder="Paste the proposal text here…" />
          </label>
          <div className="row">
            <button className="btn" onClick={() => setMarkdown(blankTemplate(title || 'Untitled proposal', me.data?.displayName ?? ''))} disabled={!!markdown.trim()}>
              Start from the template
            </button>
            <span className="spacer" />
            <button className="btn primary" onClick={submit} disabled={!canSubmit}>
              {create.isPending ? 'Creating…' : 'Create proposal'}
            </button>
          </div>
          <ErrorNote error={create.error} />
        </div>

        <div className="card">
          <h3>Template check</h3>
          {!parsed ? (
            <p className="muted">Paste or upload text to see whether it matches the template.</p>
          ) : parsed.conforming ? (
            <div className="alert good">
              Conforms to the template. {parsed.requirements.length} requirement{parsed.requirements.length === 1 ? '' : 's'} found. No reformatting needed; the draft will be submittable right away.
            </div>
          ) : (
            <div className="alert warn">
              Not in the template yet. Stage 1 will reformat it, keep your content, and mark anything missing as unresolved. You review the result before it goes to review.
            </div>
          )}
          {parsed ? (
            <div className="mt">
              {parsed.sectionsMissing.length ? (
                <>
                  <h4 className="mb0">Missing</h4>
                  <ul>
                    {parsed.sectionsMissing.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {parsed.sectionsFound.length ? (
                <>
                  <h4 className="mb0">Found</h4>
                  <div className="chip-row">
                    {parsed.sectionsFound.map((s) => (
                      <span key={s} className="chip good">
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              {parsed.problems.length ? (
                <>
                  <h4 className="mb0 mt">Requirement wording</h4>
                  <ul>
                    {parsed.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
