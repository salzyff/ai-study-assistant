import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiRequest } from "../api";
import { SUBJECTS } from "../constants/subjects";
import DeleteConfirmation from "./DeleteConfirmation";

function Notes({ accessToken }) {
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadNotes = useCallback(async () => {
    try {
      setError("");
      const data = await apiRequest("/api/notes", { accessToken });
      setNotes(data.notes || []);
      setSelectedNoteId((currentId) => {
        if (data.notes?.some((note) => note.id === currentId)) return currentId;
        return data.notes?.[0]?.id || "";
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(loadNotes, 0);
    return () => window.clearTimeout(timer);
  }, [loadNotes]);

  async function uploadNotes(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await apiRequest("/api/notes", {
        accessToken,
        method: "POST",
        body: formData,
      });
      setMessage(`${data.note.title} was uploaded`);
      form.reset();
      await loadNotes();
      setSelectedNoteId(data.note.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function askNotes(event) {
    event.preventDefault();
    if (!selectedNoteId || !question.trim()) return;

    try {
      setLoading(true);
      setError("");
      setAnswer("");
      const data = await apiRequest(`/api/notes/${selectedNoteId}/ask`, {
        accessToken,
        method: "POST",
        body: { question: question.trim() },
      });
      setAnswer(data.answer);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function summarizeNotes() {
    if (!selectedNoteId) return;

    try {
      setLoading(true);
      setError("");
      setAnswer("");
      const data = await apiRequest(`/api/notes/${selectedNoteId}/summarize`, {
        accessToken,
        method: "POST",
      });
      setAnswer(data.summary);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteNotes(noteId) {
    try {
      setLoading(true);
      setError("");
      await apiRequest(`/api/notes/${noteId}`, {
        accessToken,
        method: "DELETE",
      });
      setAnswer("");
      setMessage("Notes deleted");
      await loadNotes();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Notes and PDF study</h2>

      <form onSubmit={uploadNotes}>
        <p>
          <label htmlFor="note-file">PDF, TXT, or Markdown file</label><br />
          <input id="note-file" name="file" type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" required />
        </p>
        <p>
          <label htmlFor="note-title">Title (optional)</label><br />
          <input id="note-title" name="title" type="text" maxLength="120" />
        </p>
        <p>
          <label htmlFor="note-subject">Subject</label><br />
          <select id="note-subject" name="subject" defaultValue="General">
            {SUBJECTS.map((subject) => (
              <option value={subject} key={subject}>{subject}</option>
            ))}
          </select>
        </p>
        <button type="submit" disabled={loading}>Upload notes</button>
      </form>

      <hr />

      <h3>Saved notes</h3>
      {notes.length === 0 ? (
        <p>No notes uploaded yet.</p>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={note.id}>
              <button type="button" onClick={() => setSelectedNoteId(note.id)}>
                {note.title} ({note.subject})
              </button>{" "}
              <DeleteConfirmation
                confirmation={`Delete “${note.title}” permanently?`}
                onConfirm={() => deleteNotes(note.id)}
                disabled={loading}
              />
            </li>
          ))}
        </ul>
      )}

      {selectedNoteId && (
        <>
          <p>
            <label htmlFor="selected-note">Selected notes</label><br />
            <select id="selected-note" value={selectedNoteId} onChange={(event) => setSelectedNoteId(event.target.value)}>
              {notes.map((note) => (
                <option value={note.id} key={note.id}>{note.title}</option>
              ))}
            </select>
          </p>

          <form onSubmit={askNotes}>
            <label htmlFor="note-question">Ask a question about these notes</label><br />
            <textarea
              id="note-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength="1000"
              required
            />
            <br />
            <button type="submit" disabled={loading || !question.trim()}>Ask notes</button>{" "}
            <button type="button" onClick={summarizeNotes} disabled={loading}>Summarize notes</button>
          </form>
        </>
      )}

      {loading && <p>Working...</p>}
      {message && <p>{message}</p>}
      {error && <p role="alert">Error: {error}</p>}
      {answer && (
        <article>
          <h3>AI response</h3>
          <ReactMarkdown>{answer}</ReactMarkdown>
        </article>
      )}
    </section>
  );
}

export default Notes;
