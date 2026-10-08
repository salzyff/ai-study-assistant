export function mergeChatHistory(current, incoming) {
  const byId = new Map(current.map(chat => [chat.id, chat]));
  incoming.forEach(chat => byId.set(chat.id, chat));
  return [...byId.values()].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

export function groupChatHistory(chats, query = "", now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = count => { const date = new Date(day); date.setDate(date.getDate() - count); return date.getTime(); };
  const search = query.trim().toLocaleLowerCase();
  const groups = new Map();

  for (const chat of mergeChatHistory([], chats)) {
    if (search && !`${chat.title || "New conversation"} ${chat.subject || ""}`.toLocaleLowerCase().includes(search)) continue;
    const timestamp = new Date(chat.updated_at || chat.created_at).getTime();
    const label = timestamp >= day.getTime() ? "Today"
      : timestamp >= daysAgo(1) ? "Yesterday"
      : timestamp >= daysAgo(7) ? "Previous 7 days"
      : timestamp >= daysAgo(30) ? "Previous 30 days"
      : Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(timestamp))
      : "Older chats";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(chat);
  }
  return [...groups].map(([label, conversations]) => ({ label, conversations }));
}
