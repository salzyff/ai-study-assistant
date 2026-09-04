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
        apiRequest(`/api/progress?days=${days}`, {
          accessToken,
        }),
        apiRequest("/api/progress/study-sessions?limit=30", {
          accessToken,
        }),
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
    const actualMinutes = Number(
      completionMinutes[session.id] ||
        session.planned_minutes
    );

    try {
      setLoading(true);
      setError("");

      await apiRequest(
        `/api/progress/study-sessions/${session.id}/complete`,
        {
          accessToken,
          method: "PATCH",
          body: { actualMinutes },
        }
      );

      setMessage("Study session completed");
      await loadProgress();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="progress-app">

      {/* HEADER */}
      <div className="progress-app-header">

        <div>
          <div className="progress-badge">
            📊 STUDY ANALYTICS
          </div>

          <h2>Study Progress</h2>

          <p>
            Track your study activity, quiz performance,
            sessions, and learning streak.
          </p>
        </div>

        <div className="progress-header-icon">
          📈
        </div>

      </div>

      {/* FILTER */}
      <div className="progress-filter-card">

        <div className="progress-filter-info">
          <span className="progress-filter-icon">
            📅
          </span>

          <div>
            <strong>Progress period</strong>
            <p>
              Choose how much of your recent activity
              you want to view.
            </p>
          </div>
        </div>

        <div className="progress-filter-actions">

          <select
            id="progress-days"
            value={days}
            onChange={(event) =>
              setDays(Number(event.target.value))
            }
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>

          <button
            type="button"
            className="progress-refresh-button"
            onClick={loadProgress}
          >
            ↻ Refresh
          </button>

        </div>

      </div>

      {/* STATISTICS */}
      {progress && (
        <>

          <div className="progress-stats-grid">

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                ✅
              </div>

              <div>
                <span>Tasks completed</span>
                <strong>
                  {progress.tasks.completed}
                  <small> / {progress.tasks.total}</small>
                </strong>
              </div>
            </div>

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                📝
              </div>

              <div>
                <span>Quiz average</span>
                <strong>
                  {progress.quizzes.averagePercentage}%
                </strong>
              </div>
            </div>

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                🏆
              </div>

              <div>
                <span>Best quiz</span>
                <strong>
                  {progress.quizzes.bestPercentage}%
                </strong>
              </div>
            </div>

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                ⏱️
              </div>

              <div>
                <span>Minutes studied</span>
                <strong>
                  {progress.study.minutesStudied}
                </strong>
              </div>
            </div>

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                🔥
              </div>

              <div>
                <span>Study streak</span>
                <strong>
                  {progress.study.streakDays}
                  <small> days</small>
                </strong>
              </div>
            </div>

            <div className="progress-stat-card">
              <div className="progress-stat-icon">
                🧠
              </div>

              <div>
                <span>Study sessions</span>
                <strong>
                  {progress.study.sessionsCompleted}
                </strong>
              </div>
            </div>

          </div>

          {/* FLASHCARD SUMMARY */}
          <div className="progress-summary-card">

            <div className="progress-summary-icon">
              🃏
            </div>

            <div>
              <strong>Flashcards remembered</strong>

              <p>
                {progress.flashcards.remembered} of{" "}
                {progress.flashcards.reviews} reviews
              </p>
            </div>

          </div>

          {/* SUBJECT PROGRESS */}
          <div className="progress-section-card">

            <div className="progress-section-header">
              <div>
                <h3>Progress by subject</h3>
                <p>
                  See how much time you have spent on
                  each subject.
                </p>
              </div>

              <span className="progress-section-icon">
                📚
              </span>
            </div>

            {progress.subjectProgress.length === 0 ? (

              <div className="progress-empty">
                <div>📚</div>

                <strong>No subject data yet</strong>

                <p>
                  Complete a quiz or study session to
                  see subject progress.
                </p>
              </div>

            ) : (

              <div className="progress-table-wrapper">

                <table className="progress-table">

                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Minutes</th>
                      <th>Sessions</th>
                      <th>Quiz average</th>
                    </tr>
                  </thead>

                  <tbody>
                    {progress.subjectProgress.map(
                      (item) => (
                        <tr key={item.subject}>

                          <td>
                            <strong>
                              {item.subject}
                            </strong>
                          </td>

                          <td>
                            {item.minutesStudied} min
                          </td>

                          <td>
                            {item.studySessions}
                          </td>

                          <td>
                            <span className="progress-score">
                              {item.quizAverage}%
                            </span>
                          </td>

                        </tr>
                      )
                    )}
                  </tbody>

                </table>

              </div>

            )}

          </div>

        </>

      )}

      {/* START STUDY SESSION */}
      <div className="progress-section-card">

        <div className="progress-section-header">

          <div>
            <h3>Start a study session</h3>

            <p>
              Record what you are studying and how
              long you plan to study.
            </p>
          </div>

          <span className="progress-section-icon">
            ⏱️
          </span>

        </div>

        <form
          className="progress-session-form"
          onSubmit={createSession}
        >

          <div className="progress-form-grid">

            <div className="progress-field">

              <label htmlFor="session-subject">
                Subject
              </label>

              <select
                id="session-subject"
                value={subject}
                onChange={(event) =>
                  setSubject(event.target.value)
                }
              >
                {SUBJECTS.map((subjectOption) => (
                  <option
                    value={subjectOption}
                    key={subjectOption}
                  >
                    {subjectOption}
                  </option>
                ))}
              </select>

            </div>

            <div className="progress-field">

              <label htmlFor="session-minutes">
                Planned minutes
              </label>

              <input
                id="session-minutes"
                type="number"
                min="5"
                max="180"
                value={plannedMinutes}
                onChange={(event) =>
                  setPlannedMinutes(event.target.value)
                }
              />

            </div>

          </div>

          <div className="progress-field">

            <label htmlFor="session-topic">
              Topic
            </label>

            <input
              id="session-topic"
              value={topic}
              onChange={(event) =>
                setTopic(event.target.value)
              }
              maxLength="200"
              placeholder="What are you going to study?"
              required
            />

          </div>

          <button
            className="start-session-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Starting..."
              : "▶ Start Study Session"}
          </button>

        </form>

      </div>

      {/* STUDY SESSIONS */}
      <div className="progress-section-card">

        <div className="progress-section-header">

          <div>
            <h3>Study sessions</h3>

            <p>
              Review and complete your recorded
              study sessions.
            </p>
          </div>

          <span className="progress-section-icon">
            📖
          </span>

        </div>

        {sessions.length === 0 ? (

          <div className="progress-empty">
            <div>📚</div>

            <strong>No sessions yet</strong>

            <p>
              Start your first study session above.
            </p>
          </div>

        ) : (

          <div className="study-session-list">

            {sessions.map((session) => (

              <div
                className={`study-session-item ${
                  session.completed
                    ? "completed-session"
                    : ""
                }`}
                key={session.id}
              >

                <div className="study-session-icon">
                  {session.completed ? "✅" : "📚"}
                </div>

                <div className="study-session-info">

                  <strong>
                    {session.subject}: {session.topic}
                  </strong>

                  <span>
                    Planned: {session.planned_minutes} minutes
                  </span>

                  {session.completed && (
                    <span className="completed-text">
                      Completed in{" "}
                      {session.actual_minutes} minutes
                    </span>
                  )}

                </div>

                {!session.completed && (

                  <div className="complete-session-area">

                    <label
                      htmlFor={`actual-${session.id}`}
                    >
                      Actual minutes
                    </label>

                    <div className="complete-session-controls">

                      <input
                        id={`actual-${session.id}`}
                        type="number"
                        min="1"
                        max="240"
                        value={
                          completionMinutes[session.id] ??
                          session.planned_minutes
                        }
                        onChange={(event) =>
                          setCompletionMinutes(
                            (values) => ({
                              ...values,
                              [session.id]:
                                event.target.value,
                            })
                          )
                        }
                      />

                      <button
                        type="button"
                        className="complete-session-button"
                        onClick={() =>
                          completeSession(session)
                        }
                        disabled={loading}
                      >
                        Complete
                      </button>

                    </div>

                  </div>

                )}

              </div>

            ))}

          </div>

        )}

      </div>

      {/* STATUS */}
      {loading && (
        <div className="progress-status progress-loading">
          ⏳ Working...
        </div>
      )}

      {message && (
        <div className="progress-status progress-success">
          ✅ {message}
        </div>
      )}

      {error && (
        <div
          className="progress-status progress-error"
          role="alert"
        >
          ⚠️ {error}
        </div>
      )}

    </section>
  );
}

export default Progress;