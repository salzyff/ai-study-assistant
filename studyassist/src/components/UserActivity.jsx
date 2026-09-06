import { useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function UserActivity({ user, accessToken, onClose }) {
  const [data, setData] = useState(null);
  const [limit, setLimit] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    apiRequest(`/api/admin/users/${user.id}/activity?limit=20&offset=${offset}`, { accessToken })
      .then((result) => { if (active) { setData(result); setLimit(String(result.usage.limit)); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user.id, accessToken, offset, revision]);
  function reload(nextOffset = offset) {
    setLoading(true); setError(""); setOffset(nextOffset); setRevision((value) => value + 1);
  }
  async function save(value) {
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await apiRequest(`/api/admin/users/${user.id}/limit`, {
        accessToken, method: "PATCH", body: { limit: value },
      });
      setNotice(result.message); reload();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <section className="admin-activity" aria-label={`Activity for ${user.email}`}>
    <button type="button" onClick={onClose}>← Back to users</button>
    <h2>{user.email}</h2>
    <p>Recorded AI feature activity. Daily usage resets at midnight UTC.</p>
    {error && <p role="alert" className="operations-error">{error}</p>}
    {notice && <p role="status" className="operations-success">{notice}</p>}
    {loading ? <p>Loading activity…</p> : data && <>
      <p><strong>{data.usage.used}</strong> requests today · <strong>{data.usage.limit}</strong> daily allowance · <strong>{data.usage.remaining}</strong> remaining</p>
      {(!user.isEnvironmentAdmin || user.isCurrentUser) && <form className="admin-limit-form" onSubmit={(event) => { event.preventDefault(); save(Number(limit)); }}>
        <label htmlFor="user-daily-limit">Daily AI allowance
          <input id="user-daily-limit" type="number" min="0" max="10000" step="1" required value={limit} disabled={saving} onChange={(event) => setLimit(event.target.value)} />
        </label>
        <button disabled={saving} type="submit">{saving ? "Saving…" : "Save allowance"}</button>
        <button disabled={saving} type="button" onClick={() => save(null)}>Use site default</button>
      </form>}
      <p>Changes apply to subsequent requests. Zero pauses AI access; existing usage is retained.</p>
      <h3>Recent AI activity</h3>
      {data.events.length === 0 ? <p>No recorded AI activity yet.</p> : <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Feature</th><th>Time</th></tr></thead>
        <tbody>{data.events.map((event) => <tr key={event.id}><td>{event.feature}</td><td>{new Date(event.created_at).toLocaleString()}</td></tr>)}</tbody>
      </table></div>}
      <div className="pagination-controls">
        <button disabled={saving || offset === 0} type="button" onClick={() => reload(Math.max(0, offset - 20))}>Previous</button>
        <button disabled={saving || !data.pagination.hasMore} type="button" onClick={() => reload(data.pagination.nextOffset)}>Next</button>
        <button disabled={saving} type="button" onClick={() => reload()}>Refresh activity</button>
      </div>
    </>}
  </section>;
}
