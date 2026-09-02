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
    <section>
      <h2>Study Planner</h2>

      <form onSubmit={createTask}>
        <div>
          <label htmlFor="task-title">Task title</label>

          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Revise electricity"
          />
        </div>

        <div>
          <label htmlFor="task-subject">Subject</label>

          <select
            id="task-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          >
            <option value="General">General</option>
            <option value="Mathematics">Mathematics</option>
            <option value="English">English</option>
            <option value="Biology">Biology</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Physics">Physics</option>
            <option value="Economics">Economics</option>
          </select>
        </div>

        <div>
          <label htmlFor="task-description">Description</label>

          <textarea
            id="task-description"
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Topics or additional details"
          />
        </div>

        <div>
          <label htmlFor="task-date">Due date</label>

          <input
            id="task-date"
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div>
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

        <button
          type="submit"
          disabled={loading || !title.trim()}
        >
          {loading ? "Creating..." : "Create task"}
        </button>
      </form>

      {error && <p>Error: {error}</p>}

      <h3>Your Tasks</h3>

      {tasks.length === 0 && <p>No tasks created yet.</p>}

      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task)}
            />

            <strong>{task.title}</strong>
            <span> — {task.subject}</span>
            <span> — {task.priority} priority</span>

            {task.due_date && (
              <span>
                {" "}
                — Due:{" "}
                {new Date(task.due_date).toLocaleString()}
              </span>
            )}

            {task.description && <p>{task.description}</p>}

            <button
              type="button"
              onClick={() => deleteTask(task.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default TaskPlanner;