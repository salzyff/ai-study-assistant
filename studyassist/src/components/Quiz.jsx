import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

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

    if (!topic.trim()) {
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

      const response = await fetch(
        `${API_URL}/api/quizzes/generate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject,
            topic: topic.trim(),
            numberOfQuestions: Number(numberOfQuestions),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate quiz"
        );
      }

      setQuiz(data.quiz);
      setQuestions(data.questions);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(questionId, optionIndex) {
    if (score !== null) {
      return;
    }

    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: optionIndex,
    }));
  }

  async function submitQuiz() {
    if (!quiz) {
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

      const response = await fetch(
        `${API_URL}/api/quizzes/${quiz.id}/submit`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: submittedAnswers,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not submit quiz"
        );
      }

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
    <section>
      <h2>Interactive Quiz</h2>

      {!quiz && (
        <form onSubmit={generateQuiz}>
          <div>
            <label htmlFor="quiz-subject">Subject</label>

            <select
              id="quiz-subject"
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
            <label htmlFor="quiz-topic">Topic</label>

            <input
              id="quiz-topic"
              type="text"
              value={topic}
              onChange={(event) =>
                setTopic(event.target.value)
              }
              placeholder="Photosynthesis"
              required
            />
          </div>

          <div>
            <label htmlFor="question-count">
              Number of questions
            </label>

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

          <button type="submit" disabled={loading}>
            {loading ? "Generating..." : "Generate quiz"}
          </button>
        </form>
      )}

      {error && <p>Error: {error}</p>}

      {quiz && (
        <>
          <h3>
            {quiz.subject}: {quiz.topic}
          </h3>

          {questions.map((question, questionIndex) => {
            const result = results.find(
              (item) => item.questionId === question.id
            );

            return (
              <article key={question.id}>
                <h4>
                  {questionIndex + 1}. {question.question}
                </h4>

                {question.options.map(
                  (option, optionIndex) => (
                    <label
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

                      {option}
                    </label>
                  )
                )}

                {result && (
                  <div>
                    <p>
                      {result.isCorrect
                        ? "Correct"
                        : "Incorrect"}
                    </p>

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
              type="button"
              onClick={submitQuiz}
              disabled={!everyQuestionAnswered || loading}
            >
              {loading ? "Marking..." : "Submit quiz"}
            </button>
          ) : (
            <section>
              <h3>Quiz Result</h3>

              <p>
                Score: {score.correct}/{score.total}
              </p>

              <p>Percentage: {score.percentage}%</p>

              <button
                type="button"
                onClick={startAnotherQuiz}
              >
                Start another quiz
              </button>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default Quiz;