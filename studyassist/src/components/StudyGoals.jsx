import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import DeleteConfirmation from "./DeleteConfirmation";

function oneWeekFromNow() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function StudyGoals({ accessToken }) {
  const [goals, setGoals] = useState([]);
  const [subject, setSubject] = useState("General");
  const [title, setTitle] = useState("");
  const [targetType, setTargetType] = useState("study_minutes");
  const [targetValue, setTargetValue] = useState(120);
  const [periodEnd, setPeriodEnd] = useState(oneWeekFromNow);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/goals", { accessToken });
      setGoals(data.goals || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadGoals, 0);
    return () => window.clearTimeout(timer);
  }, [loadGoals]);

  async function createGoal(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await apiRequest("/api/goals", {
        accessToken,
        method: "POST",
        body: {
          subject,
          title,
          targetType,
          targetValue: Number(targetValue),
          periodEnd: new Date(`${periodEnd}T23:59:59`).toISOString(),
        },
      });
      setTitle("");
      await loadGoals();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteGoal(goalId) {
    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/goals/${goalId}`, { accessToken, method: "DELETE" });
      await loadGoals();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Weekly study goals</h2>
      <form onSubmit={createGoal}>
        <p>
          <label htmlFor="goal-subject">Subject</label><br />
          <select id="goal-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            {SUBJECTS.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </p>
        <p><label htmlFor="goal-title">Goal title</label><br /><input id="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength="160" required /></p>
        <p>
          <label htmlFor="goal-type">Track</label><br />
          <select id="goal-type" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
            <option value="study_minutes">Study minutes completed</option>
            <option value="sessions_completed">Study sessions completed</option>
            <option value="tasks_completed">Tasks completed</option>
            <option value="quiz_score">Best quiz percentage</option>
          </select>
        </p>
        <p><label htmlFor="goal-target">Target value</label><br /><input id="goal-target" type="number" min="1" max="10000" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></p>
        <p><label htmlFor="goal-end">Deadline</label><br /><input id="goal-end" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></p>
        <button type="submit" disabled={loading}>Create goal</button>
      </form>

      <h3>Your goals</h3>
      {goals.length === 0 ? <p>No goals yet.</p> : (
        <ul>
          {goals.map((goal) => (
            <li key={goal.id}>
              <strong>{goal.title}</strong> ({goal.subject}) — {goal.current_value}/{goal.target_value} ({goal.percentage ?? 0}%) — {goal.completed ? "Complete" : `due ${new Date(goal.period_end).toLocaleDateString()}`} {" "}
              <DeleteConfirmation
                confirmation={`Delete the goal “${goal.title}” permanently?`}
                onConfirm={() => deleteGoal(goal.id)}
                disabled={loading}
              />
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={loadGoals} disabled={loading}>Refresh progress</button>
      {loading && <p>Working...</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default StudyGoals;
