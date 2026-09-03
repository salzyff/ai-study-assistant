import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function TaskPlanner({ accessToken }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

useEffect(() => {
  function refreshTasks() {
    if (accessToken) {
      loadTasks();
    }
  }

  refreshTasks();
  window.addEventListener("tasks-updated", refreshTasks);

  return () => {
    window.removeEventListener(
      "tasks-updated",
      refreshTasks
    );
  };
}, [accessToken]);

  function getHeaders(includeJson = false) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  async function loadTasks() {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/tasks`, {
        headers: getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load tasks");
      }

      setTasks(data.tasks);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function createTask(event) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/tasks`, {
        method: "POST",
        headers: getHeaders(true),
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          subject,
          priority,
          dueDate: dueDate
            ? new Date(dueDate).toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create task");
      }

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

      const response = await fetch(
        `${API_URL}/api/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: getHeaders(true),
          body: JSON.stringify({
            completed: !task.completed,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update task");
      }

      await loadTasks();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteTask(taskId) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/tasks/${taskId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete task");
      }

      await loadTasks();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="task-app">
  
      <div className="task-app-title">
        <div>
          <h2>Task Planner</h2>
          <p>Create, manage, and track your study tasks.</p>
        </div>
  
        <div className="task-badge">✅ Smart Tasks</div>
      </div>
  
      <form className="task-generator" onSubmit={createTask}>
  
        <div className="task-form-grid">
  
          <div className="task-field task-field-wide">
            <label htmlFor="task-title">Task title</label>
  
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Revise quadratic equations"
              required
            />
          </div>
  
          <div className="task-field">
            <label htmlFor="task-subject">Subject</label>
  
            <select
              id="task-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              <option>General</option>
              <option>Mathematics</option>
              <option>English</option>
              <option>Biology</option>
              <option>Chemistry</option>
              <option>Physics</option>
              <option>Economics</option>
              <option>Digital Technology</option>
              <option>Further Mathematics</option>
            </select>
          </div>
  
          <div className="task-field">
            <label htmlFor="task-priority">Priority</label>
  
            <select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
  
          <div className="task-field">
            <label htmlFor="task-due-date">Due date</label>
  
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
  
          <div className="task-field task-field-wide">
            <label htmlFor="task-description">Description</label>
  
            <textarea
              id="task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add some details about this task..."
              rows="4"
            />
          </div>
  
        </div>
  
        <button
          className="create-task-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating..." : "＋ Create Task"}
        </button>
  
      </form>
  
      {error && (
        <div className="task-error">
          ⚠️ {error}
        </div>
      )}
  
      <div className="task-list-section">
  
        <div className="task-list-header">
          <div>
            <h3>Your Study Tasks</h3>
            <p>Stay organized and keep your study goals moving.</p>
          </div>
  
          <div className="task-count">
            {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"}
          </div>
        </div>
  
        {tasks.length === 0 ? (
          <div className="empty-tasks">
            <div className="empty-task-icon">📚</div>
            <h3>No tasks yet</h3>
            <p>Create your first study task to get started.</p>
          </div>
        ) : (
          <div className="task-list">
  
            {tasks.map((task) => (
              <div
                className={`task-item ${
                  task.completed ? "completed" : ""
                }`}
                key={task.id}
              >
  
                <div className="task-item-main">
  
                  <button
                    className="task-check"
                    type="button"
                    onClick={() => toggleTask(task)}
                    aria-label={
                      task.completed
                        ? "Mark task as incomplete"
                        : "Mark task as complete"
                    }
                  >
                    {task.completed ? "✓" : ""}
                  </button>
  
                  <div className="task-item-content">
  
                    <h4>{task.title}</h4>
  
                    {task.description && (
                      <p>{task.description}</p>
                    )}
  
                    <div className="task-meta">
  
                      {task.subject && (
                        <span className="task-subject">
                          📚 {task.subject}
                        </span>
                      )}
  
                      {task.priority && (
                        <span
                          className={`task-priority priority-${task.priority}`}
                        >
                          {task.priority === "high"
                            ? "🔴 High"
                            : task.priority === "medium"
                              ? "🟡 Medium"
                              : "🟢 Low"}
                        </span>
                      )}
  
                      {task.due_date && (
                        <span className="task-due">
                          📅 Due {task.due_date}
                        </span>
                      )}
  
                    </div>
  
                  </div>
  
                </div>
  
                <button
                  className="task-delete"
                  type="button"
                  onClick={() => deleteTask(task.id)}
                >
                  Delete
                </button>
  
              </div>
            ))}
  
          </div>
        )}
  
      </div>
  
    </section>
  );
}

export default TaskPlanner;