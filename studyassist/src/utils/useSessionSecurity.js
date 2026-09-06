import { useEffect } from "react";
import { supabase } from "../supabase";
import { apiRequest } from "../api";

// The database is authoritative. This timer also locks an already-open offline screen.
export function useSessionSecurity(accessToken, recovery, onExpired) {
  useEffect(() => {
    if (!accessToken || recovery) return;
    let stopped = false;
    let busy = false;
    let ending = false;
    let lastSuccess = Date.now();
    async function endSession() {
      if (ending || stopped) return;
      ending = true;
      onExpired();
      // Local scope keeps other devices logged in; the expired server session stays expired.
      try { await supabase.auth.signOut({ scope: "local" }); } catch { /* The UI stays locked when offline. */ }
    }
    async function check() {
      if (stopped || ending || busy) return;
      if (Date.now() - lastSuccess >= 60 * 60 * 1000) { await endSession(); return; }
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      busy = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        await apiRequest("/api/session/heartbeat", { accessToken, method: "POST", signal: controller.signal });
        if (!stopped) lastSuccess = Date.now();
      } catch (e) {
        if (!stopped && e.status === 401) await endSession();
      } finally { clearTimeout(timeout); busy = false; }
    }
    const expire = () => { void endSession(); };
    const wake = () => { void check(); };
    window.addEventListener("study-session-ended", expire);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    const timer = setInterval(wake, 30000);
    wake();
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("study-session-ended", expire);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [accessToken, recovery, onExpired]);
}
