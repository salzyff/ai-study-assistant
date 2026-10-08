import ChatIcon from "./ChatIcon";
import { useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import "./TeachBack.css";

function TeachBack({ accessToken }) {
  const [subject, setSubject] = useState("Biology");
  const [topic, setTopic] = useState("");
  const [explanation, setExplanation] = useState("");
  const [teachResult, setTeachResult] = useState(null);

  const [question, setQuestion] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [markingPoints, setMarkingPoints] = useState("");
  const [maxMarks, setMaxMarks] = useState(5);
  const [markResult, setMarkResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitTeachBack(event) {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/api/learning/teach-back", {
        accessToken,
        method: "POST",
        body: {
          subject,
          topic,
          explanation,
        },
      });

      setTeachResult(data.attempt);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAnswer(event) {
    event.preventDefault();

    const points = markingPoints
      .split("\n")
      .map((point) => point.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/api/learning/mark-written", {
        accessToken,
        method: "POST",
        body: {
          subject,
          topic,
          question,
          studentAnswer,
          markingPoints: points,
          maxMarks: Number(maxMarks),
        },
      });

      setMarkResult(data.assessment);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="teach-back">

      {/* Header */}
      <div className="teach-back-header">
        <h2>Try explaining it</h2>
        <p>
          Put an idea into your own words and get feedback on what’s clear and what’s missing.
        </p>
      </div>

      {/* Teach-back card */}
      <div className="teach-card">
        <div className="teach-card-header">
          <div className="teach-icon"><ChatIcon name="sparkle" /></div>

          <div>
            <h3>Explain a topic</h3>
            <p>Teach the topic in your own words.</p>
          </div>
        </div>

        <form className="teach-form" onSubmit={submitTeachBack}>

          <div className="teach-field">
            <label htmlFor="teach-subject">Subject</label>

            <select
              id="teach-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              {SUBJECTS.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="teach-field">
            <label htmlFor="teach-topic">Topic</label>

            <input
              id="teach-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              maxLength="200"
              placeholder="e.g. Photosynthesis"
              required
            />
          </div>

          <div className="teach-field">
            <label htmlFor="teach-explanation">
              Explain the topic in your own words
            </label>

            <textarea
              id="teach-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              minLength="20"
              maxLength="8000"
              placeholder="Explain everything you know about this topic..."
              required
            />
          </div>

          <button
            className="teach-button"
            type="submit"
            disabled={loading}
          >
            Check my explanation
          </button>
        </form>

        {teachResult && (
          <article className="teach-result">
            <h3>
              Understanding Score:{" "}
              <span className="score-badge">
                {teachResult.score}%
              </span>
            </h3>

            <h4>What you explained well</h4>

            <ul>
              {teachResult.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h4>What to revisit</h4>

            <ul>
              {teachResult.gaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="teach-feedback">
              <strong>Feedback</strong>
              <br />
              {teachResult.feedback}
            </div>

            <div className="follow-up">
              <strong>🎯 Follow-up Question:</strong>
              <br />
              {teachResult.next_question}
            </div>
          </article>
        )}
      </div>

      {/* Divider */}
      <div className="teach-divider"></div>

      {/* Marking scheme */}
      <div className="teach-card">
        <div className="teach-card-header">
          <div className="teach-icon"><ChatIcon name="compose" /></div>

          <div>
            <h3>Check a written answer</h3>
            <p>
              Compare your written answer against the required marking
              points.
            </p>
          </div>
        </div>

        <form className="teach-form" onSubmit={markAnswer}>

          <div className="teach-field">
            <label htmlFor="mark-question">
              Question
            </label>

            <textarea
              id="mark-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength="3000"
              placeholder="Enter the examination question..."
              required
            />
          </div>

          <div className="teach-field">
            <label htmlFor="student-answer">
              Your answer
            </label>

            <textarea
              id="student-answer"
              value={studentAnswer}
              onChange={(event) => setStudentAnswer(event.target.value)}
              maxLength="8000"
              placeholder="Write your answer here..."
              required
            />
          </div>

          <div className="teach-field">
            <label htmlFor="marking-points">
              Marking Points
            </label>

            <textarea
              id="marking-points"
              value={markingPoints}
              onChange={(event) => setMarkingPoints(event.target.value)}
              placeholder={
                "Enter one marking point per line...\n\nExample:\n- Defines the process correctly\n- Mentions the main stages\n- Gives a correct example"
              }
              required
            />
          </div>

          <div className="teach-field">
            <label htmlFor="max-marks">
              Maximum Marks
            </label>

            <input
              id="max-marks"
              type="number"
              min="1"
              max="100"
              value={maxMarks}
              onChange={(event) => setMaxMarks(event.target.value)}
            />
          </div>

          <button
            className="teach-button"
            type="submit"
            disabled={loading}
          >
            📝 Mark My Answer
          </button>
        </form>

        {markResult && (
          <article className="teach-result">
            <h3>
              Score:{" "}
              <span className="score-badge">
                {markResult.awarded_marks}/{markResult.max_marks}
              </span>
            </h3>

            <h4>✅ Points Earned</h4>

            <ul>
              {markResult.met_points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h4>❌ Points Missed</h4>

            <ul>
              {markResult.missed_points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="teach-feedback">
              <strong>Feedback</strong>
              <br />
              {markResult.feedback}
            </div>
          </article>
        )}
      </div>

      {loading && (
        <p className="teach-loading">
          ⏳ Working on your answer...
        </p>
      )}

      {error && (
        <p className="teach-error" role="alert">
          ⚠️ Error: {error}
        </p>
      )}
    </section>
  );
}

export default TeachBack;
