import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function StudyPlanGenerator({ accessToken }) {
  const [subject, setSubject] = useState("Mathematics");
  const [topics, setTopics] = useState("");
  const [examDate, setExamDate] = useState("");
  const [availableDays, setAvailableDays] = useState(7);
  const [generatedTasks, setGeneratedTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function generatePlan(event) {
    event.preventDefault();

    if (!topics.trim() || !examDate) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      setGeneratedTasks([]);

      const response = await fetch(
        `${API_URL}/api/study-plans/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject,
            topics: topics.trim(),
            examDate: new Date(
              `${examDate}T23:59:00`
            ).toISOString(),
            availableDays: Number(availableDays),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate the study plan"
        );
      }

      setGeneratedTasks(data.tasks);
      setMessage(
        `${data.tasks.length} study tasks were created`
      );

      window.dispatchEvent(new Event("tasks-updated"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="plan-app">

      <div className="plan-app-title">
        <div>
          <h2>AI Study Plan Generator</h2>
          <p>Create a personalized study schedule for your exam.</p>
        </div>

        <div className="plan-badge">📅 Smart Planner</div>
      </div>

      <form className="plan-generator" onSubmit={generatePlan}>

        <div className="plan-field">
          <label htmlFor="plan-subject">📚 Subject</label>

          <select
            id="plan-subject"
            value={subject}
            onChange={(event) =>
              setSubject(event.target.value)
            }
          >
            <option value="Mathematics">Mathematics</option>
            <option value="English">English</option>
            <option value="Biology">Biology</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Physics">Physics</option>
            <option value="Economics">Economics</option>
          </select>
        </div>

        <div className="plan-field plan-topics-field">
          <label htmlFor="plan-topics">📖 Topics</label>

          <textarea
            id="plan-topics"
            value={topics}
            onChange={(event) =>
              setTopics(event.target.value)
            }
            placeholder="e.g. Algebra, graphs, simultaneous equations"
            required
          />
        </div>

        <div className="plan-field">
          <label htmlFor="exam-date">📆 Exam Date</label>

          <input
            id="exam-date"
            type="date"
            value={examDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(event) =>
              setExamDate(event.target.value)
            }
            required
          />
        </div>

        <div className="plan-field">
          <label htmlFor="available-days">⏱️ Study Days</label>

          <input
            id="available-days"
            type="number"
            min="1"
            max="14"
            value={availableDays}
            onChange={(event) =>
              setAvailableDays(event.target.value)
            }
          />
        </div>

        <button
          className="generate-plan-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Generating..." : "✨ Generate Study Plan"}
        </button>

      </form>

      {message && (
        <div className="plan-success">
          ✓ {message}
        </div>
      )}

      {error && (
        <div className="plan-error">
          ⚠️ {error}
        </div>
      )}

      {generatedTasks.length > 0 && (
        <div className="generated-plan">

          <div className="generated-plan-header">
            <div>
              <span>YOUR PERSONALIZED SCHEDULE</span>
              <h3>Generated Plan</h3>
            </div>

            <div className="task-count">
              {generatedTasks.length} Tasks
            </div>
          </div>

          <div className="plan-task-list">

            {generatedTasks.map((task, index) => (
              <article
                className="plan-task"
                key={task.id}
              >

                <div className="plan-task-number">
                  {index + 1}
                </div>

                <div className="plan-task-content">
                  <h4>{task.title}</h4>

                  <p>{task.description}</p>

                  <div className="plan-due-date">
                    📅 Due:{" "}
                    {new Date(
                      task.due_date
                    ).toLocaleString()}
                  </div>
                </div>

              </article>
            ))}

          </div>

        </div>
      )}

    </section>
  );
}

export default StudyPlanGenerator;