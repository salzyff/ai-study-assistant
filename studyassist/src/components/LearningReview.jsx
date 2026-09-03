import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";

function LearningReview({ accessToken }) {
  const [mistakes, setMistakes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReview = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [mistakeData, recommendationData, queueData] = await Promise.all([
        apiRequest("/api/learning/mistakes", { accessToken }),
        apiRequest("/api/learning/recommendations", { accessToken }),
        apiRequest("/api/learning/daily-queue", { accessToken }),
      ]);
      setMistakes(mistakeData.mistakes || []);
      setRecommendations(recommendationData.recommendations || []);
      setQueue(queueData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadReview, 0);
    return () => window.clearTimeout(timer);
  }, [loadReview]);

  async function resolveMistake(mistakeId) {
    try {
      setError("");
      await apiRequest(`/api/learning/mistakes/${mistakeId}`, {
        accessToken,
        method: "PATCH",
        body: { resolved: true },
      });
      await loadReview();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section>
      <h2>Daily revision queue</h2>
      <button type="button" onClick={loadReview} disabled={loading}>Refresh queue</button>
      {!queue ? <p>No queue loaded.</p> : (
        <>
          <h3>Due flashcards ({queue.dueFlashcards?.length || 0})</h3>
          <ul>{queue.dueFlashcards?.map((card) => <li key={card.id}>{card.set?.subject}: {card.front}</li>)}</ul>
          <h3>Open tasks ({queue.openTasks?.length || 0})</h3>
          <ul>{queue.openTasks?.map((task) => <li key={task.id}>{task.subject}: {task.title} {task.due_date ? `— due ${new Date(task.due_date).toLocaleDateString()}` : ""}</li>)}</ul>
          <h3>Weak topics ({queue.weakTopics?.length || 0})</h3>
          <ul>{queue.weakTopics?.map((topic) => <li key={topic.id}>{topic.subject}: {topic.topic} — {topic.mastery_score}% mastery</li>)}</ul>
          <h3>Unresolved mistakes ({queue.mistakes?.length || 0})</h3>
          <ul>{queue.mistakes?.map((mistake) => <li key={mistake.id}>{mistake.subject}: {mistake.topic} — missed {mistake.times_missed} time(s)</li>)}</ul>
          <h3>Active goals ({queue.activeGoals?.length || 0})</h3>
          <ul>{queue.activeGoals?.map((goal) => <li key={goal.id}>{goal.title}: {goal.current_value}/{goal.target_value}</li>)}</ul>
        </>
      )}

      <hr />
      <h2>Weak-topic recommendations</h2>
      {recommendations.length === 0 ? <p>Complete some quizzes to create recommendations.</p> : (
        <ul>
          {recommendations.map((item) => (
            <li key={`${item.subject}-${item.topic}`}>
              <strong>{item.subject}: {item.topic}</strong> — {item.mastery_score}% mastery, {item.unresolvedMistakes} unresolved mistake(s). {item.action}
            </li>
          ))}
        </ul>
      )}

      <hr />
      <h2>Mistake notebook</h2>
      {mistakes.length === 0 ? <p>No unresolved mistakes. Nice work.</p> : mistakes.map((mistake) => (
        <article key={mistake.id}>
          <h3>{mistake.subject}: {mistake.topic}</h3>
          <p>{mistake.question}</p>
          <p>Your answer: {mistake.selected_option === null ? "No answer" : mistake.options[mistake.selected_option]}</p>
          <p>Correct answer: {mistake.options[mistake.correct_option]}</p>
          <p>{mistake.explanation}</p>
          <p>Missed {mistake.times_missed} time(s)</p>
          <button type="button" onClick={() => resolveMistake(mistake.id)}>Mark reviewed</button>
        </article>
      ))}

      {loading && <p>Loading...</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default LearningReview;
