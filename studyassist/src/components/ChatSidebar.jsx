import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChatIcon from "./ChatIcon";
import { groupChatHistory } from "../utils/chatHistory";

const tools = [
  ["quiz", "Quizzes"], ["notes", "Notes & PDFs"], ["flashcards", "Flashcards"],
  ["plan", "Study plans"], ["task", "Tasks"], ["learning", "Learning center"],
  ["progress", "Progress"], ["dashboard", "Dashboard"], ["reports", "Weekly reports"],
];

function DeleteChatDialog({ conversation, onClose, onDelete }) {
  const dialog = useRef(null);
  const busy = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError("");
    try { await onDelete(conversation.id); onClose(); }
    catch (requestError) { setError(requestError.message || "Could not delete this chat."); }
    finally { busy.current = false; setDeleting(false); }
  }

  return createPortal(
    <dialog ref={dialog} className="sa-delete-dialog" aria-labelledby="sa-delete-title" onCancel={event => { event.preventDefault(); if (!deleting) onClose(); }}>
      <h2 id="sa-delete-title">Delete this chat?</h2>
      <p><strong>{conversation.title || "New conversation"}</strong> will be permanently deleted.</p>
      {error && <p className="sa-error" role="alert">{error}</p>}
      <div className="sa-dialog-actions">
        <button type="button" disabled={deleting} onClick={onClose} autoFocus>Cancel</button>
        <button type="button" className="sa-danger" disabled={deleting} onClick={confirm}>{deleting ? "Deleting…" : "Delete chat"}</button>
      </div>
    </dialog>, document.body,
  );
}

export default function ChatSidebar({ open, conversations, selectedId, activeTool, pagination, loading, error, user, isAdmin, onNewChat, onOpenChat, onOpenTool, onClose, onCollapse, onLoadMore, onRetry, onDeleteChat }) {
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const groups = groupChatHistory(conversations, query);

  // A search progressively includes every page, rather than only the first 20 chats.
  useEffect(() => {
    if (!query.trim() || !pagination?.hasMore || loading || error) return;
    const timer = window.setTimeout(onLoadMore, 180);
    return () => window.clearTimeout(timer);
  }, [query, pagination, loading, error, onLoadMore]);

  useEffect(() => {
    if (!menuId) return;
    const closeOutside = event => { if (!event.target.closest(".sa-chat-actions")) setMenuId(null); };
    const escape = event => { if (event.key === "Escape") setMenuId(null); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", escape); };
  }, [menuId]);

  const go = tool => { onOpenTool(tool); onClose(); };
  return <aside id="recent-chats-drawer" className={`sidebar sa-sidebar${open ? " sidebar-open" : ""}`} aria-label="Chats and study tools">
    <div className="sa-sidebar-brand">
      <button type="button" className="sa-brand-link" onClick={() => go(null)}><span className="sa-brand-mark"><ChatIcon name="sparkle" size={19} /></span><strong>Study AI</strong></button>
      <button type="button" className="sa-icon-button sa-collapse-button" aria-label="Collapse sidebar" onClick={onCollapse}><ChatIcon name="panel" /></button>
      <button type="button" className="sa-icon-button sa-drawer-close" aria-label="Close sidebar" onClick={onClose}><ChatIcon name="close" /></button>
    </div>
    <button type="button" className="sa-new-chat" onClick={() => { onNewChat(); onClose(); }}><ChatIcon name="compose" /><span>New chat</span></button>
    <label className="sa-history-search" htmlFor="sa-history-search">
      <ChatIcon name="search" size={18} />
      <input id="sa-history-search" type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" />
    </label>
    <nav className="sa-navigation" aria-label="Study workspace">
      <button type="button" className={activeTool === null ? "sa-nav-active" : ""} onClick={() => go(null)}><ChatIcon name="home" size={18} />Home</button>
      <details className="sa-tools-menu">
        <summary><ChatIcon name="book" size={18} /><span>Study tools</span><ChatIcon name="chevron" size={16} /></summary>
        <div>{tools.map(([tool, label]) => <button key={tool} type="button" className={activeTool === tool ? "sa-nav-active" : ""} onClick={() => go(tool)}>{label}</button>)}{isAdmin && <button type="button" onClick={() => go("admin")}>Admin dashboard</button>}</div>
      </details>
    </nav>
    <div className="sa-history-scroll">
      {groups.map(group => <section className="sa-history-group" key={group.label} aria-label={group.label}>
        <h2>{group.label}</h2>
        {group.conversations.map(conversation => <div key={conversation.id} className={`sa-chat-row${selectedId === conversation.id && activeTool === "chat" ? " sa-chat-row-active" : ""}`}>
          <button type="button" className="sa-open-chat" title={conversation.title || "New conversation"} aria-current={selectedId === conversation.id && activeTool === "chat" ? "page" : undefined} onClick={() => { onOpenChat(conversation); onClose(); }}>{conversation.title || "New conversation"}</button>
          <div className="sa-chat-actions">
            <button type="button" className="sa-chat-menu-trigger sa-icon-button" aria-label={`More options for ${conversation.title || "New conversation"}`} aria-expanded={menuId === conversation.id} onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)}><ChatIcon name="more" size={17} /></button>
            {menuId === conversation.id && <div className="sa-chat-menu"><button type="button" onClick={() => { setToDelete(conversation); setMenuId(null); }}><ChatIcon name="trash" size={16} />Delete chat</button></div>}
          </div>
        </div>)}
      </section>)}
      {!groups.length && !loading && !error && <p className="sa-empty-history">{query.trim() ? "No chats found. Try another word." : "Your conversations will appear here after your first question."}</p>}
      {loading && <p className="sa-history-status" role="status">{query.trim() ? "Searching saved chats…" : "Loading chats…"}</p>}
      {error && <div className="sa-history-error" role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Try again</button></div>}
      {pagination?.hasMore && !query.trim() && <button type="button" className="sa-load-chats" disabled={loading} onClick={onLoadMore}>Load older chats<ChatIcon name="chevron" size={14} /></button>}
    </div>
    <button type="button" className="sa-profile" onClick={() => go("profile")}>
      <span className="sa-profile-avatar">{(user.user_metadata?.display_name || user.email || "S").charAt(0).toUpperCase()}</span>
      <span><strong>{user.user_metadata?.display_name || "Student"}</strong><small>Settings & account</small></span>
      <ChatIcon name="more" size={18} />
    </button>
    {toDelete && <DeleteChatDialog conversation={toDelete} onClose={() => setToDelete(null)} onDelete={onDeleteChat} />}
  </aside>;
}
