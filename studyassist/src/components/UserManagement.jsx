import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import DeleteConfirmation from "./DeleteConfirmation";
import UserActivity from "./UserActivity";
import UserActionsMenu from "./UserActionsMenu";

const PAGE_SIZE = 20;

function formatDate(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function isSuspended(user) {
  return Boolean(user.bannedUntil && new Date(user.bannedUntil) > new Date());
}

function UserManagement({ accessToken }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const requestVersion = useRef(0);
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState("");
  const [promoteUserId, setPromoteUserId] = useState("");
  const [demoteUserId, setDemoteUserId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async (nextOffset = 0) => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest(`/api/admin/users?limit=${PAGE_SIZE}&offset=${nextOffset}`, { accessToken });
      if (version !== requestVersion.current) return;
      setUsers(data.users || []);
      setPagination(data.pagination || null);
      setOffset(nextOffset);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(0), 0);
    return () => { window.clearTimeout(timer); requestVersion.current += 1; };
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) =>
      (roleFilter === "all" || (roleFilter === "admin" ? user.isAdmin : !user.isAdmin)) &&
      (!query || user.email?.toLowerCase().includes(query)
      || user.displayName?.toLowerCase().includes(query)),
    );
  }, [search, users, roleFilter]);

  async function changeStatus(user) {
    const suspended = !isSuspended(user);
    try {
      setBusyUser(user.id);
      setError("");
      setMessage("");
      const data = await apiRequest(`/api/admin/users/${user.id}/status`, {
        accessToken,
        method: "PATCH",
        body: { suspended },
      });
      setMessage(data.message);
      await loadUsers(offset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyUser("");
    }
  }

  async function deleteUser(userId) {
    await apiRequest(`/api/admin/users/${userId}`, { accessToken, method: "DELETE" });
    setMessage("User deleted.");
    await loadUsers(offset);
  }

  async function promoteUser(user) {
    try {
      setBusyUser(user.id);
      setError("");
      setMessage("");
      const data = await apiRequest(`/api/admin/users/${user.id}/role`, {
        accessToken,
        method: "PATCH",
        body: { role: "admin" },
      });
      setPromoteUserId("");
      setMessage(data.message);
      await loadUsers(offset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyUser("");
    }
  }

  async function demoteUser(user) {
    try {
      setBusyUser(user.id);
      setError("");
      setMessage("");
      const data = await apiRequest(`/api/admin/users/${user.id}/role`, {
        accessToken,
        method: "PATCH",
        body: { role: "member" },
      });
      setDemoteUserId("");
      setMessage(data.message);
      await loadUsers(offset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyUser("");
    }
  }

  if (selectedUser) return <UserActivity key={selectedUser.id} user={selectedUser} accessToken={accessToken} onClose={() => setSelectedUser(null)} />;

  return (
    <div className="operations-page">
      <div className="operations-toolbar user-toolbar">
        <div>
          <h2>User accounts</h2>
          <p>View account activity and control access.</p>
        </div>
        <div className="user-toolbar-actions">
          <select aria-label="Filter roles on this page" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option><option value="admin">Admins</option><option value="member">Members</option></select>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter this page…"
            aria-label="Filter users on this page"
          />
          <button type="button" onClick={() => loadUsers(offset)} disabled={loading}>↻ Refresh</button>
        </div>
      </div>

      {message && <div className="operations-success">{message}</div>}
      {error && <div className="operations-error" role="alert">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table user-table">
          <thead>
            <tr><th>User</th><th>Status</th><th>Joined</th><th>Last sign-in</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5">Loading users…</td></tr>
            ) : visibleUsers.length === 0 ? (
              <tr><td colSpan="5">No matching users found.</td></tr>
            ) : visibleUsers.map((user) => {
              const suspended = isSuspended(user);
              const protectedAccount = user.isEnvironmentAdmin || user.isCurrentUser;
              return (
                <tr key={user.id}>
                  <td><strong>{user.displayName}</strong><small>{user.email}</small></td>
                  <td>
                    <span className={`user-status ${suspended ? "user-status-suspended" : user.emailConfirmedAt ? "user-status-active" : "user-status-unconfirmed"}`}>
                      {suspended ? "Suspended" : user.emailConfirmedAt ? "Active" : "Unconfirmed"}
                    </span>
                    {user.isAdmin && <span className="user-admin-badge">Admin</span>}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastSignInAt)}</td>
                  <td>
                    <UserActionsMenu email={user.email}>
                    <button type="button" onClick={() => setSelectedUser(user)}>Activity &amp; AI allowance</button>
                    {protectedAccount ? (
                      <span className="protected-account">
                        {user.isEnvironmentAdmin ? "Original admin — protected" : "Current account — protected"}
                      </span>
                    ) : user.isAdmin ? (
                      demoteUserId === user.id ? (
                        <span className="delete-confirmation promote-confirmation" role="group" aria-label={`Demote ${user.email} to member`}>
                          <span className="delete-confirmation-message">
                            Demote {user.email}? They will lose administrator access.
                          </span>
                          <button className="delete-confirmation-accept" type="button" disabled={busyUser === user.id} onClick={() => demoteUser(user)}>
                            {busyUser === user.id ? "Demoting…" : "Yes, demote"}
                          </button>
                          <button className="delete-confirmation-cancel" type="button" disabled={busyUser === user.id} onClick={() => setDemoteUserId("")}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button className="demote-user-button" type="button" disabled={busyUser === user.id} onClick={() => setDemoteUserId(user.id)}>
                          Demote to member
                        </button>
                      )
                    ) : (
                      <div className="user-actions">
                        <button type="button" disabled={busyUser === user.id} onClick={() => changeStatus(user)}>
                          {busyUser === user.id ? "Updating…" : suspended ? "Reactivate" : "Suspend"}
                        </button>
                        {promoteUserId === user.id ? (
                          <span className="delete-confirmation promote-confirmation" role="group" aria-label={`Promote ${user.email} to administrator`}>
                            <span className="delete-confirmation-message">
                              Promote {user.email}? They will receive full administrator access.
                            </span>
                            <button className="delete-confirmation-accept" type="button" disabled={busyUser === user.id} onClick={() => promoteUser(user)}>
                              {busyUser === user.id ? "Promoting…" : "Yes, promote"}
                            </button>
                            <button className="delete-confirmation-cancel" type="button" disabled={busyUser === user.id} onClick={() => setPromoteUserId("")}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button className="promote-user-button" type="button" disabled={busyUser === user.id} onClick={() => setPromoteUserId(user.id)}>
                            Promote to admin
                          </button>
                        )}
                        <DeleteConfirmation
                          buttonLabel="Delete user"
                          className="user-action-delete"
                          disabled={busyUser === user.id}
                          confirmation={`Delete ${user.email}? This removes their access and cannot be undone.`}
                          onConfirm={() => deleteUser(user.id)}
                        />
                      </div>
                    )}
                    </UserActionsMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pagination-controls">
        <button type="button" disabled={loading || offset === 0} onClick={() => loadUsers(Math.max(0, offset - PAGE_SIZE))}>← Previous</button>
        <span>
          {pagination?.total == null
            ? `Showing ${users.length}`
            : `${Math.min(offset + 1, pagination.total)}–${Math.min(offset + users.length, pagination.total)} of ${pagination.total}`}
        </span>
        <button type="button" disabled={loading || !pagination?.hasMore} onClick={() => loadUsers(pagination.nextOffset)}>Next →</button>
      </div>
    </div>
  );
}

export default UserManagement;
