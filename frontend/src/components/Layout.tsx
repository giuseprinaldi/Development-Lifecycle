import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../api/client'
import { useMe, useResetMock, useSwitchUser, useSwitchableUsers } from '../hooks/queries'
import { ROLE_LABELS } from '../types'

function UserSwitcher() {
  const me = useMe()
  const users = useSwitchableUsers(api.mode === 'mock')
  const switchUser = useSwitchUser()
  if (!me.data) return null
  const list = users.data ?? [me.data]
  return (
    <select
      aria-label="Act as (mock mode)"
      value={me.data.id}
      onChange={(e) => switchUser.mutate(e.target.value)}
      style={{ width: 'auto', padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
    >
      {list.map((u) => (
        <option key={u.id} value={u.id}>
          {u.displayName} ({u.roles.map((r) => ROLE_LABELS[r]).join(', ') || 'no roles'})
        </option>
      ))}
    </select>
  )
}

export function Layout() {
  const me = useMe()
  const reset = useResetMock()
  const isAdmin = me.data?.roles.includes('admin') ?? false
  const holdsSignoffRole = me.data?.roles.some((r) => r !== 'submitter' && r !== 'admin') ?? false

  return (
    <div className="app">
      {api.mode === 'mock' ? (
        <div className="banner-mock">
          Mock mode: in-browser data, simulated AI stages. Switch users from the header to see each role's view. Set VITE_API_MODE=live to use the backend.
        </div>
      ) : null}
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            Proposal Pipeline<small>Digital Architecture Team</small>
          </NavLink>
          <nav className="nav">
            <NavLink to="/proposals" end>
              Proposals
            </NavLink>
            {holdsSignoffRole ? <NavLink to="/waiting">Waiting on me</NavLink> : null}
            <NavLink to="/proposals/new">New proposal</NavLink>
            {isAdmin ? <NavLink to="/admin">Admin</NavLink> : null}
          </nav>
          <div className="spacer" />
          <div className="who">
            {me.isLoading ? (
              <span>Signing in…</span>
            ) : me.data ? (
              <>
                <span>
                  <strong>{me.data.displayName}</strong>
                  <span className="muted"> · {me.data.username}</span>
                </span>
                {api.mode === 'mock' ? (
                  <>
                    <UserSwitcher />
                    <button className="btn sm" onClick={() => reset.mutate()} title="Reset mock data to fixtures">
                      Reset data
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <span className="chip bad">Not signed in</span>
            )}
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
