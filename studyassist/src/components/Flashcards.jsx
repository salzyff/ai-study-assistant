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
        : { subject, topic: topic.trim(), count: Number(count) };
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

  async function openSet(setId) {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequest(`/api/flashcards/sets/${setId}`, { accessToken });
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
    if (!activeSet || !card) return;

    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/flashcards/sets/${activeSet.id}/review`, {
        accessToken,
        method: "POST",
        body: { cardId: card.id, rating },
      });

      if (currentCard < cards.length - 1) {
        setCurrentCard((index) => index + 1);
        setShowAnswer(false);
      } else {
        setMessage("Flashcard review complete");
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
      await loadSources();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const card = cards[currentCard];

  return (
    <section>
      <h2>AI Flashcards</h2>

      <form onSubmit={generateFlashcards}>
        <p>
          <label htmlFor="flashcard-note">Generate from uploaded notes (optional)</label><br />
          <select id="flashcard-note" value={noteId} onChange={(event) => setNoteId(event.target.value)}>
            <option value="">Use a topic instead</option>
            {notes.map((note) => (
              <option value={note.id} key={note.id}>{note.title}</option>
            ))}
          </select>
        </p>

        {!noteId && (
          <>
            <p>
              <label htmlFor="flashcard-subject">Subject</label><br />
              <select id="flashcard-subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
                {SUBJECTS.map((subjectOption) => (
                  <option value={subjectOption} key={subjectOption}>{subjectOption}</option>
                ))}
              </select>
            </p>
            <p>
              <label htmlFor="flashcard-topic">Topic</label><br />
              <input id="flashcard-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength="200" required />
            </p>
          </>
        )}

        <p>
          <label htmlFor="flashcard-count">Number of cards</label><br />
          <input id="flashcard-count" type="number" min="5" max="20" value={count} onChange={(event) => setCount(event.target.value)} />
        </p>
        <button type="submit" disabled={loading}>Generate flashcards</button>
      </form>

      <hr />

      <h3>Saved sets</h3>
      {sets.length === 0 ? (
        <p>No flashcard sets yet.</p>
      ) : (
        <ul>
          {sets.map((set) => (
            <li key={set.id}>
              <button type="button" onClick={() => openSet(set.id)}>{set.subject}: {set.topic}</button>{" "}
              <DeleteConfirmation
                confirmation={`Delete the ${set.subject}: ${set.topic} flashcard set permanently?`}
                onConfirm={() => deleteSet(set.id)}
                disabled={loading}
              />
            </li>
          ))}
        </ul>
      )}

      {activeSet && card && (
        <article>
          <h3>{activeSet.subject}: {activeSet.topic}</h3>
          <p>Card {currentCard + 1} of {cards.length}</p>
          <h4>{card.front}</h4>
          <p>Hint: {card.hint}</p>

          {!showAnswer ? (
            <button type="button" onClick={() => setShowAnswer(true)}>Show answer</button>
          ) : (
            <>
              <p><strong>Answer:</strong> {card.back}</p>
              <p>How well did you remember it?</p>
              {['again', 'hard', 'good', 'easy'].map((rating) => (
                <button type="button" onClick={() => reviewCard(rating)} disabled={loading} key={rating}>
                  {rating}
                </button>
              ))}
            </>
          )}
        </article>
      )}

      {loading && <p>Working...</p>}
      {message && <p>{message}</p>}
      {error && <p role="alert">Error: {error}</p>}
    </section>
  );
}

export default Flashcards;
