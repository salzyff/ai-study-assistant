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
import LandingPage from "./components/LandingPage";
import "./components/LandingPage.css";
import { SUBJECTS } from "./constants/subjects";
import { apiRequest, streamApiRequest } from "./api";
import { authRedirect, normalizePath, resolveRoute, toolPath } from "./utils/routes";
import { rememberRecovery, hasRecovery, clearRecovery } from "./utils/passwordRecovery";

const STUDY_MODES = ["ask", "explain", "summarize", "practice"];

function currentPath() {
  return normalizePath(window.location.pathname);
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(preferences.defaultSubject);
  const [mode, setMode] = useState(preferences.defaultMode);
  const route = resolveRoute(path);
  const activeTool = route?.tool ?? null;

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };

    const drawer = document.getElementById("recent-chats-drawer");
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const mobile = window.matchMedia("(max-width: 650px)");
    if (mobile.matches) {
      document.body.style.overflow = "hidden";
      drawer?.querySelector("button")?.focus();
    }
    const trapFocus = (event) => {
      if (event.key !== "Tab" || !mobile.matches) return;
      const controls = [...(drawer?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)') || [])]
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const handleResize = () => { if (!mobile.matches) setMobileSidebarOpen(false); };
    mobile.addEventListener("change", handleResize);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      mobile.removeEventListener("change", handleResize);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileSidebarOpen]);
  const [sessionId, setSessionId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationPagination, setConversationPagination] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckedToken, setAdminCheckedToken] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [loadedChatId, setLoadedChatId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [streamStatus, setStreamStatus] = useState("idle");
  const navigationRequest = useRef(0);
  const accountVersion = useRef(0);
  const accountId = useRef(null);
  const streamController = useRef(null);
  const cachedChatId = useRef(null);

  const accessToken = session?.access_token;
  const chatReady = route?.sessionId ? loadedChatId === route.sessionId : sessionId === null;

  const cancelChatRequest = useCallback(() => {
    navigationRequest.current += 1;
    if (streamController.current) {
      streamController.current.abort();
      streamController.current = null;
      cachedChatId.current = null;
      setLoadedChatId(null);
    }
    setLoading(false);
    setHistoryLoading(false);
    setStreamStatus("idle");
  }, []);

  const navigate = useCallback((pathname, { replace = false, keepChat = false } = {}) => {
    if (!resolveRoute(pathname)) return;
    if (currentPath() === pathname && !replace) return;
    if (!keepChat) cancelChatRequest();
    if (currentPath() !== pathname || replace) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", pathname);
      setPath(pathname);
    }
    window.scrollTo(0, 0);
  }, [cancelChatRequest]);

  useEffect(() => {
    const syncPath = () => { cancelChatRequest(); setPath(currentPath()); setError(""); };
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, [cancelChatRequest]);

  useEffect(() => {
    const currentRoute = resolveRoute(path);
    document.title = currentRoute ? (path === "/" ? "Study AI" : `${currentRoute.title} | Study AI`) : "Page not found | Study AI";
    if (authLoading) return;
    const redirect = authRedirect(path, Boolean(session), passwordRecovery);
    if (!redirect) return;
    const timer = window.setTimeout(() => navigate(redirect, { replace: true }), 0);
    return () => window.clearTimeout(timer);
  }, [path, authLoading, session, passwordRecovery, navigate]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.querySelector(".main-area")?.scrollTo?.(0, 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [path]);

  useEffect(() => {
    storePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    let mounted = true;
    let authChanged = false;
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (mounted && !authChanged) {
        accountId.current = currentSession?.user?.id || null;
        setSession(currentSession);
        setPasswordRecovery(hasRecovery(currentSession?.user?.id));
        setAuthLoading(false);
      }
    }

    loadSession().catch(() => { if (mounted && !authChanged) { setSession(null); setAuthLoading(false); } });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted) return;
        authChanged = true;
        if (event === "PASSWORD_RECOVERY") {
          rememberRecovery(currentSession?.user?.id);
          setPasswordRecovery(true);
        } else if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
          setPasswordRecovery(hasRecovery(currentSession?.user?.id));
        }
        if (!currentSession) { clearRecovery(); setPasswordRecovery(false); }

        if (accountId.current !== (currentSession?.user?.id || null) || !currentSession) {
          accountVersion.current += 1;
          accountId.current = currentSession?.user?.id || null;
          cancelChatRequest();
          cachedChatId.current = null;
          setMessages([]); setConversations([]); setSessionId(null);
          setLoadedChatId(null); setIsAdmin(false); setAdminCheckedToken(null);
          setConversationPagination(null);
        }
        setSession(currentSession);
        setAuthLoading(false);
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [cancelChatRequest]);

  const expireSession = useCallback(() => {
    accountVersion.current += 1;
    accountId.current = null;
    cachedChatId.current = null;
    cancelChatRequest();
    setSession(null); setMessages([]); setConversations([]);
    setSessionId(null); setLoadedChatId(null); setIsAdmin(false);
    setConversationPagination(null); setAdminCheckedToken(null);
    setPasswordRecovery(false);
    navigate("/login", { replace: true });
  }, [cancelChatRequest, navigate]);
  useSessionSecurity(accessToken, passwordRecovery, expireSession);

  const loadConversations = useCallback(async ({ offset = 0, append = false } = {}) => {
    const version = accountVersion.current;
    try {

      const data = await apiRequest(`/api/conversations?limit=20&offset=${offset}`, { accessToken });

      if (version !== accountVersion.current) return;
      setConversations((current) => append
        ? [...current, ...(data.conversations || [])]
        : (data.conversations || []));
      setConversationPagination(data.pagination || null);
    } catch (requestError) {
      if (version === accountVersion.current) setError(requestError.message);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || passwordRecovery) return undefined;
    const timer = window.setTimeout(loadConversations, 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, loadConversations, passwordRecovery]);

  useEffect(() => {
    if (!accessToken || passwordRecovery) return undefined;

    let cancelled = false;
    async function checkAdminAccess() {
      try {
        const data = await apiRequest("/api/admin/status", { accessToken });
        if (!cancelled) { setIsAdmin(Boolean(data.isAdmin)); setAdminError(""); }
      } catch (requestError) {
        if (!cancelled) { setIsAdmin(false); setAdminError(requestError.message); }
      } finally {
        if (!cancelled) setAdminCheckedToken(accessToken);
      }
    }

    const timer = window.setTimeout(checkAdminAccess, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, passwordRecovery]);

  // The URL is authoritative, including direct links, refresh, and Back/Forward.
  useEffect(() => {
    const chatRoute = resolveRoute(path);
    if (!accessToken || passwordRecovery || chatRoute?.tool !== "chat") return;
    const controller = new AbortController();
    const requestId = navigationRequest.current;
    const timer = window.setTimeout(async () => {
      const id = chatRoute.sessionId;
      if (id && cachedChatId.current === id) return;
      setMessage(""); setMessages([]); setError("");
      setSessionId(id); setLoadedChatId(null);
      cachedChatId.current = null;
      if (!id) {
        setSubject(preferences.defaultSubject); setMode(preferences.defaultMode);
        return;
      }
      setHistoryLoading(true);
      try {
        const data = await apiRequest(`/api/conversations/${id}/messages`, { accessToken, signal: controller.signal });
        if (controller.signal.aborted || requestId !== navigationRequest.current) return;
        const conversation = data.conversation || {};
        setSubject(SUBJECTS.includes(conversation.subject) ? conversation.subject : "General");
        setMode(STUDY_MODES.includes(conversation.mode) ? conversation.mode : "ask");
        setMessages(normalizeMessages(data.messages));
        cachedChatId.current = id;
        setLoadedChatId(id);
      } catch (requestError) {
        if (!controller.signal.aborted && requestId === navigationRequest.current) setError(requestError.message);
      } finally {
        if (!controller.signal.aborted && requestId === navigationRequest.current) setHistoryLoading(false);
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [path, accessToken, passwordRecovery, preferences.defaultSubject, preferences.defaultMode]);

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

  function openConversation(conversation) {
    navigate(toolPath("chat", conversation.id));
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage || loading || historyLoading || !chatReady || activeTool !== "chat") return;

    setError("");
    setLoading(true);
    setStreamStatus("connecting");
    setMessage("");

    const requestId = navigationRequest.current;
    const controller = new AbortController();
    streamController.current = controller;
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
        signal: controller.signal,
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
            cachedChatId.current = data.sessionId;
            setLoadedChatId(data.sessionId);
            navigate(toolPath("chat", data.sessionId), { replace: true, keepChat: true });
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
      if (streamController.current === controller) streamController.current = null;
      if (requestId === navigationRequest.current) {
        setLoading(false);
        setStreamStatus("idle");
      }
    }
  }

  function startNewChat() {
    cancelChatRequest();
    navigate("/chat");
    cachedChatId.current = null;
    setLoadedChatId(null);
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
    navigate(toolPath(tool, tool === "chat" ? sessionId : null));
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
    setIsAdmin(false);
    setPasswordRecovery(false);
    navigate("/login", { replace: true });
  }

  function finishPasswordRecovery() {
    clearRecovery();
    setPasswordRecovery(false);
    navigate("/login", { replace: true });
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

  if (passwordRecovery && session) {
    return (
      <ResetPassword
        onComplete={finishPasswordRecovery}
      />
    );
  }

  if (route?.recovery) {
    return <main className="auth-container"><div className="auth-card"><h1>Open your reset email</h1><p>This page needs a valid password-reset link. Request a new one if the link has expired.</p><button type="button" className="auth-submit" onClick={() => navigate(session ? "/profile/change-password" : "/forgot-password")}>Request reset link</button></div></main>;
  }

  if (!route) {
    return <main className="auth-container"><div className="auth-card"><h1>Page not found</h1><p>That address doesn’t match a Study AI page.</p><button className="auth-submit" type="button" onClick={() => navigate(session ? "/home" : "/", { replace: true })}>Go back</button></div></main>;
  }

  if (!session) {
    return path === "/" ? (
      <LandingPage onOpenLogin={() => navigate("/login")} />
    ) : (
      <Auth key={route.authMode || "login"} authMode={route.authMode || "login"} onNavigate={navigate} onBack={() => navigate("/")} />
    );
  }

  return (
    <div className="app-shell">
      {mobileSidebarOpen && (
        <button
          className="mobile-sidebar-scrim"
          type="button"
          aria-label="Close recent chats"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        id="recent-chats-drawer"
        className={mobileSidebarOpen ? "sidebar sidebar-open" : "sidebar"}
        aria-label="Recent chats"
      >
        <div className="mobile-sidebar-heading">
          <strong>Chats</strong>
          <button
            type="button"
            aria-label="Close recent chats"
            onClick={() => setMobileSidebarOpen(false)}
          >
            ×
          </button>
        </div>

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
          onClick={() => { startNewChat(); setMobileSidebarOpen(false); }}
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
              className={sessionId === conversation.id ? "conversation-item conversation-item-active" : "conversation-item"}
              key={conversation.id}
            >
              <button
                type="button"
                onClick={() => { openConversation(conversation); setMobileSidebarOpen(false); }}
              >
                <svg className="chat-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z" /></svg>

                <span className="conversation-text">
                  <strong title={conversation.title || "New conversation"}>{conversation.title || "New conversation"}</strong>
                  <small>{conversation.subject} · {conversation.mode}</small>
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
            onClick={() => { openTool("profile"); setMobileSidebarOpen(false); }}
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
        <div className="mobile-history-bar">
          <button
            className="mobile-history-trigger"
            type="button"
            title="Recent chats"
            aria-label="Open recent chats"
            aria-controls="recent-chats-drawer"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7M12 7v5l3 2" /></svg>
            <span>Recent chats</span>
          </button>
        </div>
      {error && activeTool !== "chat" && <p className="operations-error" role="alert">{error}</p>}
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
            {adminCheckedToken !== accessToken ? <p role="status">Checking administrator access…</p> : isAdmin ? (
              <AdminDashboard accessToken={accessToken} section={route.section} onNavigate={navigate} />
            ) : <div className="operations-error" role="alert"><p>{adminError || "Administrator access is required for this page."}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
          </div>
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

            {!historyLoading && chatReady && messages.length === 0 && (
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

            {(chatReady ? messages : []).map((chatMessage, index) => (

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
  aria-label="Study question"
  disabled={!chatReady || historyLoading}
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
              disabled={loading || historyLoading || !chatReady || !message.trim()}
              aria-label="Send message"
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
