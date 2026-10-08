import { useEffect, useRef, useState } from "react";
import ChatIcon from "./ChatIcon";
import MathMarkdown from "./MathMarkdown";
import AnswerReport from "./AnswerReport";
import { SUBJECTS } from "../constants/subjects";

const starters = [
  { icon: "sparkle", title: "Explain a topic", text: "Break it down, step by step", prompt: "Help me understand a topic in simple terms: ", mode: "explain" },
  { icon: "book", title: "Practice a question", text: "Build confidence for your exams", prompt: "Give me practice questions on ", mode: "practice" },
  { icon: "compose", title: "Summarize a topic", text: "Focus on what matters", prompt: "Summarize the key ideas about ", mode: "summarize" },
];

export default function ChatWorkspace({ messages, message, onMessageChange, onSend, subject, onSubjectChange, mode, onModeChange, loading, historyLoading, chatReady, streamStatus, error, sessionId, accessToken }) {
  const scrollArea = useRef(null);
  const textarea = useRef(null);
  const followLatest = useRef(true);
  const copyTimer = useRef(null);
  const [showLatest, setShowLatest] = useState(false);
  const [copied, setCopied] = useState(null);
  const [copyError, setCopyError] = useState("");
  const visibleMessages = chatReady ? messages : [];
  const empty = chatReady && !historyLoading && visibleMessages.length === 0;

  useEffect(() => {
    const field = textarea.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 180)}px`;
  }, [message]);

  useEffect(() => {
    if (!followLatest.current) return;
    const frame = requestAnimationFrame(() => {
      const container = scrollArea.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, historyLoading, chatReady]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  function onScroll() {
    const area = scrollArea.current;
    const nearBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
    followLatest.current = nearBottom;
    setShowLatest(!nearBottom);
  }

  function scrollLatest() {
    followLatest.current = true;
    setShowLatest(false);
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" });
  }

  async function copyMessage(item, key) {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(key);
      setCopyError("");
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 2000);
    } catch { setCopyError("Copy is unavailable in this browser. You can select and copy the answer."); }
  }

  function send(event) {
    followLatest.current = true;
    onSend(event);
  }

  return <section className={`sa-chat-workspace${empty ? " sa-chat-empty" : ""}`} aria-label="Study conversation">
    <div className="sa-messages-scroll" ref={scrollArea} onScroll={onScroll}>
      {historyLoading && <div className="sa-chat-loading" role="status"><span className="sa-spinner" />Loading conversation…</div>}
      {empty && <div className="sa-chat-welcome">
        <div className="sa-welcome-mark"><ChatIcon name="sparkle" size={27} /></div>
        <p className="sa-eyebrow">A LITTLE CURIOSITY GOES A LONG WAY</p>
        <h1>What are we learning today?</h1>
        <p className="sa-welcome-copy">Work through a question. Make a topic click.<br />Start wherever you are.</p>
        <div className="sa-chat-starters">{starters.map(starter => <button type="button" key={starter.title} onClick={() => { onModeChange(starter.mode); onMessageChange(starter.prompt); textarea.current?.focus(); }}>
          <ChatIcon name={starter.icon} size={19} /><strong>{starter.title}</strong><span>{starter.text}</span>
        </button>)}</div>
      </div>}
      <div className="sa-message-thread">
        {visibleMessages.map((item, index) => {
          const key = item.id || `message-${index}`;
          const student = item.role === "student";
          return <article className={`sa-message${student ? " sa-message-student" : " sa-message-assistant"}`} key={key} aria-label={student ? "Your message" : "Study AI answer"}>
            {student ? <div className="sa-student-bubble"><p>{item.content}</p></div> : <>
              <div className="sa-answer-brand"><span className="sa-answer-mark"><ChatIcon name="sparkle" size={16} /></span><strong>Study AI</strong></div>
              <div className="sa-answer-body">
                {item.content ? <MathMarkdown>{item.content}</MathMarkdown> : loading ? <span className="sa-thinking" role="status"><span /><span /><span /><span className="sa-sr-only">Thinking…</span></span> : null}
              </div>
              {item.content && !(loading && index === visibleMessages.length - 1) && <div className="sa-message-actions">
                <button type="button" className="sa-copy-button" title={copied === key ? "Copied" : "Copy answer"} aria-label={copied === key ? "Answer copied" : "Copy answer"} onClick={() => copyMessage(item, key)}><ChatIcon name={copied === key ? "check" : "copy"} size={16} />{copied === key && <span role="status">Copied</span>}</button>
                <AnswerReport accessToken={accessToken} kind="chat" sourceId={item.id} containerId={sessionId} />
              </div>}
            </>}
          </article>;
        })}
      </div>
    </div>
    {showLatest && <button type="button" className="sa-jump-latest sa-icon-button" aria-label="Jump to latest message" onClick={scrollLatest}><ChatIcon name="down" size={18} /></button>}
    <div className="sa-composer-area">
      {error && <p className="sa-chat-error" role="alert">{error}</p>}
      {copyError && <p className="sa-chat-error" role="alert">{copyError}</p>}
      <form className="sa-composer" onSubmit={send}>
        <label className="sa-sr-only" htmlFor="sa-message">Your study question</label>
        <textarea ref={textarea} id="sa-message" value={message} maxLength={6000} disabled={!chatReady || historyLoading} rows={1} placeholder="Ask anything about your studies…" onChange={event => onMessageChange(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(event); }
        }} />
        <div className="sa-composer-toolbar">
          <div className="sa-composer-settings">
            <label className="sa-select-control"><ChatIcon name="book" size={15} /><span className="sa-sr-only">Subject</span><select value={subject} onChange={event => onSubjectChange(event.target.value)} disabled={loading || historyLoading}>{SUBJECTS.map(option => <option key={option} value={option}>{option === "General" ? "All subjects" : option}</option>)}</select></label>
            <label className="sa-select-control"><ChatIcon name="sparkle" size={15} /><span className="sa-sr-only">Study mode</span><select value={mode} onChange={event => onModeChange(event.target.value)} disabled={loading || historyLoading}><option value="ask">Ask</option><option value="explain">Explain</option><option value="summarize">Summarize</option><option value="practice">Practice</option></select></label>
          </div>
          <span className="sa-stream-status" role="status">{streamStatus === "connecting" ? "Thinking…" : streamStatus === "streaming" ? "Writing…" : streamStatus === "saving" ? "Saving…" : ""}</span>
          <button className="sa-send-button" type="submit" disabled={loading || historyLoading || !chatReady || !message.trim()} aria-label="Send message">{loading ? <span className="sa-spinner" /> : <ChatIcon name="arrow" size={21} />}</button>
        </div>
      </form>
      <p className="sa-composer-hint">Study AI can make mistakes. Check important answers.<span>Enter to send · Shift + Enter for a new line</span></p>
    </div>
  </section>;
}
