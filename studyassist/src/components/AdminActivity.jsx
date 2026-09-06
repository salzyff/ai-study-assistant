import { useEffect, useState } from "react";
import { apiRequest } from "../api";

export default function AdminActivity({ accessToken }) {
  const [data, setData] = useState(null);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(`/api/admin/activity?limit=20&offset=${offset}&userId=${encodeURIComponent(filter)}`, { accessToken, signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, offset, filter, revision]);
  function refresh(nextOffset = offset) { setError(""); setLoading(true); setOffset(nextOffset); setRevision((value) => value + 1); }
  return <section><h2>AI activity</h2><p>Recorded feature usage across accounts. Private message contents are not included.</p>
    <div className="admin-filter">
      <span>{filter ? `Activity for ${draft}` : "All accounts — click an email to filter"}</span>
      <button type="button" disabled={loading || !filter} onClick={() => { setDraft(""); setFilter(""); refresh(0); }}>Clear filter</button>
      <button type="button" disabled={loading} onClick={() => refresh()}>Refresh</button>
    </div>
    {error && <p role="alert" className="operations-error">{error}</p>}
    {loading ? <p role="status">Loading activity…</p> : !error && data && <>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Feature</th><th>Email</th><th>Time</th></tr></thead><tbody>
        {data.events.length ? data.events.map((event) => <tr key={event.id}><td>{event.feature}</td><td>{event.email ? <button type="button" onClick={() => { setDraft(event.email); setFilter(event.user_id); refresh(0); }}>{event.email}</button> : "Email unavailable"}</td><td>{new Date(event.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan="3">No recorded activity.</td></tr>}
      </tbody></table></div>
      <div className="pagination-controls"><button type="button" disabled={!offset} onClick={() => refresh(Math.max(0, offset - 20))}>Previous</button><span>{data.pagination.total} records</span><button type="button" disabled={!data.pagination.hasMore} onClick={() => refresh(data.pagination.nextOffset)}>Next</button></div>
    </>}
  </section>;
}
