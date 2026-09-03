import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Auth from "./components/Auth";
import TaskPlanner from "./components/TaskPlanner";
import { supabase } from "./supabase";
import StudyPlanGenerator from "./components/StudyPlanGenerator";
import Quiz from "./components/Quiz";
import Notes from "./components/Notes";
import Flashcards from "./components/Flashcards";
import Progress from "./components/Progress";
import Dashboard from "./components/Dashboard";
import LearningCenter from "./components/LearningCenter";
import DeleteConfirmation from "./components/DeleteConfirmation";
import { SUBJECTS } from "./constants/subjects";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("General");
  const [mode, setMode] = useState("ask");
  const [activeTool, setActiveTool] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const accessToken = session?.access_token;

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const getAuthHeaders = useCallback((includeJson = false) => {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }, [accessToken]);

  const loadConversations = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(`${API_URL}/api/conversations`, {
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load conversations");
      }

      setConversations(data.conversations);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const timer = window.setTimeout(loadConversations, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, loadConversations]);

  async function openConversation(conversation) {
    try {
      setError("");
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/api/conversations/${conversation.id}/messages`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load this conversation"
        );
      }

      setSessionId(conversation.id);
      setSubject(conversation.subject);
      setMode(conversation.mode);
      setMessages(data.messages);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage || loading) return;

    setError("");
    setLoading(true);
    setMessage("");

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        role: "student",
        content: cleanMessage,
      },
    ]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          message: cleanMessage,
          subject,
          mode,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate an answer"
        );
      }

      setSessionId(data.sessionId);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);

      await loadConversations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setSessionId(null);
    setMessages([]);
    setMessage("");
    setSubject("General");
    setMode("ask");
    setError("");
  }

  async function deleteConversation(conversationId) {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not delete conversation"
        );
      }

      if (sessionId === conversationId) {
        startNewChat();
      }

      await loadConversations();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function logOut() {
    setError("");

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
    } else {
      setConversations([]);
      setMessages([]);
      setSessionId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-icon">🧠</div>
          <h2>AI Study Assistant</h2>
          <p>Loading your study space...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">🧠</div>

          <div>
            <h2>StudyAI</h2>
            <span>Your study companion</span>
          </div>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={startNewChat}
        >
          <span>＋</span>
          New Chat
        </button>

        <div className="history-header">
          <span>Recent chats</span>
        </div>

        <div className="conversation-list">

          {conversations.length === 0 && (
            <p className="empty-history">
              Your conversations will appear here.
            </p>
          )}

          {conversations.map((conversation) => (
            <div
              className="conversation-item"
              key={conversation.id}
            >
              <button
                type="button"
                onClick={() => openConversation(conversation)}
              >
                <span className="chat-icon">💬</span>

                <span className="conversation-text">
                  <strong>{conversation.subject}</strong>
                  <small>{conversation.mode}</small>
                </span>
              </button>

              <DeleteConfirmation
                className="delete-button"
                buttonLabel="×"
                confirmation="Delete this conversation permanently?"
                onConfirm={() => deleteConversation(conversation.id)}
              />
            </div>
          ))}

        </div>

        <div className="sidebar-bottom">

          <div className="user-card">
            <div className="avatar">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>Student</strong>
              <span>{session.user.email}</span>
            </div>
          </div>

          <button
            className="logout-button"
            type="button"
            onClick={logOut}
          >
            ⇥ Log out
          </button>

        </div>

      </aside>

      {/* MAIN AREA */}
      <main className="main-area">
      {activeTool === "learning" ? (
  <section>
    <button type="button" onClick={() => setActiveTool(null)}>
      ← Back to Dashboard
    </button>
    <LearningCenter accessToken={accessToken} />
  </section>
) : activeTool === "notes" ? (
  <section>
    <button type="button" onClick={() => setActiveTool(null)}>
      ← Back to Dashboard
    </button>
    <h1>Notes and PDFs</h1>
    <Notes accessToken={accessToken} />
  </section>
) : activeTool === "flashcards" ? (
  <section>
    <button type="button" onClick={() => setActiveTool(null)}>
      ← Back to Dashboard
    </button>
    <h1>Flashcards</h1>
    <Flashcards accessToken={accessToken} />
  </section>
) : activeTool === "progress" ? (
  <section>
    <button type="button" onClick={() => setActiveTool(null)}>
      ← Back to Dashboard
    </button>
    <h1>Progress</h1>
    <Progress accessToken={accessToken} />
  </section>
) : activeTool === "dashboard" ? (
  <section>
    <button type="button" onClick={() => setActiveTool(null)}>
      ← Back to Dashboard
    </button>
    <h1>Dashboard Statistics</h1>
    <Dashboard accessToken={accessToken} />
  </section>
) : activeTool === "quiz" ? (
  <section className="tool-page">
    <button
      className="back-button"
      onClick={() => setActiveTool(null)}
    >
      ← Back to Dashboard
    </button>

    <div className="tool-page-header">
      <div>
        <h1>Quiz 📝</h1>
        <p>Test your knowledge and improve your understanding.</p>
      </div>
    </div>

    <div className="tool-page-content quiz-page-content">
  <div className="quiz-intro">
    <div className="quiz-intro-icon">🧠</div>
    <div>
      <h2>Challenge Yourself</h2>
      <p>
        Test what you know, find your weak areas, and improve your
        understanding.
      </p>
    </div>
  </div>

  <Quiz accessToken={accessToken} />
</div>
  </section>
) : activeTool === "plan" ? (
  <section className="tool-page">

    <button
      className="back-button"
      onClick={() => setActiveTool(null)}
    >
      ← Back to Dashboard
    </button>

    <div className="tool-page-header">
      <div>
        <h1>Study Plan 📅</h1>
        <p>Organize your learning and study smarter.</p>
      </div>
    </div>

    <div className="tool-page-content">
      <StudyPlanGenerator accessToken={accessToken} />
    </div>

  </section>
) : activeTool === "task" ? (
  <section className="tool-page">

    <button
      className="back-button"
      onClick={() => setActiveTool(null)}
    >
      ← Back to Dashboard
    </button>

    <div className="tool-page-header">
      <div>
        <h1>Task Planner ✅</h1>
        <p>Keep track of your study tasks and stay organized.</p>
      </div>
    </div>

    <div className="tool-page-content">
      <TaskPlanner accessToken={accessToken} />
    </div>

  </section>
) : (
  <>   

        <header className="topbar">

          <div>
            <h1>AI Study Assistant</h1>
            <p>Learn smarter. Study better. 🚀</p>
          </div>

          <div className="status">
            <span className="status-dot"></span>
            AI Online
          </div>

        </header>

        {/* CONTROLS */}
        <section className="study-controls">

          <div className="control-group">
            <label htmlFor="subject">📚 Subject</label>

            <select
              id="subject"
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

          <div className="control-group">
            <label htmlFor="mode">🎯 Study Mode</label>

            <select
              id="mode"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value)
              }
            >
              <option value="ask">Ask</option>
              <option value="explain">Explain</option>
              <option value="summarize">Summarize</option>
              <option value="practice">Practice</option>
            </select>
          </div>

        </section>

        {/* CHAT */}
        <section className="chat-container">
  <div className="chat-header">
    <div className="ai-avatar">🧠</div>
    <div className="chat-title">
      <strong>Study Assistant</strong>
      <span>Your personal AI learning companion</span>
    </div>
    <div className="chat-status">
      <span className="status-dot"></span>
      Online
    </div>
  </div>

          <div className="messages">

            {historyLoading && (
              <div className="system-message">
                Loading conversation...
              </div>
            )}

            {!historyLoading && messages.length === 0 && (
              <div className="welcome">

                <div className="welcome-icon">✨</div>

                <h2>What would you like to learn?</h2>

                <p>
                  Ask me a question, request an explanation,
                  summarize a topic, or practice your knowledge.
                </p>

                <div className="suggestions">

                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "Explain this topic to me in simple terms."
                      )
                    }
                  >
                    💡 Explain a topic
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "Give me practice questions on this subject."
                      )
                    }
                  >
                    📝 Practice questions
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "Summarize the most important things I need to know."
                      )
                    }
                  >
                    📖 Summarize
                  </button>

                </div>

              </div>
            )}

            {messages.map((chatMessage, index) => (

              <article
                className={`message ${
                  chatMessage.role === "student"
                    ? "student-message"
                    : "assistant-message"
                }`}
                key={chatMessage.id || index}
              >

                <div className="message-avatar">
                  {chatMessage.role === "student"
                    ? "👤"
                    : "🧠"}
                </div>

                <div className="message-content">

                  <strong>
                    {chatMessage.role === "student"
                      ? "You"
                      : "Study Assistant"}
                  </strong>

                  <ReactMarkdown>
                    {chatMessage.content}
                  </ReactMarkdown>

                </div>

              </article>

            ))}

            {loading && (
              <div className="typing">

                <div className="message-avatar">🧠</div>

                <div className="typing-bubble">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

              </div>
            )}

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

          </div>

          {/* MESSAGE INPUT */}
          <form
            className="message-form"
            onSubmit={sendMessage}
          >


<textarea
  value={message}
  onChange={(event) =>
    setMessage(event.target.value)
  }
  onKeyDown={(event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  }}
  placeholder="Ask anything about your studies..."
  rows="1"
/>


            <button
              type="submit"
              disabled={loading || !message.trim()}
            >
              {loading ? "..." : "➤"}
            </button>

          </form>

          <p className="input-hint">
            AI can make mistakes. Always verify important information.
          </p>

        </section>

        {/* TOOLS */}
        <section className="study-tools">

          <div className="tool-heading">
            <h2>Study Tools</h2>
            <p>Make your study sessions more productive.</p>
          </div>

          <div className="tool-grid">

          <div
    className="tool-card quiz-card"
    onClick={() => setActiveTool("quiz")}
>
              <div className="tool-icon">📝</div>
              <div>
                <h3>Quiz</h3>
                <p>Test your knowledge.</p>
              </div>
            </div>

            <div
  className="tool-card plan-card"
  onClick={() => setActiveTool("plan")}
>
              <div className="tool-icon">📅</div>
              <div>
                <h3>Study Plan</h3>
                <p>Organize your learning.</p>
              </div>
            </div>

            <div
  className="tool-card task-card"
  onClick={() => setActiveTool("task")}
>
              <div className="tool-icon">✅</div>
              <div>
                <h3>Task Planner</h3>
                <p>Stay on top of your tasks.</p>
              </div>
            </div>

          </div>

          <div>
            <h3>More study tools</h3>
            <button type="button" onClick={() => setActiveTool("notes")}>Notes and PDFs</button>{" "}
            <button type="button" onClick={() => setActiveTool("flashcards")}>Flashcards</button>{" "}
            <button type="button" onClick={() => setActiveTool("progress")}>Progress</button>{" "}
            <button type="button" onClick={() => setActiveTool("dashboard")}>Dashboard and AI usage</button>
            {" "}<button type="button" onClick={() => setActiveTool("learning")}>Learning Center</button>
          </div>

        </section>
      
  </>
)}

      </main>

    </div>
  );
}

export default App;
