import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import DeleteConfirmation from "./DeleteConfirmation";

function TaskPlanner({ accessToken }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studySession, setStudySession] = useState(null);
  const [studySessionLoading, setStudySessionLoading] = useState("");
  const [actualMinutes, setActualMinutes] = useState(25);
  const [studyMessage, setStudyMessage] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      setError("");
      const data = await apiRequest("/api/tasks", { accessToken });
      setTasks(data.tasks || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [accessToken]);

  useEffect(() => {
    function refreshTasks() {
      if (accessToken) {
        loadTasks();
      }
    }

    const timer = window.setTimeout(refreshTasks, 0);
    window.addEventListener("tasks-updated", refreshTasks);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("tasks-updated", refreshTasks);
    };
  }, [accessToken, loadTasks]);

  async function resumeStudySession() {
    if(loading) return;
    setLoading(true); setError("");
    try {
      const data=await apiRequest('/api/study-upgrades/task-resume',{accessToken});
      setStudySession(data.studySession);
      setStudyMessage(data.studySession ? "Study session restored." : "No unfinished study session found.");
    } catch(e){setError(e.message);}finally{setLoading(false);}
  }

  async function createTask(event) {
    event.preventDefault();
    if (loading || !title.trim()) return;

    try {
      setLoading(true);
      setError("");
      await apiRequest("/api/tasks", {
        accessToken,
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim() || null,
          subject,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        },
      });

      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      await loadTasks();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTask(task) {
    try {
      setError("");
      await apiRequest(`/api/tasks/${task.id}`, {
        accessToken,
        method: "PATCH",
        body: { completed: !task.completed },
      });
      await loadTasks();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteTask(taskId) {
    setError("");
    await apiRequest(`/api/tasks/${taskId}`, {
      accessToken,
      method: "DELETE",
    });
    setTasks((current) => current.filter((task) => task.id !== taskId));
    window.dispatchEvent(new Event("tasks-updated"));
  }

  async function createAiStudySession(task) {
    if (studySessionLoading || loading) return;
    try {
      setStudySessionLoading(task.id);
      setError("");
      setStudyMessage("");
      const data = await apiRequest(`/api/tasks/${task.id}/study-session`, {
        accessToken,
        method: "POST",
      });
      setStudySession(data);
      setActualMinutes(data.session.estimated_minutes);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStudySessionLoading("");
    }
  }

  async function completeAiStudySession() {
    if (!studySession || loading) return;

    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/progress/study-sessions/${studySession.sessionId}/complete`, {
        accessToken,
        method: "PATCH",
        body: { actualMinutes: Number(actualMinutes) },
      });
      setStudyMessage("Study session completed and task marked as done");
      setStudySession(null);
      await loadTasks();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="task-app">
      <div className="task-app-title">
        <div>
          <h2>Task Planner</h2>
          <p>Create, manage, and track your study tasks.</p>
        </div>
        
      </div>

      <button type="button" className="task-study-button" disabled={loading} onClick={resumeStudySession}>Resume latest study session</button>
      <form className="task-generator" onSubmit={createTask}>
        <div className="task-form-grid">
          <div className="task-field task-field-wide">
            <label htmlFor="task-title">Task title</label>
            <input id="task-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength="160" placeholder="e.g. Revise quadratic equations" required />
          </div>
          <div className="task-field">
            <label htmlFor="task-subject">Subject</label>
            <select id="task-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
              {SUBJECTS.map((subjectOption) => (
                <option value={subjectOption} key={subjectOption}>{subjectOption}</option>
              ))}
            </select>
          </div>
          <div className="task-field">
            <label htmlFor="task-priority">Priority</label>
            <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          </div>
          <div className="task-field">
            <label htmlFor="task-due-date">Due date</label>
            <input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div className="task-field task-field-wide">
            <label htmlFor="task-description">Description</label>
            <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength="2000" placeholder="Add some details about this task..." rows="4" />
          </div>
        </div>
        <button className="create-task-button" type="submit" disabled={loading}>{loading ? "Creating..." : "＋ Create Task"}</button>
      </form>

      {error && <div className="task-error">⚠️ {error}</div>}

      <div className="task-list-section">
        <div className="task-list-header">
          <div><h3>Your Study Tasks</h3><p>Stay organized and keep your study goals moving.</p></div>
          <div className="task-count">{tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}</div>
        </div>

        {tasks.length === 0 ? (
          <div className="empty-tasks"><div className="empty-task-icon">📚</div><h3>No tasks yet</h3><p>Create your first study task to get started.</p></div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div className={`task-item ${task.completed ? "completed" : ""}`} key={task.id}>
                <div className="task-item-main">
                  <button className="task-check" type="button" onClick={() => toggleTask(task)} aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}>{task.completed ? "✓" : ""}</button>
                  <div className="task-item-content">
                    <h4>{task.title}</h4>
                    {task.description && <p>{task.description}</p>}
                    <div className="task-meta">
                      {task.subject && <span className="task-subject">📚 {task.subject}</span>}
                      {task.priority && <span className={`task-priority priority-${task.priority}`}>{task.priority === "high" ? "🔴 High" : task.priority === "medium" ? "🟡 Medium" : "🟢 Low"}</span>}
                      {task.due_date && <span className="task-due">📅 Due {task.due_date}</span>}
                    </div>
                  </div>
                </div>
                <div className="task-actions">
                  {!task.completed && (
                    <button className="task-study-button" type="button" onClick={() => createAiStudySession(task)} disabled={Boolean(studySessionLoading) || loading}>
                      {studySessionLoading === task.id ? "Generating..." : "Create AI study session"}
                    </button>
                  )}{" "}
                  <DeleteConfirmation
                    className="task-delete"
                    disabled={Boolean(studySessionLoading) || loading}
                    confirmation={`Delete “${task.title}” permanently?`}
                    onConfirm={() => deleteTask(task.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {studySession && (
        <section>
          <h3>{studySession.session.title}</h3>
          <p><strong>Objective:</strong> {studySession.session.objective}</p>
          <p><strong>Warm-up:</strong> {studySession.session.warm_up}</p>
          <ol>
            {studySession.session.steps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <strong>{step.title} ({step.minutes} minutes)</strong>
                <p>{step.instruction}</p>
              </li>
            ))}
          </ol>
          <p><strong>Self-check:</strong> {studySession.session.self_check}</p>
          <p><strong>Finish line:</strong> {studySession.session.finish_line}</p>
          <label htmlFor="task-session-minutes">Minutes actually studied </label>
          <input
            id="task-session-minutes"
            type="number"
            min="1"
            max="240"
            value={actualMinutes}
            onChange={(event) => setActualMinutes(event.target.value)}
          />{" "}
          <button type="button" onClick={completeAiStudySession} disabled={loading}>Complete study session</button>
        </section>
      )}

      {studyMessage && <p>{studyMessage}</p>}
    </section>
  );
}

export default TaskPlanner;
