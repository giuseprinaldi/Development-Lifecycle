import { Empty, ErrorNote } from '../components/common'
import { useMe, useSetUserRoles, useUsers } from '../hooks/queries'
import { ROLES, ROLE_LABELS, type Role } from '../types'

export function Admin() {
  const me = useMe()
  const users = useUsers()
  const setRoles = useSetUserRoles()

  if (me.data && !me.data.roles.includes('admin')) {
    return <div className="alert bad">Admin role required.</div>
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <div className="sub">Users appear here after their first sign-in through IIS. Assign roles; signoff rights follow from them.</div>
        </div>
      </div>
      <div className="card">
        <h3>Users and roles</h3>
        <ErrorNote error={users.error} />
        <ErrorNote error={setRoles.error} />
        {users.isLoading ? (
          <Empty>Loading…</Empty>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                {ROLES.map((r) => (
                  <th key={r} style={{ textAlign: 'center' }}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.displayName}</strong>
                    {u.id === me.data?.id ? <span className="chip accent" style={{ marginLeft: '0.4rem' }}>you</span> : null}
                  </td>
                  <td className="num">{u.username}</td>
                  <td className="muted">{u.email}</td>
                  {ROLES.map((r: Role) => {
                    const has = u.roles.includes(r)
                    const lastAdmin = r === 'admin' && has && (users.data ?? []).filter((x) => x.roles.includes('admin')).length === 1
                    return (
                      <td key={r} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={has}
                          disabled={setRoles.isPending || lastAdmin}
                          title={lastAdmin ? 'Cannot remove the last admin' : ''}
                          onChange={() => setRoles.mutate({ userId: u.id, roles: has ? u.roles.filter((x) => x !== r) : [...u.roles, r] })}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card">
        <h3>What each role can do</h3>
        <dl className="kv">
          <dt>Submitter</dt>
          <dd>Create proposals, edit and confirm drafts, submit and resubmit.</dd>
          <dt>Proposal Owner, Project Manager, Tech Lead, Architecture Reviewer</dt>
          <dd>Required signoff roles by default. Tech Lead and Project Manager can also resolve conditions.</dd>
          <dt>External Customer</dt>
          <dd>Optional signoff; recorded but never blocks.</dd>
          <dt>Admin</dt>
          <dd>Manage roles, change a proposal's required signoff set, edit any draft.</dd>
        </dl>
      </div>
    </>
  )
}
