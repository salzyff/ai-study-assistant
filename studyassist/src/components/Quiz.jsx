import { useState } from "react";
import { SUBJECTS } from "../constants/subjects";
import { apiRequest } from "../api";

function Quiz({ accessToken }) {
  const [subject, setSubject] = useState("Biology");
  const [topic, setTopic] = useState("");
  const [numberOfQuestions, setNumberOfQuestions] =
    useState(5);

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState([]);
  const [score, setScore] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateQuiz(event) {
    event.preventDefault();

    if (loading || !topic.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setQuiz(null);
      setQuestions([]);
      setAnswers({});
      setResults([]);
      setScore(null);

      const data = await apiRequest("/api/quizzes/generate", {
        accessToken,
        method: "POST",
        body: {
          subject,
          topic: topic.trim(),
          numberOfQuestions: Number(numberOfQuestions),
        },
      });

      setQuiz(data.quiz);
      setQuestions(data.questions);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(questionId, optionIndex) {
    if (loading || score !== null) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionIndex,
    }));
  }

  async function submitQuiz() {
    if (!quiz || loading || score !== null) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const submittedAnswers = questions.map(
        (question) => ({
          questionId: question.id,
          selectedOption: answers[question.id],
        })
      );

      const data = await apiRequest(`/api/quizzes/${quiz.id}/submit`, {
        accessToken,
        method: "POST",
        body: { answers: submittedAnswers },
      });

      setScore({
        correct: data.score,
        total: data.total,
        percentage: data.percentage,
      });

      setResults(data.results);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function startAnotherQuiz() {
    setQuiz(null);
    setQuestions([]);
    setAnswers({});
    setResults([]);
    setScore(null);
    setTopic("");
    setError("");
  }

  const everyQuestionAnswered =
    questions.length > 0 &&
    questions.every(
      (question) => answers[question.id] !== undefined
    );

    return (
      <section className="quiz-app">
  
        <div className="quiz-app-title">
          <div>
            <h2>Interactive Quiz</h2>
            <p>Choose a subject and challenge yourself.</p>
          </div>
  
          <div className="quiz-badge">🧠 AI Quiz</div>
        </div>
  
        {!quiz && (
          <form className="quiz-generator" onSubmit={generateQuiz}>
  
            <div className="quiz-field">
              <label htmlFor="quiz-subject">📚 Subject</label>
  
              <select
                id="quiz-subject"
                value={subject}
                onChange={(event) =>
                  setSubject(event.target.value)
                }
              >
                {SUBJECTS.map((subjectOption) => (
                  <option value={subjectOption} key={subjectOption}>
                    {subjectOption}
                  </option>
                ))}
              </select>
            </div>
  
            <div className="quiz-field">
              <label htmlFor="quiz-topic">📖 Topic</label>
  
              <input
                id="quiz-topic"
                type="text"
                value={topic}
                onChange={(event) =>
                  setTopic(event.target.value)
                }
                placeholder="e.g. Photosynthesis"
                required
              />
            </div>
  
            <div className="quiz-field">
              <label htmlFor="question-count">🔢 Questions</label>
  
              <input
                id="question-count"
                type="number"
                min="3"
                max="10"
                value={numberOfQuestions}
                onChange={(event) =>
                  setNumberOfQuestions(event.target.value)
                }
              />
            </div>
  
            <button
              className="generate-quiz-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Generating..." : "✨ Generate Quiz"}
            </button>
  
          </form>
        )}
  
        {error && (
          <div className="quiz-error">
            ⚠️ {error}
          </div>
        )}
  
        {quiz && (
          <div className="quiz-session">
  
            <div className="quiz-session-header">
              <div>
                <span>{quiz.subject}</span>
                <h3>{quiz.topic}</h3>
              </div>
  
              <div className="question-count">
                {questions.length} Questions
              </div>
            </div>
  
            {questions.map((question, questionIndex) => {
              const result = results.find(
                (item) => item.questionId === question.id
              );
  
              return (
                <article
                  className="quiz-question"
                  key={question.id}
                >
  
                  <div className="question-number">
                    Question {questionIndex + 1}
                  </div>
  
                  <h4>{question.question}</h4>
  
                  <div className="quiz-options">
                    {question.options.map(
                      (option, optionIndex) => (
                        <label
                          className={`quiz-option ${
                            answers[question.id] === optionIndex
                              ? "selected"
                              : ""
                          }`}
                          key={`${question.id}-${optionIndex}`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={
                              answers[question.id] === optionIndex
                            }
                            disabled={score !== null}
                            onChange={() =>
                              selectAnswer(
                                question.id,
                                optionIndex
                              )
                            }
                          />
  
                          <span>{option}</span>
                        </label>
                      )
                    )}
                  </div>
  
                  {result && (
                    <div
                      className={`quiz-result ${
                        result.isCorrect
                          ? "correct"
                          : "incorrect"
                      }`}
                    >
                      <strong>
                        {result.isCorrect
                          ? "✓ Correct!"
                          : "✕ Incorrect"}
                      </strong>
  
                      {!result.isCorrect && (
                        <p>
                          Correct answer:{" "}
                          {
                            result.options[
                              result.correctOption
                            ]
                          }
                        </p>
                      )}
  
                      <p>{result.explanation}</p>
                    </div>
                  )}
  
                </article>
              );
            })}
  
            {score === null ? (
              <button
                className="submit-quiz-button"
                type="button"
                onClick={submitQuiz}
                disabled={!everyQuestionAnswered || loading}
              >
                {loading ? "Marking..." : "Submit Quiz →"}
              </button>
            ) : (
              <section className="quiz-final-result">
  
                <div className="result-icon">🎉</div>
  
                <h3>Quiz Complete!</h3>
  
                <p className="final-score">
                  {score.correct}/{score.total}
                </p>
  
                <p>
                  You scored <strong>{score.percentage}%</strong>
                </p>
  
                <button
                  className="another-quiz-button"
                  type="button"
                  onClick={startAnotherQuiz}
                >
                  📝 Start Another Quiz
                </button>
  
              </section>
            )}
  
          </div>
        )}
  
      </section>
    );
}

export default Quiz;
