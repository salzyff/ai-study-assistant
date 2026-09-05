import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

const PAGE_SIZE = 10;

function dateLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function AdminDashboard({ accessToken, onManageUsers }) {
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
    try {
      setLoading(true);
      setError("");
      const [overviewData, jobsData, logsData] = await Promise.all([
        apiRequest("/api/admin/overview", { accessToken }),
        apiRequest(`/api/admin/jobs?limit=${PAGE_SIZE}&offset=${nextOffset}`, { accessToken }),
        apiRequest("/api/admin/logs?limit=30", { accessToken }),
      ]);
      setOverview(overviewData);
      setJobs(jobsData.jobs || []);
      setPagination(jobsData.pagination || null);
      setLogs(logsData.logs || []);
      setOffset(nextOffset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadAdminData(0), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  async function runWorker() {
    try {
      setBusyJob("worker");
      setError("");
      setMessage("");
      const data = await apiRequest("/api/admin/jobs/run-once", { accessToken, method: "POST" });
      const processedCount = data.processed ? 1 : 0;
      setMessage(`Background worker finished. ${processedCount} job${processedCount === 1 ? "" : "s"} processed.`);
      await loadAdminData(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyJob("");
    }
  }

  async function retryJob(jobId) {
    try {
      setBusyJob(jobId);
      setError("");
      setMessage("");
      await apiRequest(`/api/admin/jobs/${jobId}/retry`, { accessToken, method: "POST" });
      setMessage("The failed job was returned to the queue.");
      await loadAdminData(offset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
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
    <div className="operations-page">
      <div className="operations-toolbar">
        <div>
          <h2>System overview</h2>
          <p>Live backend totals and background job controls.</p>
        </div>
        <div className="operations-actions">
          <button type="button" onClick={onManageUsers}>👥 Manage users</button>
          <button type="button" onClick={() => loadAdminData(offset)} disabled={loading}>↻ Refresh</button>
          <button className="operations-primary" type="button" onClick={runWorker} disabled={busyJob === "worker"}>
            {busyJob === "worker" ? "Running…" : "Run jobs now"}
          </button>
        </div>
      </div>

      {message && <div className="operations-success">{message}</div>}
      {error && <div className="operations-error" role="alert">{error}</div>}

      {loading && !overview ? (
        <div className="operations-empty">Loading system information…</div>
      ) : overview && (
        <>
          <div className="admin-stat-grid">
            {cards.map(([icon, label, value]) => (
              <div className="admin-stat-card" key={label}>
                <span>{icon}</span><strong>{value}</strong><small>{label}</small>
              </div>
            ))}
          </div>

          <div className="admin-section-heading">
            <div><h3>Background jobs</h3><p>Queued reports and recently processed work.</p></div>
            <small>Updated {dateLabel(overview.generatedAt)}</small>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr><td colSpan="5">No background jobs found.</td></tr>
                ) : jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.job_type.replaceAll("_", " ")}</td>
                    <td><span className={`job-status job-status-${job.status}`}>{job.status}</span></td>
                    <td>{job.attempts}</td>
                    <td>{dateLabel(job.created_at)}</td>
                    <td>
                      {job.status === "failed" ? (
                        <button type="button" disabled={busyJob === job.id} onClick={() => retryJob(job.id)}>
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

          <div className="admin-section-heading admin-log-heading">
            <div><h3>Recent server logs</h3><p>Requests and backend events from the current Render instance.</p></div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Time</th><th>Level</th><th>Event</th><th>Route</th><th>Status</th><th>Duration</th></tr></thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan="6">No recent logs found.</td></tr>
                ) : logs.map((log, index) => (
                  <tr key={`${log.timestamp}-${log.requestId || index}`}>
                    <td>{dateLabel(log.timestamp)}</td>
                    <td><span className={`log-level log-level-${log.level}`}>{log.level}</span></td>
                    <td>{log.message}</td>
                    <td>{log.method ? `${log.method} ${log.path || ""}` : "—"}</td>
                    <td>{log.status ?? "—"}</td>
                    <td>{log.durationMs == null ? "—" : `${log.durationMs} ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
