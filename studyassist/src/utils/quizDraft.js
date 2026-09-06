export const draftKey = (userId) => `study-ai:quiz-draft:${userId}`;
export function readQuizDraft(userId) {
  try { const draft = JSON.parse(localStorage.getItem(draftKey(userId))); return draft?.quiz?.id && Array.isArray(draft.questions) && draft.answers && typeof draft.answers === 'object' ? draft : null; } catch { return null; }
}
export function saveQuizDraft(userId, draft) {
  try { if (!userId) return false; if (draft) localStorage.setItem(draftKey(userId),JSON.stringify(draft)); else localStorage.removeItem(draftKey(userId)); return true; } catch { return false; }
}
