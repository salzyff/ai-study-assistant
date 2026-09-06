import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import "./Dashboard.css";

function Dashboard({ accessToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await apiRequest("/api/dashboard", {
        accessToken,
      });

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">📊</div>
          <h2>Loading your dashboard...</h2>
          <p>Getting your latest study statistics.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">
          <div className="dashboard-error-icon">⚠️</div>
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>

          <button
            type="button"
            className="dashboard-refresh"
            onClick={loadDashboard}
          >
            ↻ Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const cards = [
    {
      icon: "📋",
      title: "Open Tasks",
      value: data.cards.openTasks,
      className: "blue",
    },
    {
      icon: "📅",
      title: "Due This Week",
      value: data.cards.dueThisWeek,
      className: "purple",
    },
    {
      icon: "⚠️",
      title: "Overdue Tasks",
      value: data.cards.overdueTasks,
      className: "orange",
    },
    {
      icon: "🎯",
      title: "Quiz Average",
      value: `${data.cards.quizAverage}%`,
      className: "green",
    },
    {
      icon: "⏱️",
      title: "Minutes Studied",
      value: data.cards.minutesStudied,
      className: "cyan",
    },
    {
      icon: "🔥",
      title: "Study Streak",
      value: `${data.cards.studyStreak} days`,
      className: "red",
    },
    {
      icon: "📄",
      title: "Saved Notes",
      value: data.cards.savedNotes,
      className: "pink",
    },
    {
      icon: "🃏",
      title: "Flashcard Sets",
      value: data.cards.flashcardSets,
      className: "yellow",
    },
  ];

  const aiLimit = Number(data.aiUsage.limit) || 0;
  const aiUsed = Number(data.aiUsage.used) || 0;

  const aiPercentage =
    aiLimit > 0
      ? Math.min(Math.round((aiUsed / aiLimit) * 100), 100)
      : 0;

  return (
    <div className="dashboard-page">

      <div className="dashboard-header">
        <div className="dashboard-heading">
          

          <h2>
            Welcome back! 👋
          </h2>

          <p>
            Keep learning, keep improving, and stay on top of your goals.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={loadDashboard}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="dashboard-hero">
        <div className="dashboard-hero-icon">
          🧠
        </div>

        <div className="dashboard-hero-text">
          <span>STUDYAI</span>
          <h3>Your progress at a glance</h3>
          <p>
            Check your tasks, study time, quiz performance, and learning
            activity all in one place.
          </p>
        </div>

        <div className="dashboard-hero-stat">
          <strong>{data.cards.studyStreak}</strong>
          <span>Day Streak 🔥</span>
        </div>
      </div>

      <div className="dashboard-cards">
        {cards.map((card) => (
          <div
            className={`dashboard-card dashboard-card-${card.className}`}
            key={card.title}
          >
            <div className="dashboard-card-top">
              <div className="dashboard-card-icon">
                {card.icon}
              </div>
            </div>

            <p>{card.title}</p>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-section dashboard-ai-section">
        <div className="dashboard-section-header">
          <div>
            
            <h3>Daily AI Usage 🤖</h3>
          </div>

          <div className="ai-usage-number">
            {data.aiUsage.remaining}
            <span> left</span>
          </div>
        </div>

        <div className="ai-usage-info">
          <span>
            {data.aiUsage.used} of {data.aiUsage.limit} requests used
          </span>

          <span>
            {aiPercentage}%
          </span>
        </div>

        <div className="ai-progress-bar">
          <div
            className="ai-progress-fill"
            style={{ width: `${aiPercentage}%` }}
          />
        </div>

        <p className="ai-usage-note">
          You have {data.aiUsage.remaining} AI requests remaining today.
        </p>
      </div>

      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <div>
            <span className="section-label">PERFORMANCE</span>
            <h3>Subject Progress 📚</h3>
          </div>
        </div>

        {data.subjectProgress.length === 0 ? (
          <div className="dashboard-empty">
            <div>📚</div>
            <h4>No subject activity yet</h4>
            <p>
              Complete a quiz or study session to start seeing your
              subject progress here.
            </p>
          </div>
        ) : (
          <div className="subject-progress-list">
            {data.subjectProgress.map((item) => {
              const percentage = Math.min(
                Math.max(Number(item.quizAverage) || 0, 0),
                100
              );

              return (
                <div
                  className="subject-progress-item"
                  key={item.subject}
                >
                  <div className="subject-progress-top">
                    <div className="subject-name">
                      <span className="subject-dot" />
                      <strong>{item.subject}</strong>
                    </div>

                    <strong>{item.quizAverage}%</strong>
                  </div>

                  <div className="subject-progress-bar">
                    <div
                      className="subject-progress-fill"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="subject-progress-stats">
                    <span>⏱ {item.minutesStudied} min</span>
                    <span>📚 {item.studySessions} sessions</span>
                    <span>🎯 {item.quizAttempts} quizzes</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;
