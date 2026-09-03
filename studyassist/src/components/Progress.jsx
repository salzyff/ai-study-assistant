import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";

function Progress({ accessToken }) {
  const [days, setDays] = useState(30);
  const [progress, setProgress] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [subject, setSubject] = useState("General");
  const [topic, setTopic] = useState("");
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [completionMinutes, setCompletionMinutes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProgress = useCallback(async () => {
    try {
      setError("");
      const [progressData, sessionsData] = await Promise.all([
        apiRequest(`/api/progress?days=${days}`, { accessToken }),
        apiRequest("/api/progress/study-sessions?limit=30", { accessToken }),
      ]);
      setProgress(progressData);
      setSessions(sessionsData.sessions || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [accessToken, days]);

  useEffect(() => {
    const timer = window.setTimeout(loadProgress, 0);
    return () => window.clearTimeout(timer);
  }, [loadProgress]);

  async function createSession(event) {
    event.preventDefault();
    if (!topic.trim()) return;

    try {
      setLoading(true);
      setError("");
      setMessage("");
      await apiRequest("/api/progress/study-sessions", {
        accessToken,
        method: "POST",
        body: {
          subject,
          topic: topic.trim(),
          plannedMinutes: Number(plannedMinutes),
        },
      });
      setTopic("");
      setMessage("Study session started");
      await loadProgress();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function completeSession(session) {
    const actualMinutes = Number(completionMinutes[session.id] || session.planned_minutes);

    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/progress/study-sessions/${session.id}/complete`, {
        accessToken,
        method: "PATCH",
        body: { actualMinutes },
      });
      setMessage("Study session completed");
      await loadProgress();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Study Progress</h2>

      <p>
        <label htmlFor="progress-days">Progress period</label>{" "}
        <select id="progress-days" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">365 days</option>
        </select>{" "}
        <button type="button" onClick={loadProgress}>Refresh</button>
      </p>

      {progress && (
        <>
          <dl>
            <dt>Tasks completed</dt><dd>{progress.tasks.completed} of {progress.tasks.total}</dd>
            <dt>Quiz average</dt><dd>{progress.quizzes.averagePercentage}%</dd>
            <dt>Best quiz</dt><dd>{progress.quizzes.bestPercentage}%</dd>
            <dt>Study sessions</dt><dd>{progress.study.sessionsCompleted}</dd>
            <dt>Minutes studied</dt><dd>{progress.study.minutesStudied}</dd>
            <dt>Study streak</dt><dd>{progress.study.streakDays} days</dd>
            <dt>Flashcards remembered</dt><dd>{progress.flashcards.remembered} of {progress.flashcards.reviews} reviews</dd>
          </dl>

          <h3>Progress by subject</h3>
          {progress.subjectProgress.length === 0 ? (
            <p>Complete a quiz or study session to see subject progress.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Subject</th><th>Minutes</th><th>Sessions</th><th>Quiz average</th></tr>
              </thead>
              <tbody>
                {progress.subjectProgress.map((item) => (
                  <tr key={item.subject}>
                    <td>{item.subject}</td>
                    <td>{item.minutesStudied}</td>
                    <td>{item.studySessions}</td>
                    <td>{item.quizAverage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <hr />

      <h3>Start a study timer</h3>
      <form onSubmit={createSession}>
        <p>
          <label htmlFor="session-subject">Subject</label><br />
          <select id="session-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            {SUBJECTS.map((subjectOption) => (
              <option value={subjectOption} key={subjectOption}>{subjectOption}</option>
            ))}
          </select>
        </p>
        <p>
          <label htmlFor="session-topic">Topic</label><br />
          <input id="session-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength="200" required />
        </p>
        <p>
          <label htmlFor="session-minutes">Planned minutes</label><br />
          <input id="session-minutes" type="number" min="5" max="180" value={plannedMinutes} onChange={(event) => setPlannedMinutes(event.target.value)} />
        </p>
        <button type="submit" disabled={loading}>Start session</button>
      </form>

      <h3>Study sessions</h3>
      {sessions.length === 0 ? (
        <p>No sessions yet.</p>
      ) : (
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              <strong>{session.subject}: {session.topic}</strong> — planned {session.planned_minutes} minutes
              {session.completed ? (
                <span> — completed in {session.actual_minutes} minutes</span>
              ) : (
                <div>
                  <label htmlFor={`actual-${session.id}`}>Actual minutes </label>
                  <input
                    id={`actual-${session.id}`}
                    type="number"
                    min="1"
                    max="240"
                    value={completionMinutes[session.id] ?? session.planned_minutes}
                    onChange={(event) => setCompletionMinutes((values) => ({ ...values, [session.id]: event.target.value }))}
                  />{" "}
                  <button type="button" onClick={() => completeSession(session)} disabled={loading}>Complete session</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {loading && <p>Working...</p>}
      {message && <p>{message}</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default Progress;
