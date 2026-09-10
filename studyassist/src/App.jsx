import { useSessionSecurity } from "./utils/useSessionSecurity";
import { normalizeMessages, storePreferences } from "./utils/chatSafety";
import StudyNext from "./components/StudyNext";
import AnswerReport from "./components/AnswerReport";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "./components/MathMarkdown";
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
import WeeklyReports from "./components/WeeklyReports";
import AdminDashboard from "./components/AdminDashboard";
import UserManagement from "./components/UserManagement";
import LandingPage from "./components/LandingPage";
import "./components/LandingPage.css";
import { SUBJECTS } from "./constants/subjects";
import { apiRequest, streamApiRequest } from "./api";

const STUDY_MODES = ["ask", "explain", "summarize", "practice"];

function currentPath() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

function loadPreferences() {
  const defaults = { defaultSubject: "General", defaultMode: "ask" };

  try {
    const saved = JSON.parse(localStorage.getItem("studyai-preferences") || "{}");
    return {
      defaultSubject: SUBJECTS.includes(saved.defaultSubject)
        ? saved.defaultSubject
        : defaults.defaultSubject,
      defaultMode: STUDY_MODES.includes(saved.defaultMode)
        ? saved.defaultMode
        : defaults.defaultMode,
    };
  } catch {
    return defaults;
  }
}

