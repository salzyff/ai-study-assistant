import { useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";

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
        body: { subject, topic, explanation },
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
    const points = markingPoints.split("\n").map((point) => point.trim()).filter(Boolean);
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/learning/mark-written", {
        accessToken,
        method: "POST",
        body: { subject, topic, question, studentAnswer, markingPoints: points, maxMarks: Number(maxMarks) },
      });
      setMarkResult(data.assessment);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Teach-back mode</h2>
      <form onSubmit={submitTeachBack}>
        <p>
          <label htmlFor="teach-subject">Subject</label><br />
          <select id="teach-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            {SUBJECTS.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </p>
        <p><label htmlFor="teach-topic">Topic</label><br /><input id="teach-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength="200" required /></p>
        <p><label htmlFor="teach-explanation">Explain the topic in your own words</label><br /><textarea id="teach-explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} minLength="20" maxLength="8000" required /></p>
        <button type="submit" disabled={loading}>Check my explanation</button>
      </form>
      {teachResult && (
        <article>
          <h3>Understanding score: {teachResult.score}%</h3>
          <h4>What you explained well</h4>
          <ul>{teachResult.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          <h4>Knowledge gaps</h4>
          <ul>{teachResult.gaps.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>{teachResult.feedback}</p>
          <p><strong>Follow-up:</strong> {teachResult.next_question}</p>
        </article>
      )}

      <hr />
      <h2>Marking-scheme mode</h2>
      <p>Enter one required marking point per line. The AI marks only against those points.</p>
      <form onSubmit={markAnswer}>
        <p><label htmlFor="mark-question">Question</label><br /><textarea id="mark-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength="3000" required /></p>
        <p><label htmlFor="student-answer">Your written answer</label><br /><textarea id="student-answer" value={studentAnswer} onChange={(event) => setStudentAnswer(event.target.value)} maxLength="8000" required /></p>
        <p><label htmlFor="marking-points">Marking points</label><br /><textarea id="marking-points" value={markingPoints} onChange={(event) => setMarkingPoints(event.target.value)} required /></p>
        <p><label htmlFor="max-marks">Maximum marks</label><br /><input id="max-marks" type="number" min="1" max="100" value={maxMarks} onChange={(event) => setMaxMarks(event.target.value)} /></p>
        <button type="submit" disabled={loading}>Mark answer</button>
      </form>
      {markResult && (
        <article>
          <h3>Score: {markResult.awarded_marks}/{markResult.max_marks}</h3>
          <h4>Points earned</h4>
          <ul>{markResult.met_points.map((item) => <li key={item}>{item}</li>)}</ul>
          <h4>Points missed</h4>
          <ul>{markResult.missed_points.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>{markResult.feedback}</p>
        </article>
      )}
      {loading && <p>Working...</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default TeachBack;
