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
import ResetPassword from "./components/ResetPassword";
import Profile from "./components/Profile";
import ChangePassword from "./components/ChangePassword";
import { SUBJECTS } from "./constants/subjects";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [preferences, setPreferences] = useState(() => {
    try {
      return {
        defaultSubject: "General",
        defaultMode: "ask",
        ...JSON.parse(localStorage.getItem("studyai-preferences") || "{}"),
      };
    } catch {
      return { defaultSubject: "General", defaultMode: "ask" };
    }
  });
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() =>
    window.location.hash.includes("type=recovery")
  );

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(preferences.defaultSubject);
  const [mode, setMode] = useState(preferences.defaultMode);
  const [activeTool, setActiveTool] = useState(null);
  const [sessionId, setSessionId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const accessToken = session?.access_token;

  useEffect(() => {
    localStorage.setItem("studyai-preferences", JSON.stringify(preferences));
  }, [preferences]);

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
      (event, currentSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        }

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
    setSubject(preferences.defaultSubject);
    setMode(preferences.defaultMode);
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

  function finishPasswordRecovery() {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname
    );
    setPasswordRecovery(false);
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

  if (passwordRecovery) {
    return (
      <ResetPassword
        onComplete={finishPasswordRecovery}
      />
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

          <button
            className="user-card profile-button"
            type="button"
            onClick={() => setActiveTool("profile")}
          >
            <div className="avatar">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <strong>{session.user.user_metadata?.display_name || "Student"}</strong>
              <span>{session.user.email}</span>
            </div>
          </button>

        </div>

      </aside>

      {/* MAIN AREA */}
      <main className="main-area">
      {activeTool === "change-password" ? (
        <ChangePassword onBack={() => setActiveTool("profile")} />
      ) : activeTool === "profile" ? (
        <Profile
          user={session.user}
          preferences={preferences}
          onPreferencesChange={(nextPreferences) => {
            setPreferences(nextPreferences);
            setSubject(nextPreferences.defaultSubject);
            setMode(nextPreferences.defaultMode);
          }}
          onBack={() => setActiveTool(null)}
          onLogout={logOut}
          onChangePassword={() => setActiveTool("change-password")}
        />
      ) : activeTool === "learning" ? (
<section className="tool-page">

  <button
    className="back-button"
    type="button"
    onClick={() => setActiveTool(null)}
  >
    ← Back to Dashboard
  </button>

  <div className="tool-page-header">
    <div>
      <h1>Learning Center 🎓</h1>
      <p>Review your learning, strengthen weak areas, and keep improving.</p>
    </div>
  </div>

  <div className="tool-page-content">
    <LearningCenter accessToken={accessToken} />
  </div>

</section>
) : activeTool === "notes" ? (
<section className="tool-page">

  <button
    className="back-button"
    type="button"
    onClick={() => setActiveTool(null)}
  >
    ← Back to Dashboard
  </button>

  <div className="tool-page-header">
    <div>
      <h1>Notes & PDFs 📄</h1>
      <p>Upload, organize, and study your notes with AI.</p>
    </div>
  </div>

  <div className="tool-page-content">
    <Notes accessToken={accessToken} />
  </div>

</section>
) : activeTool === "flashcards" ? (
<section className="tool-page">

  <button
    className="back-button"
    type="button"
    onClick={() => setActiveTool(null)}
  >
    ← Back to Dashboard
  </button>

  <div className="tool-page-header">
    <div>
      <h1>Flashcards 🃏</h1>
      <p>Build your memory with smart flashcard reviews.</p>
    </div>
  </div>

  <div className="tool-page-content">
    <Flashcards accessToken={accessToken} />
  </div>

</section>
) : activeTool === "progress" ? (
  <section className="tool-page">

    <button
      className="back-button"
      type="button"
      onClick={() => setActiveTool(null)}
    >
      ← Back to Dashboard
    </button>

    <div className="tool-page-header">
      <div>
        <h1>Progress 📊</h1>
        <p>Track your study activity and see how you're improving.</p>
      </div>
    </div>

    <div className="tool-page-content">
      <Progress accessToken={accessToken} />
    </div>

  </section>
) : activeTool === "dashboard" ? (
  <section className="tool-page">

    <button
      className="back-button"
      type="button"
      onClick={() => setActiveTool(null)}
    >
      ← Back to Dashboard
    </button>

    <div className="tool-page-header">
      <div>
        <h1>Dashboard 📊</h1>
        <p>Stay on top of your learning and track your progress.</p>
      </div>
    </div>

    <div className="tool-page-content">
      <Dashboard accessToken={accessToken} />
    </div>

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

          <div className="more-tools-section">
<div className="tool-heading">
  <h2>More Study Tools</h2>
  <p>Explore more ways to improve your learning.</p>
</div>

<div className="tool-grid">

  <div
    className="tool-card notes-card"
    onClick={() => setActiveTool("notes")}
  >
    <div className="tool-icon">📄</div>
    <div>
      <h3>Notes & PDFs</h3>
      <p>Upload and study your notes.</p>
    </div>
  </div>

  <div
    className="tool-card flashcards-card"
    onClick={() => setActiveTool("flashcards")}
  >
    <div className="tool-icon">🃏</div>
    <div>
      <h3>Flashcards</h3>
      <p>Review and remember key ideas.</p>
    </div>
  </div>

  <div
    className="tool-card progress-card"
    onClick={() => setActiveTool("progress")}
  >
    <div className="tool-icon">📊</div>
    <div>
      <h3>Progress</h3>
      <p>Track your study progress.</p>
    </div>
  </div>

  <div
    className="tool-card dashboard-card"
    onClick={() => setActiveTool("dashboard")}
  >
    <div className="tool-icon">📈</div>
    <div>
      <h3>Dashboard</h3>
      <p>View your learning statistics.</p>
    </div>
  </div>

  <div
    className="tool-card learning-card"
    onClick={() => setActiveTool("learning")}
  >
    <div className="tool-icon">🎓</div>
    <div>
      <h3>Learning Center</h3>
      <p>Review, practice, and set goals.</p>
    </div>
  </div>

</div>
</div>
        </section>
      
  </>
)}

      </main>

    </div>
  );
}

export default App;
