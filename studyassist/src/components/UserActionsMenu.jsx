import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function UserActionsMenu({ email, children }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);
  const panel = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const element = panel.current;
    const position = () => {
      if (!element || !trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 24);
      element.style.width = `${width}px`;
      element.style.maxHeight = `${window.innerHeight - 24}px`;
      element.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`;
      const height = element.offsetHeight;
      const below = rect.bottom + 8;
      element.style.top = `${Math.max(12, Math.min(below + height <= window.innerHeight - 12 ? below : rect.top - height - 8, window.innerHeight - height - 12))}px`;
    };
    position();
    element.querySelector("button:not(:disabled)")?.focus();
    const dismiss = (event) => {
      if (!element.contains(event.target) && !trigger.current.contains(event.target)) setOpen(false);
    };
    const keyboard = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current.focus();
      }
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(position) : null;
    observer?.observe(element);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", keyboard);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer?.disconnect();
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", keyboard);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="user-action-trigger" aria-label={`Actions for ${email}`} aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(!open)}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
    </button>
    {open && createPortal(<div ref={panel} id={id} className="user-action-panel" role="region" aria-label={`Actions for ${email}`}>
      <div className="user-action-heading">Manage user<span>{email}</span></div>
      {children}
    </div>, document.body)}
  </>;
}
