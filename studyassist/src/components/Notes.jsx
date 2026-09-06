import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "./MathMarkdown";
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

      const data = await apiRequest("/api/notes", {
        accessToken,
      });

      setNotes(data.notes || []);

      setSelectedNoteId((currentId) => {
        if (data.notes?.some((note) => note.id === currentId)) {
          return currentId;
        }

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

      setMessage(data.note.title + " passed the security checks and was uploaded");

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

    if (!selectedNoteId || !question.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setAnswer("");

      const data = await apiRequest(
        "/api/notes/" + selectedNoteId + "/ask",
        {
          accessToken,
          method: "POST",
          body: {
            question: question.trim(),
          },
        }
      );

      setAnswer(data.answer);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function summarizeNotes() {
    if (!selectedNoteId) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setAnswer("");

      const data = await apiRequest(
        "/api/notes/" + selectedNoteId + "/summarize",
        {
          accessToken,
          method: "POST",
        }
      );

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

      await apiRequest("/api/notes/" + noteId, {
        accessToken,
        method: "DELETE",
      });

      setAnswer("");
      setMessage("Notes deleted");
      setNotes((current) => current.filter((note) => note.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId("");
        setQuestion("");
      }
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  const selectedNote = notes.find(
    (note) => note.id === selectedNoteId
  );

  return (
    <section className="tool-page">
      <div className="tool-page-header">
        <div>
          <h1>Notes & PDF Study</h1>
          <p>
            Upload your study materials and let AI help you understand them.
          </p>
        </div>
      </div>

      <div className="tool-page-content notes-app">
        <div className="notes-app-title">
          <div>
            <h2>Study Materials</h2>
            <p>Upload PDFs, text files, or Markdown notes.</p>
          </div>

          
        </div>

        <form className="notes-generator" onSubmit={uploadNotes}>
          <div className="notes-upload-box">
            <div className="notes-upload-icon">📤</div>

            <div>
              <h3>Upload your notes</h3>
              <p>Supported formats: PDF, TXT, and Markdown</p>
              <small className="upload-security-note">🛡️ File type and content are checked before saving.</small>
            </div>

            <input
              id="note-file"
              name="file"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              required
            />
          </div>

          <div className="notes-form-grid">
            <div className="notes-field">
              <label htmlFor="note-title">Title (optional)</label>

              <input
                id="note-title"
                name="title"
                type="text"
                maxLength="120"
                placeholder="e.g. Biology — Cell Structure"
              />
            </div>

            <div className="notes-field">
              <label htmlFor="note-subject">Subject</label>

              <select
                id="note-subject"
                name="subject"
                defaultValue="General"
              >
                {SUBJECTS.map((subject) => (
                  <option value={subject} key={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            className="upload-notes-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Uploading..." : "Upload Notes"}
          </button>
        </form>

        {message && (
          <div className="notes-success">{message}</div>
        )}

        {error && (
          <div className="notes-error" role="alert">
            Error: {error}
          </div>
        )}

        <div className="saved-notes-section">
          <div className="saved-notes-header">
            <div>
              <h3>Saved Notes</h3>
              <p>Your uploaded study materials</p>
            </div>

            <span className="notes-count">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          {notes.length === 0 ? (
            <div className="empty-notes">
              <div className="empty-notes-icon">📚</div>
              <h3>No notes yet</h3>
              <p>
                Upload your first study material to get started.
              </p>
            </div>
          ) : (
            <div className="notes-list">
              {notes.map((note) => (
                <div
                  className={
                    "note-item " +
                    (selectedNoteId === note.id ? "selected" : "")
                  }
                  key={note.id}
                >
                  <button
                    type="button"
                    className="note-select-button"
                    disabled={loading}
                    onClick={() => { setSelectedNoteId(note.id); setAnswer(""); setQuestion(""); }}
                  >
                    <span className="note-icon">📄</span>

                    <span className="note-info">
                      <strong>{note.title}</strong>
                      <small>{note.subject}</small>
                    </span>
                  </button>

                  <DeleteConfirmation
                    confirmation={
                      "Delete “" +
                      note.title +
                      "” permanently?"
                    }
                    onConfirm={() => deleteNotes(note.id)}
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedNoteId && (
          <div className="note-study-section">
            <div className="note-study-header">
              <div>
                <span>SELECTED MATERIAL</span>
                <h3>
                  {selectedNote?.title || "Study Notes"}
                </h3>
              </div>

              <select
                id="selected-note"
                disabled={loading}
                value={selectedNoteId}
                onChange={(event) => {
                  setSelectedNoteId(event.target.value);
                  setAnswer("");
                  setQuestion("");
                }}
              >
                {notes.map((note) => (
                  <option value={note.id} key={note.id}>
                    {note.title}
                  </option>
                ))}
              </select>
            </div>

            <form
              className="ask-notes-form"
              onSubmit={askNotes}
            >
              <div className="notes-field">
                <label htmlFor="note-question">
                  Ask a question about these notes
                </label>

                <textarea
                  id="note-question"
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  maxLength="1000"
                  placeholder="Ask something about your study material..."
                  required
                />
              </div>

              <div className="notes-action-buttons">
                <button
                  className="ask-notes-button"
                  type="submit"
                  disabled={loading || !question.trim()}
                >
                  {loading ? "Working..." : "Ask Notes"}
                </button>

                <button
                  className="summarize-notes-button"
                  type="button"
                  onClick={summarizeNotes}
                  disabled={loading}
                >
                  ✨ Summarize Notes
                </button>
              </div>
            </form>
          </div>
        )}

        {answer && (
          <article className="notes-ai-response">
            <div className="ai-response-header">
              <div className="ai-response-icon">🤖</div>

              <div>
                <span>AI STUDY ASSISTANT</span>
                <h3>AI Response</h3>
              </div>
            </div>

            <div className="ai-response-content">
              <ReactMarkdown>{answer}</ReactMarkdown>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

export default Notes;
