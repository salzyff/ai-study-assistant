import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

function Dashboard({ accessToken }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/dashboard", { accessToken });
      setDashboard(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  return (
    <section>
      <h2>Learning Dashboard</h2>
      <button type="button" onClick={loadDashboard} disabled={loading}>Refresh dashboard</button>

      {loading && <p>Loading...</p>}
      {error && <p role="alert">Error: {error}</p>}

      {dashboard && (
        <>
          <dl>
            <dt>Open tasks</dt><dd>{dashboard.cards.openTasks}</dd>
            <dt>Tasks due this week</dt><dd>{dashboard.cards.dueThisWeek}</dd>
            <dt>Overdue tasks</dt><dd>{dashboard.cards.overdueTasks}</dd>
            <dt>Quiz average</dt><dd>{dashboard.cards.quizAverage}%</dd>
            <dt>Minutes studied</dt><dd>{dashboard.cards.minutesStudied}</dd>
            <dt>Study streak</dt><dd>{dashboard.cards.studyStreak} days</dd>
            <dt>Saved notes</dt><dd>{dashboard.cards.savedNotes}</dd>
            <dt>Flashcard sets</dt><dd>{dashboard.cards.flashcardSets}</dd>
          </dl>

          <h3>Daily AI usage</h3>
          <p>{dashboard.aiUsage.used} of {dashboard.aiUsage.limit} used. {dashboard.aiUsage.remaining} remaining today.</p>

          <h3>Subject progress</h3>
          {dashboard.subjectProgress.length === 0 ? (
            <p>No subject activity yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Subject</th><th>Minutes</th><th>Study sessions</th><th>Quiz attempts</th><th>Quiz average</th></tr>
              </thead>
              <tbody>
                {dashboard.subjectProgress.map((item) => (
                  <tr key={item.subject}>
                    <td>{item.subject}</td>
                    <td>{item.minutesStudied}</td>
                    <td>{item.studySessions}</td>
                    <td>{item.quizAttempts}</td>
                    <td>{item.quizAverage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

export default Dashboard;
