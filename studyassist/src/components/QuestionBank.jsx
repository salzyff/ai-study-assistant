import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import DeleteConfirmation from "./DeleteConfirmation";

function QuestionBank({ accessToken }) {
  const [subject, setSubject] = useState("Mathematics");
  const [topic, setTopic] = useState("");
  const [examType, setExamType] = useState("School exam practice");
  const [examYear, setExamYear] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(5);
  const [bank, setBank] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualOptions, setManualOptions] = useState(["", "", "", ""]);
  const [manualCorrect, setManualCorrect] = useState(0);
  const [manualExplanation, setManualExplanation] = useState("");
  const [hasRights, setHasRights] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadBank = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/question-bank", { accessToken });
      setBank(data.questions || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadBank, 0);
    return () => window.clearTimeout(timer);
  }, [loadBank]);

  async function generateQuestions(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await apiRequest("/api/question-bank/generate", {
        accessToken,
        method: "POST",
        body: { subject, topic, examType, examYear: examYear || undefined, difficulty, count: Number(count) },
      });
      await loadBank();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAuthorizedQuestion(event) {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      await apiRequest("/api/question-bank", {
        accessToken,
        method: "POST",
        body: {
          subject,
          topic,
          examType,
          examYear: examYear || undefined,
          difficulty,
          question: manualQuestion,
          options: manualOptions,
          correctOption: Number(manualCorrect),
          explanation: manualExplanation,
          hasRights,
          sourceLabel: "Student-provided authorized question",
        },
      });
      setManualQuestion("");
      setManualOptions(["", "", "", ""]);
      setManualExplanation("");
      setHasRights(false);
      await loadBank();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz() {
    if (selectedIds.length === 0) return;
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest("/api/question-bank/quiz", {
        accessToken,
        method: "POST",
        body: { questionIds: selectedIds },
      });
      setQuiz(data.quiz);
      setQuizQuestions(data.questions || []);
      setAnswers({});
      setResult(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitQuiz() {
    if (!quiz || loading || result) return;
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest(`/api/quizzes/${quiz.id}/submit`, {
        accessToken,
        method: "POST",
        body: {
          answers: quizQuestions.map((question) => ({ questionId: question.id, selectedOption: answers[question.id] ?? null })),
        },
      });
      setResult(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuestion(questionId) {
    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/question-bank/${questionId}`, { accessToken, method: "DELETE" });
      setSelectedIds((ids) => ids.filter((id) => id !== questionId));
      setBank((current) => current.filter((question) => question.id !== questionId));
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  function toggleQuestion(questionId) {
    setSelectedIds((ids) => ids.includes(questionId) ? ids.filter((id) => id !== questionId) : [...ids, questionId].slice(0, 10));
  }

  return (
    <section className="learning-utility">
      <h2>Practice question bank</h2>
      <p>Choose a topic for some original exam-style practice. These questions aren’t official past papers.</p>
      <form onSubmit={generateQuestions}>
        <p>
          <label htmlFor="bank-subject">Subject</label><br />
          <select id="bank-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            {SUBJECTS.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </p>
        <p><label htmlFor="bank-topic">Topic</label><br /><input id="bank-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength="200" required /></p>
        <p><label htmlFor="exam-type">Exam style</label><br /><input id="exam-type" value={examType} onChange={(event) => setExamType(event.target.value)} maxLength="80" required /></p>
        <p><label htmlFor="exam-year">Year (optional)</label><br /><input id="exam-year" type="number" min="1900" max="2100" value={examYear} onChange={(event) => setExamYear(event.target.value)} /></p>
        <p>
          <label htmlFor="bank-difficulty">Difficulty</label><br />
          <select id="bank-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
          </select>
        </p>
        <p><label htmlFor="bank-count">Questions</label><br /><input id="bank-count" type="number" min="1" max="10" value={count} onChange={(event) => setCount(event.target.value)} /></p>
        <button type="submit" disabled={loading}>Generate original questions</button>
      </form>

      <h3>Saved questions</h3>
      <p>Select up to 10 questions, then start a quiz.</p>
      {bank.length === 0 ? <p>No questions saved yet. Make a few above, or add your own below.</p> : bank.map((question) => (
        <article key={question.id}>
          <label><input type="checkbox" checked={selectedIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} /> Select</label>
          <p><strong>{question.subject} — {question.topic} — {question.exam_type} {question.exam_year || ""} — {question.difficulty}</strong></p>
          <p>{question.question}</p>
          <p>Source: {question.source_type === "ai_original" ? "AI-generated original" : question.source_label}</p>
          <DeleteConfirmation
            confirmation="Delete this saved question permanently?"
            onConfirm={() => deleteQuestion(question.id)}
            disabled={loading}
          />
        </article>
      ))}
      <button type="button" onClick={startQuiz} disabled={loading || selectedIds.length === 0}>Start selected quiz ({selectedIds.length})</button>

      {quizQuestions.length > 0 && (
        <section>
          <h3>Question-bank quiz</h3>
          {quizQuestions.map((question, index) => {
            const marked = result?.results.find((item) => item.questionId === question.id);
            return (
              <fieldset key={question.id} disabled={Boolean(result)}>
                <legend>{index + 1}. {question.question}</legend>
                {question.options.map((option, optionIndex) => (
                  <label key={`${question.id}-${optionIndex}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} /> {option}<br /></label>
                ))}
                {marked && <p>{marked.isCorrect ? "Correct" : `Correct answer: ${marked.options[marked.correctOption]}`} — {marked.explanation}</p>}
              </fieldset>
            );
          })}
          {!result ? <button type="button" onClick={submitQuiz} disabled={loading}>Submit quiz</button> : <p>Score: {result.score}/{result.total} ({result.percentage}%)</p>}
        </section>
      )}

      <hr />
      <h3>Add your own question</h3>
      <form onSubmit={saveAuthorizedQuestion}>
        <p><label htmlFor="manual-question">Question</label><br /><textarea id="manual-question" value={manualQuestion} onChange={(event) => setManualQuestion(event.target.value)} required /></p>
        {manualOptions.map((option, index) => (
          <p key={index}><label htmlFor={`manual-option-${index}`}>Option {index + 1}</label><br /><input id={`manual-option-${index}`} value={option} onChange={(event) => setManualOptions((options) => options.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} required /></p>
        ))}
        <p><label htmlFor="manual-correct">Correct option number</label><br /><select id="manual-correct" value={manualCorrect} onChange={(event) => setManualCorrect(event.target.value)}><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option></select></p>
        <p><label htmlFor="manual-explanation">Explanation</label><br /><textarea id="manual-explanation" value={manualExplanation} onChange={(event) => setManualExplanation(event.target.value)} required /></p>
        <p><label><input type="checkbox" checked={hasRights} onChange={(event) => setHasRights(event.target.checked)} required /> I created this question or have permission to store it.</label></p>
        <button type="submit" disabled={loading || !hasRights}>Save question</button>
      </form>
      {loading && <p>Working...</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default QuestionBank;

