import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./LearningReview.css";

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

      const [mistakeData, recommendationData, queueData] =
        await Promise.all([
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

  const queueSections = [
    {
      key: "dueFlashcards",
      icon: "🃏",
      title: "Due Flashcards",
      items: queue?.dueFlashcards || [],
      render: (card) => (
        <>
          <strong>{card.set?.subject}</strong>: {card.front}
        </>
      ),
    },
    {
      key: "openTasks",
      icon: "📋",
      title: "Open Tasks",
      items: queue?.openTasks || [],
      render: (task) => (
        <>
          <strong>{task.subject}</strong>: {task.title}
          {task.due_date
            ? ` — due ${new Date(task.due_date).toLocaleDateString()}`
            : ""}
        </>
      ),
    },
    {
      key: "weakTopics",
      icon: "📈",
      title: "Weak Topics",
      items: queue?.weakTopics || [],
      render: (topic) => (
        <>
          <strong>{topic.subject}</strong>: {topic.topic} —{" "}
          {topic.mastery_score}% mastery
        </>
      ),
    },
    {
      key: "mistakes",
      icon: "⚠️",
      title: "Unresolved Mistakes",
      items: queue?.mistakes || [],
      render: (mistake) => (
        <>
          <strong>{mistake.subject}</strong>: {mistake.topic} — missed{" "}
          {mistake.times_missed} time(s)
        </>
      ),
    },
    {
      key: "activeGoals",
      icon: "🎯",
      title: "Active Goals",
      items: queue?.activeGoals || [],
      render: (goal) => (
        <>
          <strong>{goal.title}</strong>: {goal.current_value}/
          {goal.target_value}
        </>
      ),
    },
  ];

  return (
    <section className="learning-review">
      <div className="learning-review-header">
        <div>
          <span className="learning-review-label">
            SMART REVISION
          </span>

          <h2>Daily Revision Queue 📝</h2>

          <p>
            Focus on the areas that need your attention most.
          </p>
        </div>

        <button
          type="button"
          className="learning-review-refresh"
          onClick={loadReview}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {!queue ? (
        <div className="review-loading">
          No revision queue loaded yet.
        </div>
      ) : (
        <div className="review-queue">
          {queueSections.map((section) => (
            <div className="review-card" key={section.key}>
              <div className="review-card-header">
                <div className="review-card-title">
                  <span className="review-card-icon">
                    {section.icon}
                  </span>

                  {section.title}
                </div>

                <span className="review-count">
                  {section.items.length}
                </span>
              </div>

              {section.items.length === 0 ? (
                <p className="review-empty">
                  Nothing here right now. Nice work!
                </p>
              ) : (
                <ul className="review-list">
                  {section.items.map((item) => (
                    <li
                      className="review-list-item"
                      key={item.id}
                    >
                      {section.render(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="review-section">
        <div className="review-section-header">
          <h2>Weak-Topic Recommendations 💡</h2>
          <p>
            Topics that could use some extra practice.
          </p>
        </div>

        {recommendations.length === 0 ? (
          <p className="review-empty">
            Complete some quizzes to create recommendations.
          </p>
        ) : (
          <div className="recommendation-list">
            {recommendations.map((item) => (
              <div
                className="recommendation-item"
                key={`${item.subject}-${item.topic}`}
              >
                <strong>
                  {item.subject}: {item.topic}
                </strong>

                <p>
                  {item.mastery_score}% mastery •{" "}
                  {item.unresolvedMistakes} unresolved mistake(s).
                  <br />
                  {item.action}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="review-section">
        <div className="review-section-header">
          <h2>Mistake Notebook 📖</h2>
          <p>
            Review your mistakes and learn from them.
          </p>
        </div>

        {mistakes.length === 0 ? (
          <p className="review-empty">
            No unresolved mistakes. Nice work! 🎉
          </p>
        ) : (
          <div className="mistake-list">
            {mistakes.map((mistake) => (
              <article
                className="mistake-card"
                key={mistake.id}
              >
                <h3>
                  {mistake.subject}: {mistake.topic}
                </h3>

                <div className="mistake-question">
                  {mistake.question}
                </div>

                <p className="mistake-answer">
                  <strong>Your answer:</strong>{" "}
                  {mistake.selected_option === null
                    ? "No answer"
                    : mistake.options[mistake.selected_option]}
                </p>

                <p className="mistake-answer mistake-correct">
                  <strong>Correct answer:</strong>{" "}
                  {mistake.options[mistake.correct_option]}
                </p>

                <div className="mistake-explanation">
                  <strong>Explanation:</strong>
                  <br />
                  {mistake.explanation}
                </div>

                <p className="mistake-meta">
                  Missed {mistake.times_missed} time(s)
                </p>

                <button
                  type="button"
                  className="review-mark-button"
                  onClick={() => resolveMistake(mistake.id)}
                >
                  ✓ Mark Reviewed
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <p className="review-loading">
          Loading your revision data...
        </p>
      )}

      {error && (
        <p className="review-error" role="alert">
          Error: {error}
        </p>
      )}
    </section>
  );
}

export default LearningReview;