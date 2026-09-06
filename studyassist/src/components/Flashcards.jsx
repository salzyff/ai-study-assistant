import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import DeleteConfirmation from "./DeleteConfirmation";

function Flashcards({ accessToken }) {
  const [sets, setSets] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeSet, setActiveSet] = useState(null);
  const [cards, setCards] = useState([]);
  const [subject, setSubject] = useState("General");
  const [topic, setTopic] = useState("");
  const [noteId, setNoteId] = useState("");
  const [count, setCount] = useState(10);
  const [currentCard, setCurrentCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSources = useCallback(async () => {
    try {
      setError("");

      const [setsData, notesData] = await Promise.all([
        apiRequest("/api/flashcards/sets", { accessToken }),
        apiRequest("/api/notes", { accessToken }),
      ]);

      setSets(setsData.sets || []);
      setNotes(notesData.notes || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadSources, 0);

    return () => window.clearTimeout(timer);
  }, [loadSources]);

  async function generateFlashcards(event) {
    event.preventDefault();

    if (!noteId && !topic.trim()) return;

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const body = noteId
        ? { noteId, count: Number(count) }
        : {
            subject,
            topic: topic.trim(),
            count: Number(count),
          };

      const data = await apiRequest("/api/flashcards/generate", {
        accessToken,
        method: "POST",
        body,
      });

      setActiveSet(data.set);
      setCards(data.cards || []);
      setCurrentCard(0);
      setShowAnswer(false);
      setMessage(`${data.cards.length} flashcards created`);

      await loadSources();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function openDue() {
    if(loading) return;
    setLoading(true); setError("");
    try {
      const data = await apiRequest('/api/flashcards/due?limit=100',{accessToken});
      setCards(data.cards); setCurrentCard(0); setShowAnswer(false);
      setActiveSet(data.cards.length ? {id:"due",subject:"Scheduled review",topic:"Cards due now"} : null);
      setMessage(data.cards.length ? `${data.cards.length} cards due. Rate each card to schedule its next review.` : "You’re caught up. No cards due right now.");
    } catch(e) {setError(e.message);} finally {setLoading(false);}
  }
  async function openSet(setId) {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest(
        `/api/flashcards/sets/${setId}`,
        { accessToken }
      );

      setActiveSet(data.set);
      setCards(data.cards || []);
      setCurrentCard(0);
      setShowAnswer(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function reviewCard(rating) {
    const card = cards[currentCard];

    if (loading || !activeSet || !card) return;

    try {
      setLoading(true);
      setError("");

      const reviewResult = await apiRequest(
        `/api/flashcards/sets/${card.set_id || activeSet.id}/review`,
        {
          accessToken,
          method: "POST",
          body: {
            cardId: card.id,
            rating,
          },
        }
      );

      setMessage(`Next review: ${new Date(reviewResult.schedule.nextReviewAt).toLocaleString()}`);
      if (currentCard < cards.length - 1) {
        setCurrentCard((index) => index + 1);
        setShowAnswer(false);
      } else {
        setMessage("Flashcard review complete");
        setActiveSet(null);
        setCards([]);
        setShowAnswer(false);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSet(setId) {
    try {
      setLoading(true);
      setError("");

      await apiRequest(`/api/flashcards/sets/${setId}`, {
        accessToken,
        method: "DELETE",
      });

      if (activeSet?.id === setId) {
        setActiveSet(null);
        setCards([]);
      }

      setMessage("Flashcard set deleted");
      setSets((current) => current.filter((set) => set.id !== setId));
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  const card = cards[currentCard];

  return (
    <section className="tool-page">
      <div className="study-next-actions"><button type="button" disabled={loading} onClick={openDue}>Review due cards</button><p>Again: 10 minutes · Hard, Good or Easy: progressively longer review intervals.</p></div>

      <div className="tool-page-header">
        <div>
          <h1>Flashcards 🃏</h1>
          <p>
            Create smart flashcards and strengthen your memory.
          </p>
        </div>
      </div>

      <div className="tool-page-content flashcards-app">

        <div className="flashcards-app-title">
          <div>
            <h2>Build Your Flashcards</h2>
            <p>
              Generate cards from your notes or choose a topic to study.
            </p>
          </div>

          <span className="flashcards-badge">
            🧠 Smart Review
          </span>
        </div>

        <form
          className="flashcards-generator"
          onSubmit={generateFlashcards}
        >

          <div className="flashcards-form-grid">

            <div className="flashcards-field flashcards-full-field">
              <label htmlFor="flashcard-note">
                📄 Generate from uploaded notes
              </label>

              <select
                id="flashcard-note"
                value={noteId}
                onChange={(event) => setNoteId(event.target.value)}
              >
                <option value="">
                  Use a topic instead
                </option>

                {notes.map((note) => (
                  <option value={note.id} key={note.id}>
                    {note.title}
                  </option>
                ))}
              </select>

              <small>
                Choose one of your saved notes, or leave this empty to
                create cards from a topic.
              </small>
            </div>

            {!noteId && (
              <>
                <div className="flashcards-field">
                  <label htmlFor="flashcard-subject">
                    📚 Subject
                  </label>

                  <select
                    id="flashcard-subject"
                    value={subject}
                    onChange={(event) =>
                      setSubject(event.target.value)
                    }
                  >
                    {SUBJECTS.map((subjectOption) => (
                      <option
                        value={subjectOption}
                        key={subjectOption}
                      >
                        {subjectOption}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flashcards-field">
                  <label htmlFor="flashcard-topic">
                    🎯 Topic
                  </label>

                  <input
                    id="flashcard-topic"
                    value={topic}
                    onChange={(event) =>
                      setTopic(event.target.value)
                    }
                    maxLength="200"
                    placeholder="e.g. Cell Structure"
                    required
                  />
                </div>
              </>
            )}

            <div className="flashcards-field">
              <label htmlFor="flashcard-count">
                🔢 Number of cards
              </label>

              <input
                id="flashcard-count"
                type="number"
                min="5"
                max="20"
                value={count}
                onChange={(event) =>
                  setCount(event.target.value)
                }
              />

              <small>Choose between 5 and 20 cards.</small>
            </div>

          </div>

          <button
            className="generate-flashcards-button"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Generating..."
              : "✨ Generate Flashcards"}
          </button>

        </form>

        {message && (
          <div className="flashcards-success">
            {message}
          </div>
        )}

        {error && (
          <div className="flashcards-error" role="alert">
            Error: {error}
          </div>
        )}

        <div className="saved-flashcards-section">

          <div className="saved-flashcards-header">
            <div>
              <h3>Saved Flashcard Sets</h3>
              <p>Choose a set to start reviewing.</p>
            </div>

            <span className="flashcards-count">
              {sets.length}{" "}
              {sets.length === 1 ? "set" : "sets"}
            </span>
          </div>

          {sets.length === 0 ? (
            <div className="empty-flashcards">
              <div className="empty-flashcards-icon">
                🃏
              </div>

              <h3>No flashcard sets yet</h3>

              <p>
                Generate your first set above to start studying.
              </p>
            </div>
          ) : (
            <div className="flashcards-set-list">

              {sets.map((set) => (
                <div
                  className={
                    "flashcards-set-item " +
                    (activeSet?.id === set.id
                      ? "selected"
                      : "")
                  }
                  key={set.id}
                >

                  <button
                    type="button"
                    className="flashcards-set-button"
                    disabled={loading}
                    onClick={() => openSet(set.id)}
                  >
                    <span className="flashcards-set-icon">
                      🃏
                    </span>

                    <span className="flashcards-set-info">
                      <strong>
                        {set.subject}
                      </strong>

                      <small>
                        {set.topic}
                      </small>
                    </span>
                  </button>

                  <DeleteConfirmation
                    confirmation={
                      `Delete the ${set.subject}: ${set.topic} flashcard set permanently?`
                    }
                    onConfirm={() => deleteSet(set.id)}
                    disabled={loading}
                  />

                </div>
              ))}

            </div>
          )}

        </div>

        {activeSet && card && (
          <article className="flashcard-study-section">

            <div className="flashcard-study-header">
              <div>
                <span>NOW STUDYING</span>

                <h3>
                  {activeSet.subject}: {activeSet.topic}
                </h3>
              </div>

              <div className="flashcard-progress">
                Card {currentCard + 1} of {cards.length}
              </div>
            </div>

            <div className="flashcard-card">

              <div className="flashcard-label">
                QUESTION
              </div>

              <h4>{card.front}</h4>

              <div className="flashcard-hint">
                <strong>💡 Hint</strong>
                <p>{card.hint}</p>
              </div>

              {!showAnswer ? (
                <button
                  className="show-answer-button"
                  type="button"
                  onClick={() => setShowAnswer(true)}
                >
                  Show Answer
                </button>
              ) : (
                <div className="flashcard-answer-area">

                  <div className="flashcard-answer">
                    <span>ANSWER</span>
                    <p>{card.back}</p>
                  </div>

                  <div className="flashcard-rating">
                    <p>
                      How well did you remember it?
                    </p>

                    <div className="rating-buttons">
                      {[
                        "again",
                        "hard",
                        "good",
                        "easy",
                      ].map((rating) => (
                        <button
                          type="button"
                          onClick={() =>
                            reviewCard(rating)
                          }
                          disabled={loading}
                          key={rating}
                          className={
                            "rating-button rating-" +
                            rating
                          }
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

          </article>
        )}

        {loading && (
          <div className="flashcards-loading">
            Working...
          </div>
        )}

      </div>
    </section>
  );
}

export default Flashcards;
