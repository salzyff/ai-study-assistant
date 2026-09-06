export function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item.content === 'string' && ['student','assistant'].includes(item.role));
}
export function reportableId(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function storePreferences(preferences) {
  try { localStorage.setItem('studyai-preferences', JSON.stringify(preferences)); return true; }
  catch { return false; }
}
