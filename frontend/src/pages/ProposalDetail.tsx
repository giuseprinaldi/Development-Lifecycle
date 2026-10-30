import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { DraftTab } from '../components/DraftTab'
import { ActivityTab, ConditionsTab, RequirementsTab } from '../components/MoreTabs'
import { ReviewTab } from '../components/ReviewTab'
import { SignoffTab } from '../components/SignoffTab'
import { VersionsTab } from '../components/VersionsTab'
import { Empty, ErrorNote, JobLine, StateBadge, StateStrip, Tabs } from '../components/common'
import { useMe, useProposal, useSwitchableUsers, useUsers } from '../hooks/queries'
import { formatDateTime } from '../lib/format'
import { STATE_DESCRIPTIONS } from '../lib/rules'
import type { User } from '../types'

type TabId = 'draft' | 'review' | 'signoff' | 'requirements' | 'conditions' | 'versions' | 'activity'

export function ProposalDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const q = useProposal(id)
  const me = useMe()
  const isAdmin = me.data?.roles.includes('admin') ?? false
  // Names for signoff rows: admins can list users; in mock mode anyone can see the fixture list.
  const adminUsers = useUsers()
  const mockUsers = useSwitchableUsers(api.mode === 'mock')
  const users: User[] = (isAdmin ? adminUsers.data : undefined) ?? mockUsers.data ?? (me.data ? [me.data] : [])

  const defaultTab: TabId = q.data
    ? q.data.proposal.state === 'Awaiting Signoff' || q.data.proposal.state === 'Approved' || q.data.proposal.state === 'Rejected'
      ? 'signoff'
      : q.data.proposal.state === 'In Review'
        ? 'review'
        : 'draft'
    : 'draft'
  const tab: TabId = (params.get('tab') as TabId | null) ?? defaultTab

  if (q.isLoading || me.isLoading) return <Empty>Loading…</Empty>
  if (q.error) return <ErrorNote error={q.error} />
  if (!q.data || !me.data) return <Empty>Not found.</Empty>

  const d = q.data
  const p = d.proposal
  const activeJob = d.jobs.find((j) => j.state === 'queued' || j.state === 'running')
  const submitter = users.find((u) => u.id === p.submitterId)?.displayName ?? p.submitterId
  const latestReview = [...d.reviews].reverse()[0]

  const choose = (t: TabId) => setParams({ tab: t }, { replace: true })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: '0.5rem' }}>
            <Link to="/proposals" className="muted">
              Proposals
            </Link>
            <span className="muted">/</span>
            <span className="num muted">{p.code}</span>
          </div>
          <h1 style={{ marginTop: '0.25rem' }}>{p.title}</h1>
          <div className="sub">
            {d.service.name} · submitted by {submitter} · created {formatDateTime(p.createdAt)}
          </div>
        </div>
        <div className="right">
          <StateBadge state={p.state} />
          <div className="meta" style={{ marginTop: '0.35rem', maxWidth: 360 }}>
            {STATE_DESCRIPTIONS[p.state]}
          </div>
          {p.waitingOn ? <div className="meta">Waiting on: {p.waitingOn}</div> : null}
        </div>
      </div>

      <StateStrip state={p.state} />

      {activeJob ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <JobLine job={activeJob} />
        </div>
      ) : null}

      <Tabs<TabId>
        value={tab}
        onChange={choose}
        tabs={[
          { id: 'draft', label: 'Proposal' },
          { id: 'review', label: 'Review', count: d.reviews.length },
          { id: 'signoff', label: 'Signoff', count: d.signoffs.filter((s) => s.proposalVersionId === p.currentVersionId).length },
          { id: 'requirements', label: 'Requirements', count: d.requirements.filter((r) => r.status === 'active').length },
          { id: 'conditions', label: 'Conditions', count: d.conditions.filter((c) => c.status !== 'resolved').length },
          { id: 'versions', label: 'Versions', count: d.versions.length },
          { id: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'draft' ? <DraftTab key={p.currentVersionId} detail={d} me={me.data} /> : null}
      {tab === 'review' ? <ReviewTab detail={d} /> : null}
      {tab === 'signoff' ? <SignoffTab detail={d} me={me.data} users={users} /> : null}
      {tab === 'requirements' ? <RequirementsTab detail={d} /> : null}
      {tab === 'conditions' ? <ConditionsTab detail={d} me={me.data} /> : null}
      {tab === 'versions' ? <VersionsTab detail={d} users={users} /> : null}
      {tab === 'activity' ? <ActivityTab detail={d} /> : null}

      {latestReview && tab !== 'review' && p.state !== 'Draft' ? (
        <p className="meta mt">
          Latest review: {latestReview.recommendation} on version {latestReview.versionNo}.{' '}
          <button className="btn ghost sm" onClick={() => choose('review')}>
            Open the scorecard
          </button>
        </p>
      ) : null}
    </>
  )
}
