import { useCallback, useEffect, useRef, useState } from "react";
import AnswerReportsAdmin from "./AnswerReportsAdmin";
import UserManagement from "./UserManagement";
import AdminActivity from "./AdminActivity";
import "./admin.css";
import { apiRequest } from "../api";

const PAGE_SIZE = 10;

function dateLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function AdminDashboard({ accessToken }) {
  const [section, setSection] = useState("Overview");
  const [statusFilter, setStatusFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [confirmation, setConfirmation] = useState(null);
  const requestVersion = useRef(0);
  const actionLock = useRef(false);
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyJob, setBusyJob] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAdminData = useCallback(async (nextOffset = 0) => {
    const version = ++requestVersion.current;
    try {
      setLoading(true);
      setError("");
      const results = await Promise.allSettled([
        apiRequest("/api/admin/overview", { accessToken }),
        apiRequest(`/api/admin/jobs?limit=${PAGE_SIZE}&offset=${nextOffset}&status=${statusFilter}`, { accessToken }),
        apiRequest("/api/admin/logs?limit=30", { accessToken }),
      ]);
      if (version !== requestVersion.current) return;
      const [overviewResult, jobsResult, logsResult] = results;
      if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value.jobs || []);
        setPagination(jobsResult.value.pagination || null);
      } else { setJobs([]); setPagination(null); }
      if (logsResult.status === "fulfilled") setLogs(logsResult.value.logs || []);
      else setLogs([]);
      setError(results.map((result, index) => result.status === "rejected" ? `${["Overview", "Jobs", "Server events"][index]}: ${result.reason.message}` : "").filter(Boolean).join(" · "));
      setOffset(nextOffset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadAdminData(0), 0);
    return () => { window.clearTimeout(timer); requestVersion.current += 1; };
  }, [loadAdminData]);

  async function runWorker() {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      setBusyJob("worker");
      setError("");
      setMessage("");
      const data = await apiRequest("/api/admin/jobs/run-once", { accessToken, method: "POST" });
      const processedCount = data.processed ? 1 : 0;
      setMessage(processedCount ? "One job was attempted. Check its status for the result." : "No job was claimed: the queue is empty or the worker is busy.");
      setConfirmation(null);
      await loadAdminData(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      actionLock.current = false;
      setBusyJob("");
    }
  }

  async function retryJob(jobId) {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      setBusyJob(jobId);
      setError("");
      setMessage("");
      await apiRequest(`/api/admin/jobs/${jobId}/retry`, { accessToken, method: "POST" });
      setMessage("The failed job was returned to the queue.");
      setConfirmation(null);
      await loadAdminData(offset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      actionLock.current = false;
      setBusyJob("");
    }
  }

  const cards = overview ? [
    ["👥", "Users", overview.users],
    ["💬", "Conversations", overview.conversations],
    ["✅", "Tasks", overview.tasks],
    ["🤖", "AI requests (24h)", overview.aiRequestsLast24Hours],
    ["⚠️", "Failed jobs", overview.failedJobs],
  ] : [];

  return (
    <div className="operations-page admin-console">
      <div className="admin-banner"><small>STUDY AI / ADMINISTRATION</small><h2>Your control centre</h2><p>Accounts, allowances and service operations in one workspace.</p></div>
      <nav className="admin-nav" aria-label="Administration">{["Overview", "Users", "Activity", "Answer reports", "Jobs", "Server events"].map((name) => <button type="button" key={name} disabled={Boolean(busyJob)} aria-current={section === name ? "page" : undefined} onClick={() => { setSection(name); setConfirmation(null); }}>{name}</button>)}</nav>
      {section === "Answer reports" ? <AnswerReportsAdmin accessToken={accessToken} /> : section === "Users" ? <UserManagement accessToken={accessToken} /> : section === "Activity" ? <AdminActivity accessToken={accessToken} /> : <>
      <div className="operations-toolbar">
        <div>
          <h2>{section}</h2>
          <p>{overview ? `Last snapshot: ${dateLabel(overview.generatedAt)}` : "Loading service information"}</p>
        </div>
        <div className="operations-actions">
          <button type="button" onClick={() => setSection("Users")}>Manage users & allowances</button>
          <button type="button" onClick={() => loadAdminData(offset)} disabled={loading}>↻ Refresh</button>
          {section === "Jobs" && <button className="operations-primary" type="button" onClick={() => setConfirmation("worker")} disabled={Boolean(busyJob) || loading}>Process next job</button>}
        </div>
      </div>

      {message && <div className="operations-success">{message}</div>}
      {error && <div className="operations-error" role="alert">{error}</div>}
      {confirmation && <div className="admin-confirm" role="group" aria-label="Confirm job action"><p>{confirmation === "worker" ? "Attempt the next queued job?" : "Return this failed job to the queue?"}</p><button type="button" disabled={Boolean(busyJob)} onClick={() => confirmation === "worker" ? runWorker() : retryJob(confirmation)}>Confirm</button><button type="button" disabled={Boolean(busyJob)} onClick={() => setConfirmation(null)}>Cancel</button></div>}

      {loading && !overview ? (
        <div className="operations-empty">Loading system information…</div>
      ) : (
        <>
          {section === "Overview" && <>
          <div className="admin-stat-grid">
            {cards.map(([icon, label, value]) => (
              <div className="admin-stat-card" key={label}>
                <span>{icon}</span><strong>{value}</strong><small>{label}</small>
              </div>
            ))}
          </div>
          <div className="admin-guide"><h3>Account support</h3><p>Review AI activity, change daily allowances, and manage account access from Users.</p><button type="button" onClick={() => setSection("Users")}>Open users →</button><h3>Service operations</h3><p>Inspect failed reports, retry jobs and review recent server events.</p><button type="button" onClick={() => setSection("Jobs")}>Inspect jobs →</button></div>
          </>}

          {section === "Jobs" && <>
          <label className="admin-filter">Job status <select value={statusFilter} disabled={loading || Boolean(busyJob)} onChange={(event) => setStatusFilter(event.target.value)}>{["all", "queued", "processing", "completed", "failed"].map((value) => <option key={value}>{value}</option>)}</select></label>

          <div className="admin-section-heading">
            <div><h3>Background jobs</h3><p>Queued reports and recently processed work.</p></div>
            <small>One job per manual run</small>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan="5">No background jobs found.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.job_type.replaceAll("_", " ")}<details><summary>Details</summary><p>ID: {job.id}</p><p>User: {job.user_id}</p><p>Started: {dateLabel(job.started_at)}</p><p>Finished: {dateLabel(job.finished_at)}</p>{job.error_message && <p className="operations-error">{job.error_message}</p>}</details></td>
                    <td><span className={`job-status job-status-${job.status}`}>{job.status}</span></td>
                    <td>{job.attempts}</td>
                    <td>{dateLabel(job.created_at)}</td>
                    <td>
                      {job.status === "failed" ? (
                        <button type="button" disabled={Boolean(busyJob)} onClick={() => setConfirmation(job.id)}>
                          {busyJob === job.id ? "Retrying…" : "Retry"}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination-controls">
            <button type="button" disabled={loading || offset === 0} onClick={() => loadAdminData(Math.max(0, offset - PAGE_SIZE))}>← Previous</button>
            <span>
              {pagination?.total == null
                ? `Showing ${jobs.length}`
                : `${Math.min(offset + 1, pagination.total)}–${Math.min(offset + jobs.length, pagination.total)} of ${pagination.total}`}
            </span>
            <button type="button" disabled={loading || !pagination?.hasMore} onClick={() => loadAdminData(pagination.nextOffset)}>Next →</button>
          </div>

          </>}
          {section === "Server events" && <>
          <label className="admin-filter">Severity <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>{["all", "info", "warn", "error"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <div className="admin-section-heading admin-log-heading">
            <div><h3>Recent server logs</h3><p>Requests and backend events from the current Render instance.</p></div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Time</th><th>Level</th><th>Event</th><th>Route</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                {logs.filter((log) => levelFilter === "all" || log.level === levelFilter).length === 0 ? (
                  <tr><td colSpan="6">No recent logs found.</td></tr>
                ) : logs.filter((log) => levelFilter === "all" || log.level === levelFilter).map((log, index) => (
                  <tr key={`${log.timestamp}-${log.requestId || index}`}>
                    <td>{dateLabel(log.timestamp)}</td>
                    <td><span className={`log-level log-level-${log.level}`}>{log.level}</span></td>
                    <td>{log.message}{log.adminUserId && <small>Admin: {log.adminUserId} / User: {log.targetUserId}</small>}</td>
                    <td>{log.method ? `${log.method} ${log.path || ""}` : "—"}</td>
                    <td>{log.status ?? "—"}</td>
                    <td>{log.durationMs == null ? "—" : `${log.durationMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>These events are held in memory and reset when the server restarts.</p>
          </>}
        </>
      )}
      </>}
    </div>
  );
}

export default AdminDashboard;
