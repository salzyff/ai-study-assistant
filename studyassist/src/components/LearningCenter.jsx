import { useState } from "react";
import LearningReview from "./LearningReview";
import QuestionBank from "./QuestionBank";
import StudyGoals from "./StudyGoals";
import TeachBack from "./TeachBack";
import "./LearningCenter.css";

function LearningCenter({ accessToken }) {
  const [section, setSection] = useState("review");

  const tabs = [
    {
      id: "review",
      icon: "📝",
      title: "Daily Review",
      description: "Review mistakes and progress",
    },
    {
      id: "teach",
      icon: "🎓",
      title: "Teach-Back",
      description: "Explain what you've learned",
    },
    {
      id: "bank",
      icon: "📚",
      title: "Question Bank",
      description: "Practice questions",
    },
    {
      id: "goals",
      icon: "🎯",
      title: "Study Goals",
      description: "Set and track your goals",
    },
  ];

  return (
    <section className="learning-center">
      <div className="learning-center-header">
        <span className="learning-center-label">
          YOUR STUDY HUB
        </span>

        <h1>Learning Center 📚</h1>

        <p>
          Practice, review, set goals, and strengthen your understanding.
        </p>
      </div>

      <div className="learning-center-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`learning-center-tab ${
              section === tab.id ? "active" : ""
            }`}
            onClick={() => setSection(tab.id)}
          >
            <span className="learning-center-tab-icon">
              {tab.icon}
            </span>

            <span className="learning-center-tab-title">
              {tab.title}
            </span>

            <span className="learning-center-tab-description">
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      <div className="learning-center-content">
        {section === "review" && (
          <LearningReview accessToken={accessToken} />
        )}

        {section === "teach" && (
          <TeachBack accessToken={accessToken} />
        )}

        {section === "bank" && (
          <QuestionBank accessToken={accessToken} />
        )}

        {section === "goals" && (
          <StudyGoals accessToken={accessToken} />
        )}
      </div>
    </section>
  );
}

export default LearningCenter;