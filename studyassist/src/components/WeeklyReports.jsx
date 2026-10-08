import ChatIcon from "./ChatIcon";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

const PAGE_SIZE = 8;

function dateLabel(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function WeeklyReports({ accessToken }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadReports = useCallback(async (nextOffset = 0) => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest(
        `/api/reports?limit=${PAGE_SIZE}&offset=${nextOffset}`,
        { accessToken },
      );
      setReports(data.reports || []);
      setPagination(data.pagination || null);
      setOffset(nextOffset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadReports(0), 0);
    return () => window.clearTimeout(timer);
  }, [loadReports]);

  async function createReport() {
    try {
      setCreating(true);
      setError("");
      setMessage("");
      const data = await apiRequest("/api/reports/weekly", {
        accessToken,
        method: "POST",
      });
      setMessage(data.message || "Your report is on its way. You can keep studying while it’s prepared.");
      await loadReports(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="operations-page">
      <div className="operations-toolbar">
        <div>
          <h2>Your reports</h2>
          <p>Your report will appear here when it’s ready. You can keep studying in the meantime.</p>
        </div>
        <button className="operations-primary" type="button" onClick={createReport} disabled={creating}>
          {creating ? "Getting it ready…" : "Create this week’s report"}
        </button>
      </div>

      {message && <div className="operations-success">{message}</div>}
      {error && <div className="operations-error" role="alert">{error}</div>}

      {loading ? (
        <div className="operations-empty">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="operations-empty">
          <span><ChatIcon name="chart" /></span>
          <h3>No weekly reports yet</h3>
          <p>Create a report to see your tasks, quizzes and study time together.</p>
        </div>
      ) : (
        <div className="operations-list">
          {reports.map((report) => (
            <article className="operations-item" key={report.id}>
              <div className="operations-item-heading">
                <div>
                  <strong>Weekly learning report</strong>
                  <small>{dateLabel(report.created_at)}</small>
                </div>
                <span className={`job-status job-status-${report.status}`}>{report.status}</span>
              </div>
              {report.status === "completed" && report.result && (
                <div className="report-results">
                  <div><strong>{report.result.summary?.tasks?.completed ?? 0}</strong><span>tasks completed</span></div>
                  <div><strong>{report.result.summary?.quizzes?.attempts ?? 0}</strong><span>quizzes taken</span></div>
                  <div><strong>{report.result.summary?.quizzes?.averagePercentage ?? 0}%</strong><span>quiz average</span></div>
                  <div><strong>{report.result.summary?.study?.minutesStudied ?? 0}</strong><span>minutes studied</span></div>
                </div>
              )}
              {report.error_message && <p className="operations-error-text">{report.error_message}</p>}
            </article>
          ))}
        </div>
      )}

      <div className="pagination-controls">
        <button type="button" disabled={loading || offset === 0} onClick={() => loadReports(Math.max(0, offset - PAGE_SIZE))}>← Previous</button>
        <span>
          {pagination?.total == null
            ? `Showing ${reports.length}`
            : `${Math.min(offset + 1, pagination.total)}–${Math.min(offset + reports.length, pagination.total)} of ${pagination.total}`}
        </span>
        <button type="button" disabled={loading || !pagination?.hasMore} onClick={() => loadReports(pagination.nextOffset)}>Next →</button>
      </div>
    </div>
  );
}

export default WeeklyReports;

