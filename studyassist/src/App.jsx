import { useSessionSecurity } from "./utils/useSessionSecurity";
import { normalizeMessages, storePreferences } from "./utils/chatSafety";
import StudyNext from "./components/StudyNext";
import ChatSidebar from "./components/ChatSidebar";
import ChatWorkspace from "./components/ChatWorkspace";
import ChatIcon from "./components/ChatIcon";
import ToolPage from "./components/ToolPage";
import { mergeChatHistory } from "./utils/chatHistory";
import { useCallback, useEffect, useRef, useState } from "react";
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

const TOOL_PAGES = {
  admin: { title: "Administration", description: "Manage accounts and keep an eye on how Study AI is running." },
  reports: { title: "Weekly reports", description: "Look back at what you studied and decide what to work on next." },
  learning: { title: "Learning centre", description: "Revisit a tricky topic, try a question, or set a small goal." },
  notes: { title: "Notes & PDFs", description: "Keep your materials together and ask questions about them." },
  flashcards: { title: "Flashcards", description: "A little practice today makes things easier to remember tomorrow." },
  progress: { title: "Progress", description: "See where your time went and how your practice is going." },
  dashboard: { title: "Study dashboard", description: "Your recent activity, all in one place." },
  quiz: { title: "Quiz", description: "Find out what you know and what could use another look." },
  plan: { title: "Study plan", description: "Break your revision into a schedule you can work with." },
  task: { title: "Task planner", description: "One task at a time. Keep track of what needs doing." },
};

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
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const changed = event => setIsMobile(event.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("studyai-sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("studyai-sidebar-collapsed", String(sidebarCollapsed)); }
    catch { /* Keep navigation usable when storage is unavailable. */ }
  }, [sidebarCollapsed]);

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(preferences.defaultSubject);
  const [mode, setMode] = useState(preferences.defaultMode);
  const route = resolveRoute(path);
  const activeTool = route?.tool ?? null;

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setMobileSidebarOpen(false);
    };

    const drawer = document.getElementById("recent-chats-drawer");
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const mobile = window.matchMedia("(max-width: 768px)");
    if (mobile.matches) {
      document.body.style.overflow = "hidden";
      drawer?.querySelector("button")?.focus();
    }
    const trapFocus = (event) => {
      if (event.key !== "Tab" || !mobile.matches) return;
      const controls = [...(drawer?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), summary') || [])]
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
  const [conversationListLoading, setConversationListLoading] = useState(false);
  const [conversationError, setConversationError] = useState("");
  const conversationRequest = useRef(0);
  const conversationListBusy = useRef(false);
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
      document.querySelector(".sa-main-content")?.scrollTo?.(0, 0);
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
          conversationRequest.current += 1;
          conversationListBusy.current = false;
          setConversationListLoading(false); setConversationError("");
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
    setConversationPagination(null);
    conversationRequest.current += 1;
    conversationListBusy.current = false;
    setConversationListLoading(false); setConversationError("");
    setAdminCheckedToken(null);
    setPasswordRecovery(false);
    navigate("/login", { replace: true });
  }, [cancelChatRequest, navigate]);
  useSessionSecurity(accessToken, passwordRecovery, expireSession);

  const loadConversations = useCallback(async ({ offset = 0, append = false } = {}) => {
    const version = accountVersion.current;
    const requestId = ++conversationRequest.current;
    conversationListBusy.current = true;
    setConversationListLoading(true);
    setConversationError("");
    try {
      const data = await apiRequest(`/api/conversations?limit=20&offset=${offset}`, { accessToken });
      if (version !== accountVersion.current || requestId !== conversationRequest.current) return;
      setConversations(current => mergeChatHistory(append ? current : [], data.conversations || []));
      setConversationPagination(data.pagination || null);
    } catch (requestError) {
      if (version === accountVersion.current && requestId === conversationRequest.current) setConversationError(requestError.message);
    } finally {
      if (version === accountVersion.current && requestId === conversationRequest.current) {
        conversationListBusy.current = false;
        setConversationListLoading(false);
      }
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

  const loadMoreConversations = useCallback(async () => {
    if (!conversationPagination?.hasMore || conversationListBusy.current) return;
    await loadConversations({ offset: conversationPagination.nextOffset, append: true });
  }, [conversationPagination, loadConversations]);

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
        if (activeTool === "chat") startNewChat();
        else {
          cachedChatId.current = null;
          setSessionId(null); setLoadedChatId(null); setMessages([]);
        }
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
    <div className={`app-shell study-layout${sidebarCollapsed ? " sa-sidebar-collapsed" : ""}`}>
      {mobileSidebarOpen && <button className="sa-sidebar-scrim" type="button" aria-label="Close sidebar" onClick={() => setMobileSidebarOpen(false)} />}
      <ChatSidebar
        key={session.user.id}
        open={mobileSidebarOpen}
        conversations={conversations}
        selectedId={route.sessionId}
        activeTool={activeTool}
        pagination={conversationPagination}
        loading={conversationListLoading}
        error={conversationError}
        user={session.user}
        isAdmin={isAdmin}
        onNewChat={startNewChat}
        onOpenChat={openConversation}
        onOpenTool={openTool}
        onClose={() => setMobileSidebarOpen(false)}
        onCollapse={() => setSidebarCollapsed(true)}
        onLoadMore={loadMoreConversations}
        onRetry={() => loadConversations()}
        onDeleteChat={deleteConversation}
      />
      <main className="main-area sa-main">
        <header className="sa-topbar">
          <div className="sa-topbar-brand">
            <button type="button" className="sa-icon-button sa-sidebar-toggle" aria-label={sidebarCollapsed && !isMobile ? "Show sidebar" : "Toggle sidebar"} aria-controls="recent-chats-drawer" aria-expanded={isMobile ? mobileSidebarOpen : !sidebarCollapsed} onClick={() => {
              if (isMobile) setMobileSidebarOpen(true);
              else setSidebarCollapsed(current => !current);
            }}><ChatIcon name="panel" /></button>
            <strong>{activeTool === "chat" ? "Study AI" : route.title}</strong>
          </div>
          {activeTool === "chat" && <span className="sa-active-chat-title">{conversations.find(chat => chat.id === route.sessionId)?.title || "New chat"}</span>}
          <button className="sa-icon-button" type="button" aria-label="New chat" title="New chat" onClick={startNewChat}><ChatIcon name="compose" /></button>
        </header>
        <div className={`sa-main-content${activeTool === "chat" ? " sa-main-content-chat" : " sa-pages"}`}>
      {error && activeTool !== "chat" && <p className="operations-error" role="alert">{error}</p>}
      {activeTool === "chat" ? (
        <ChatWorkspace
          key={route.sessionId || "new-chat"}
          messages={messages} message={message} onMessageChange={setMessage} onSend={sendMessage}
          subject={subject} onSubjectChange={setSubject} mode={mode} onModeChange={setMode}
          loading={loading} historyLoading={historyLoading} chatReady={chatReady}
          streamStatus={streamStatus} error={error} sessionId={sessionId} accessToken={accessToken}
        />
      ) : activeTool === "change-password" ? (
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
      ) : TOOL_PAGES[activeTool] ? (
        <ToolPage {...TOOL_PAGES[activeTool]}
          onBack={() => openTool(activeTool === "admin" ? "profile" : null)}
          backLabel={activeTool === "admin" ? "Profile" : "Home"}>
          {activeTool === "admin" && (adminCheckedToken !== accessToken ? <p role="status">Checking administrator access…</p> : isAdmin ? (
            <AdminDashboard accessToken={accessToken} section={route.section} onNavigate={navigate} />
          ) : <div className="operations-error" role="alert"><p>{adminError || "Administrator access is required for this page."}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div>)}
          {activeTool === "reports" && <WeeklyReports accessToken={accessToken} />}
          {activeTool === "learning" && <LearningCenter accessToken={accessToken} />}
          {activeTool === "notes" && <Notes accessToken={accessToken} />}
          {activeTool === "flashcards" && <Flashcards accessToken={accessToken} />}
          {activeTool === "progress" && <Progress accessToken={accessToken} />}
          {activeTool === "dashboard" && <Dashboard accessToken={accessToken} />}
          {activeTool === "quiz" && <Quiz key={session.user.id} accessToken={accessToken} userId={session.user.id} />}
          {activeTool === "plan" && <StudyPlanGenerator accessToken={accessToken} />}
          {activeTool === "task" && <TaskPlanner accessToken={accessToken} />}
        </ToolPage>
) : (
  <>   

        <header className="topbar study-header">

          <div className="study-header-copy">
            <h1>Your study space</h1>
            <p>Pick up where you left off, or try something new.</p>
          </div>


        </header>

        {activeTool === null && (
        <>
        <StudyNext accessToken={accessToken} userId={session.user.id} conversations={conversations} onChat={openConversation} onTool={openTool} />
        <section className="study-tools">

          <div className="tool-heading">
            <h2>Study Tools</h2>
            <p>What would you like to work on?</p>
          </div>

          <div className="tool-grid">

          <div
    className="tool-card quiz-card"
    onClick={() => openTool("quiz")}
    onKeyDown={(event) => openToolWithKeyboard(event, "quiz")}
    role="button"
    tabIndex="0"
>
              <div className="tool-icon"><ChatIcon name="compose" /></div>
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
              <div className="tool-icon"><ChatIcon name="calendar" /></div>
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
              <div className="tool-icon"><ChatIcon name="tasks" /></div>
              <div>
                <h3>Task Planner</h3>
                <p>Stay on top of your tasks.</p>
              </div>
            </div>

          </div>

          <div className="more-tools-section">
<div className="tool-heading">
  <h2>Keep exploring</h2>
  <p>Your notes, revision and progress are here when you need them.</p>
</div>

<div className="tool-grid">

  <div
    className="tool-card notes-card"
    onClick={() => openTool("notes")}
    onKeyDown={(event) => openToolWithKeyboard(event, "notes")}
    role="button"
    tabIndex="0"
  >
    <div className="tool-icon"><ChatIcon name="file" /></div>
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
    <div className="tool-icon"><ChatIcon name="cards" /></div>
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
    <div className="tool-icon"><ChatIcon name="chart" /></div>
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
    <div className="tool-icon"><ChatIcon name="chart" /></div>
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
    <div className="tool-icon"><ChatIcon name="book" /></div>
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
    <div className="tool-icon"><ChatIcon name="chart" /></div>
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
      <div className="tool-icon"><ChatIcon name="panel" /></div>
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

        </div>
      </main>

    </div>
  );
}

export default App;

