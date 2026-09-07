import { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import MathMarkdown from './MathMarkdown';

export default function AnswerReportsAdmin({ accessToken }) {
  const [status, setStatus] = useState('open');
  const [reports, setReports] = useState([]);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState({});
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  useEffect(() => {
    let active = true;
    apiRequest(`/api/study-upgrades/answer-reports?status=${status}&offset=${offset}`, { accessToken })
      .then(d => { if (active) { setReports(Array.isArray(d.reports) ? d.reports : []); setError(''); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accessToken, status, offset, revision]);
  function refresh() { setLoading(true); setRevision(n => n + 1); }
  async function update(report, next) {
    if (busy) return;
    setBusy(report.id); setError(''); setNotice('');
    try {
      await apiRequest(`/api/study-upgrades/answer-reports/${report.id}`, {
        accessToken, method: 'PATCH', body: { status: next, note: notes[report.id] ?? report.admin_note ?? '' },
      });
      setNotice(next === report.status ? 'Review note saved.' : `Report marked ${next}.`);
      setNotes(current => { const copy = { ...current }; delete copy[report.id]; return copy; });
      if (next !== status && reports.length === 1 && offset > 0) setOffset(n => Math.max(0, n - 20));
      refresh();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  const shown = reports.filter(r => (kind === 'all' || r.kind === kind) && `${r.reason || ''} ${r.snapshot?.content || r.snapshot?.question || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="report-workspace">
    <div className="operations-toolbar"><div><h2>Answer review queue</h2><p>Investigate reported answers and record what you found.</p></div>
      <button type="button" disabled={loading || Boolean(busy)} onClick={refresh}>Refresh</button></div>
    <div className="report-filters">
      <label>Status<select value={status} disabled={Boolean(busy)} onChange={e => { setStatus(e.target.value); setOffset(0); setLoading(true); setReports([]); }}>
        <option value="open">Needs review</option><option value="reviewed">Reviewed</option><option value="dismissed">Dismissed</option></select></label>
      <label>Answer type<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">All types</option><option value="chat">Chat</option><option value="quiz">Quiz</option></select></label>
      <label>Search this page<input type="search" placeholder="Feedback or answer text" value={query} onChange={e => setQuery(e.target.value)} /></label>
    </div>
    {notice && <p className="operations-success" role="status">{notice}</p>}
    {error && <p className="operations-error" role="alert">{error} <button type="button" disabled={Boolean(busy)} onClick={refresh}>Retry</button></p>}
    {loading ? <p role="status">Loading reports…</p> : !error && !shown.length ? <div className="report-empty"><h3>{reports.length ? 'No matching reports' : 'Nothing in this queue'}</h3><p>{reports.length ? 'Try a different search or answer type.' : 'Student reports will appear here for review.'}</p></div> : null}
    {!loading && shown.map(r => {
      const snapshot = r.snapshot || {};
      return <article className="report-card" key={r.id}>
        <header><span className={`report-badge report-badge-${r.status}`}>{r.status}</span><span>{r.kind === 'quiz' ? 'Quiz answer' : 'Chat answer'}</span><time>{new Date(r.created_at).toLocaleString()}</time></header>
        <div className="report-feedback"><h3>Student’s concern</h3><p>{r.reason}</p></div>
        <details className="report-answer"><summary>View reported answer</summary><div className="message-content"><MathMarkdown>{snapshot.content || snapshot.question || 'Original text unavailable.'}</MathMarkdown>
          {Array.isArray(snapshot.options) && <ol>{snapshot.options.map((option, i) => <li key={i}>{typeof option === 'string' ? option : 'Option unavailable'}</li>)}</ol>}
          {snapshot.explanation && <MathMarkdown>{snapshot.explanation}</MathMarkdown>}</div></details>
        <label className="report-note">Review note<textarea rows={3} maxLength={1000} placeholder="What was wrong? What should the correct explanation say?" value={notes[r.id] ?? r.admin_note ?? ''} onChange={e => setNotes(current => ({ ...current, [r.id]: e.target.value }))} /></label>
        <p className="report-help">Internal note only. Reviewing does not rewrite the original answer or notify the student.</p>
        <div className="report-actions">
          <button type="button" disabled={Boolean(busy)} onClick={() => update(r, r.status)}>Save note</button>
          {r.status !== 'reviewed' && <button className="report-primary" type="button" disabled={Boolean(busy)} onClick={() => update(r, 'reviewed')}>Mark reviewed</button>}
          {r.status !== 'dismissed' && <button type="button" disabled={Boolean(busy)} onClick={() => update(r, 'dismissed')}>Dismiss report</button>}
          {r.status !== 'open' && <button type="button" disabled={Boolean(busy)} onClick={() => update(r, 'open')}>Reopen</button>}
          {busy === r.id && <span role="status">Saving…</span>}
        </div>
      </article>;
    })}
    <div className="pagination-controls"><button disabled={!offset || loading || Boolean(busy)} onClick={() => { setLoading(true); setOffset(n => n - 20); }}>Previous</button><span>Page {offset / 20 + 1} · {shown.length} shown</span><button disabled={reports.length < 20 || loading || Boolean(busy)} onClick={() => { setLoading(true); setOffset(n => n + 20); }}>Next</button></div>
  </section>;
}