function App() {
  const [path, setPath] = useState(currentPath);
  const [preferences, setPreferences] = useState(loadPreferences);
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
  const [conversationPagination, setConversationPagination] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [streamStatus, setStreamStatus] = useState("idle");
  const navigationRequest = useRef(0);

  const accessToken = session?.access_token;

  useEffect(() => {
    const syncPath = () => setPath(currentPath());
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  function navigate(pathname) {
    if (currentPath() === pathname) return;
    window.history.pushState({}, "", pathname);
    setPath(pathname);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.querySelector(".main-area")?.scrollTo?.(0, 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTool, sessionId]);

  useEffect(() => {
    storePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setAuthLoading(false);
    }

    loadSession().catch(() => { setSession(null); setAuthLoading(false); });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        }

        if (!currentSession) {
          navigationRequest.current += 1;
          setMessages([]); setConversations([]); setSessionId(null);
          setActiveTool(null); setIsAdmin(false);
        }
        setSession(currentSession);
        setAuthLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const expireSession = useCallback(() => {
    navigationRequest.current += 1;
    setSession(null); setMessages([]); setConversations([]);
    setSessionId(null); setActiveTool(null); setIsAdmin(false);
  }, []);
  useSessionSecurity(accessToken, passwordRecovery, expireSession);

  const loadConversations = useCallback(async ({ offset = 0, append = false } = {}) => {
    try {
      setError("");

      const data = await apiRequest(`/api/conversations?limit=20&offset=${offset}`, { accessToken });

      setConversations((current) => append
        ? [...current, ...(data.conversations || [])]
        : (data.conversations || []));
      setConversationPagination(data.pagination || null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return undefined;
    const timer = window.setTimeout(loadConversations, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, loadConversations]);

  useEffect(() => {
    if (!accessToken) return undefined;

    let cancelled = false;
    async function checkAdminAccess() {
      try {
        const data = await apiRequest("/api/admin/status", { accessToken });
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    }

    const timer = window.setTimeout(checkAdminAccess, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken]);

  async function loadMoreConversations() {
    if (!conversationPagination?.hasMore || historyLoading) return;
    try {
      setHistoryLoading(true);
      await loadConversations({
        offset: conversationPagination.nextOffset,
        append: true,
      });
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openConversation(conversation) {
    setLoading(false); setStreamStatus("idle");
    const requestId = ++navigationRequest.current;
    try {
      setError("");
      setHistoryLoading(true);

      const data = await apiRequest(
        `/api/conversations/${conversation.id}/messages`,
        { accessToken },
      );

      if (requestId !== navigationRequest.current) return;

      setActiveTool("chat");
      setSessionId(conversation.id);
      setSubject(SUBJECTS.includes(conversation.subject) ? conversation.subject : "General");
      setMode(STUDY_MODES.includes(conversation.mode) ? conversation.mode : "ask");
      setMessages(normalizeMessages(data.messages));
    } catch (requestError) {
      if (requestId === navigationRequest.current) {
        setError(requestError.message);
      }
    } finally {
      if (requestId === navigationRequest.current) {
        setHistoryLoading(false);
      }
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage || loading) return;

    setError("");
    setLoading(true);
    setStreamStatus("connecting");
    setMessage("");

    const requestId = navigationRequest.current;
    const assistantMessageId = `stream-${Date.now()}`;
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        role: "student",
        content: cleanMessage,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ]);

    try {
      await streamApiRequest("/api/chat/stream", {
        accessToken,
        body: {
          message: cleanMessage,
          subject,
          mode,
          sessionId,
        },
        onEvent(eventName, data) {
          if (requestId !== navigationRequest.current) return;
          if (eventName === "meta") {
            setSessionId(data.sessionId);
            setStreamStatus("streaming");
          }
          if (eventName === "delta") {
            setMessages((currentMessages) => currentMessages.map((item) => (
              item.id === assistantMessageId
                ? { ...item, content: item.content + data.text }
                : item
            )));
          }
          if (eventName === "done") {
            setStreamStatus("saving");
            if(data.messageId) setMessages(current => current.map(item => item.id === assistantMessageId ? {...item,id:data.messageId} : item));
          }
        },
      });

      if (requestId === navigationRequest.current) await loadConversations();
    } catch (requestError) {
      if (requestId !== navigationRequest.current) return;
      setMessages((currentMessages) => currentMessages.filter(
        (item) => item.id !== assistantMessageId || item.content,
      ));
      setError(requestError.message);
    } finally {
      if (requestId === navigationRequest.current) {
        setLoading(false);
        setStreamStatus("idle");
      }
    }
  }

  function startNewChat() {
    setLoading(false);
    navigationRequest.current += 1;
    setActiveTool("chat");
    setHistoryLoading(false);
    setSessionId(null);
    setMessages([]);
    setMessage("");
    setSubject(preferences.defaultSubject);
    setMode(preferences.defaultMode);
    setError("");
    setStreamStatus("idle");
  }

  function openTool(tool) {
    setLoading(false); setStreamStatus("idle");
    navigationRequest.current += 1;
    setHistoryLoading(false);
    setActiveTool(tool);
    setError("");
  }

  function openToolWithKeyboard(event, tool) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTool(tool);
    }
  }

  async function deleteConversation(conversationId) {
    setError("");
    try {
      await apiRequest(`/api/conversations/${conversationId}`, {
        accessToken,
        method: "DELETE",
      });

      if (sessionId === conversationId) {
        startNewChat();
      }

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    }
  }

  async function logOut() {
    setError("");

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) throw logoutError;

    navigationRequest.current += 1;
    setConversations([]);
    setMessages([]);
    setSessionId(null);
    setActiveTool(null);
    setIsAdmin(false);
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
          <h2>Study AI</h2>
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
    return path === "/" ? (
      <LandingPage onOpenLogin={() => navigate("/login")} />
    ) : (
      <Auth onBack={() => navigate("/")} />
    );
  }

  return (
    <div className="app-shell">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-icon">🧠</div>

          <div>
            <h2>Study AI</h2>
            <span>Your study companion</span>
          </div>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={startNewChat}
          disabled={loading}
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

          {conversationPagination?.hasMore && (
            <button
              className="history-load-more"
              type="button"
              onClick={loadMoreConversations}
              disabled={historyLoading}
            >
              {historyLoading ? "Loading…" : "Load older chats"}
            </button>
          )}

        </div>

        <div className="sidebar-bottom">

          <button
            className="user-card profile-button"
            type="button"
            onClick={() => openTool("profile")}
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
        <ChangePassword onBack={() => openTool("profile")} />
      ) : activeTool === "profile" ? (
        <Profile
          user={session.user}
          preferences={preferences}
          onPreferencesChange={(nextPreferences) => {
            setPreferences(nextPreferences);
            setSubject(nextPreferences.defaultSubject);
            setMode(nextPreferences.defaultMode);
          }}
          onBack={() => openTool(null)}
          onLogout={logOut}
          onChangePassword={() => openTool("change-password")}
          isAdmin={isAdmin}
          onOpenAdmin={() => openTool("admin")}
        />
      ) : activeTool === "admin" ? (
        <section className="tool-page">
          <button className="back-button" type="button" onClick={() => openTool("profile")}>← Back to Profile</button>
          <div className="tool-page-header"><div><h1>Admin Dashboard ⚙️</h1><p>Monitor the backend and manage queued work.</p></div></div>
          <div className="tool-page-content">
            <AdminDashboard accessToken={accessToken} onManageUsers={() => openTool("admin-users")} />
          </div>
        </section>
      ) : activeTool === "admin-users" ? (
        <section className="tool-page">
          <button className="back-button" type="button" onClick={() => openTool("admin")}>← Back to Admin Dashboard</button>
          <div className="tool-page-header"><div><h1>User Management 👥</h1><p>Review accounts and control access to Study AI.</p></div></div>
          <div className="tool-page-content"><UserManagement accessToken={accessToken} /></div>
        </section>
      ) : activeTool === "reports" ? (
        <section className="tool-page">
          <button className="back-button" type="button" onClick={() => openTool(null)}>← Back to Dashboard</button>
          <div className="tool-page-header"><div><h1>Weekly Reports 📈</h1><p>Turn your recent study activity into a progress report.</p></div></div>
          <div className="tool-page-content"><WeeklyReports accessToken={accessToken} /></div>
        </section>
      ) : activeTool === "learning" ? (
<section className="tool-page">

  <button
    className="back-button"
    type="button"
    onClick={() => openTool(null)}
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
    onClick={() => openTool(null)}
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
    onClick={() => openTool(null)}
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
      onClick={() => openTool(null)}
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
      onClick={() => openTool(null)}
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
      onClick={() => openTool(null)}
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

  <Quiz key={session.user.id} accessToken={accessToken} userId={session.user.id} />
</div>
  </section>
) : activeTool === "plan" ? (
  <section className="tool-page">

    <button
      className="back-button"
      onClick={() => openTool(null)}
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
      onClick={() => openTool(null)}
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

        <header className="topbar study-header">

          <div className="study-header-copy">
            <div className="study-header-eyebrow">
              {activeTool === "chat" && (
                <button className="study-header-back" type="button" onClick={() => openTool(null)}>
                  <span aria-hidden="true">←</span> Back
                </button>
              )}
              <span>STUDY AI <span aria-hidden="true">/</span> {activeTool === "chat" ? "CHAT" : "YOUR WORKSPACE"}</span>
            </div>
            <h1>{activeTool === "chat" ? "Let’s work through it." : "Make room for your next idea."}</h1>
            <p>{activeTool === "chat" ? "Ask, explore, and understand at your own pace." : "Your notes, practice and progress. All in one place."}</p>
          </div>


        </header>

        {/* CONTROLS */}
        {activeTool === "chat" && (
        <>
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
    </div>
    {streamStatus !== "idle" && <div className="chat-status" role="status">
      <span className={`status-dot ${streamStatus !== "idle" ? "status-dot-working" : ""}`}></span>
      {streamStatus === "connecting" && "Connecting…"}
      {streamStatus === "streaming" && "Writing live…"}
      {streamStatus === "saving" && "Saving…"}
    </div>}
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
                  {chatMessage.role === "assistant" && <AnswerReport accessToken={accessToken} kind="chat" sourceId={chatMessage.id} containerId={sessionId} />}

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
  maxLength="6000"
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
        </>
        )}
        {activeTool === null && (
        <>
        {(sessionId || messages.length > 0) && (
          <button className="back-button" type="button" onClick={() => openTool("chat")}>
            Continue current chat
          </button>
        )}
        <StudyNext accessToken={accessToken} userId={session.user.id} conversations={conversations} onChat={openConversation} onTool={openTool} />
        <section className="study-tools">

          <div className="tool-heading">
            <h2>Study Tools</h2>
            <p>Make your study sessions more productive.</p>
          </div>

          <div className="tool-grid">

          <div
    className="tool-card quiz-card"
    onClick={() => openTool("quiz")}
    onKeyDown={(event) => openToolWithKeyboard(event, "quiz")}
    role="button"
    tabIndex="0"
>
              <div className="tool-icon">📝</div>
              <div>
                <h3>Quiz</h3>
                <p>Test your knowledge.</p>
              </div>
            </div>

            <div
  className="tool-card plan-card"
  onClick={() => openTool("plan")}
  onKeyDown={(event) => openToolWithKeyboard(event, "plan")}
  role="button"
  tabIndex="0"
>
              <div className="tool-icon">📅</div>
              <div>
                <h3>Study Plan</h3>
                <p>Organize your learning.</p>
              </div>
            </div>

            <div
  className="tool-card task-card"
  onClick={() => openTool("task")}
  onKeyDown={(event) => openToolWithKeyboard(event, "task")}
  role="button"
  tabIndex="0"
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
    onClick={() => openTool("notes")}
    onKeyDown={(event) => openToolWithKeyboard(event, "notes")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">📄</div>
    <div>
      <h3>Notes & PDFs</h3>
      <p>Upload and study your notes.</p>
    </div>
  </div>

  <div
    className="tool-card flashcards-card"
    onClick={() => openTool("flashcards")}
    onKeyDown={(event) => openToolWithKeyboard(event, "flashcards")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">🃏</div>
    <div>
      <h3>Flashcards</h3>
      <p>Review and remember key ideas.</p>
    </div>
  </div>

  <div
    className="tool-card progress-card"
    onClick={() => openTool("progress")}
    onKeyDown={(event) => openToolWithKeyboard(event, "progress")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">📊</div>
    <div>
      <h3>Progress</h3>
      <p>Track your study progress.</p>
    </div>
  </div>

  <div
    className="tool-card dashboard-card"
    onClick={() => openTool("dashboard")}
    onKeyDown={(event) => openToolWithKeyboard(event, "dashboard")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">📈</div>
    <div>
      <h3>Dashboard</h3>
      <p>View your learning statistics.</p>
    </div>
  </div>

  <div
    className="tool-card learning-card"
    onClick={() => openTool("learning")}
    onKeyDown={(event) => openToolWithKeyboard(event, "learning")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">🎓</div>
    <div>
      <h3>Learning Center</h3>
      <p>Review, practice, and set goals.</p>
    </div>
  </div>

  <div
    className="tool-card reports-card"
    onClick={() => openTool("reports")}
    onKeyDown={(event) => openToolWithKeyboard(event, "reports")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon">📈</div>
    <div>
      <h3>Weekly Reports</h3>
      <p>Generate and review study summaries.</p>
    </div>
  </div>

  {isAdmin && (
    <div
      className="tool-card admin-card"
      onClick={() => openTool("admin")}
      onKeyDown={(event) => openToolWithKeyboard(event, "admin")}
      role="button"
      tabIndex="0"
    >
      <div className="tool-icon">⚙️</div>
      <div>
        <h3>Admin Dashboard</h3>
        <p>Monitor the backend and queued jobs.</p>
      </div>
    </div>
  )}

</div>
</div>
        </section>
        </>
        )}
  </>
)}

      </main>

    </div>
  );
}

export default App;
