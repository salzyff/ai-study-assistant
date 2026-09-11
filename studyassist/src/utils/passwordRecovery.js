const KEY = "studyai-recovery-page";
const LIFETIME = 15 * 60 * 1000;

// This remembers the page after a verified recovery event, not authentication.
// Supabase remains responsible for validating the session and password update.
export function rememberRecovery(userId, storage) {
  try { (storage || window.sessionStorage).setItem(KEY, JSON.stringify({ userId, expiresAt: Date.now() + LIFETIME })); }
  catch { /* Recovery still works without refresh when storage is unavailable. */ }
}

export function hasRecovery(userId, storage) {
  if (!userId) return false;
  try {
    const saved = JSON.parse((storage || window.sessionStorage).getItem(KEY) || "null");
    return Boolean(saved && saved.userId === userId && Number.isFinite(saved.expiresAt) && saved.expiresAt > Date.now() && saved.expiresAt <= Date.now() + LIFETIME);
  } catch { return false; }
}

export function clearRecovery(storage) {
  try { (storage || window.sessionStorage).removeItem(KEY); } catch { /* Optional UI state. */ }
}
