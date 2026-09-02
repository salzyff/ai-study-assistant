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
    <section>
      <h2>AI Study Plan Generator</h2>

      <form onSubmit={generatePlan}>
        <div>
          <label htmlFor="plan-subject">Subject</label>

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

        <div>
          <label htmlFor="plan-topics">Topics</label>

          <textarea
            id="plan-topics"
            value={topics}
            onChange={(event) =>
              setTopics(event.target.value)
            }
            placeholder="Algebra, graphs, simultaneous equations"
            required
          />
        </div>

        <div>
          <label htmlFor="exam-date">Exam date</label>

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

        <div>
          <label htmlFor="available-days">
            Number of study days
          </label>

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

        <button type="submit" disabled={loading}>
          {loading ? "Generating..." : "Generate study plan"}
        </button>
      </form>

      {message && <p>{message}</p>}
      {error && <p>Error: {error}</p>}

      {generatedTasks.length > 0 && (
        <>
          <h3>Generated Plan</h3>

          <ol>
            {generatedTasks.map((task) => (
              <li key={task.id}>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
                <p>
                  Due:{" "}
                  {new Date(task.due_date).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default StudyPlanGenerator;