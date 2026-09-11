const routes = {
  "/": { title: "Study AI", public: true },
  "/login": { title: "Log in", public: true, authMode: "login" },
  "/register": { title: "Create account", public: true, authMode: "signup" },
  "/forgot-password": { title: "Forgot password", public: true, authMode: "forgot" },
  "/reset-password": { title: "Reset password", public: true, recovery: true },
  "/home": { title: "Home", tool: null },
  "/chat": { title: "New chat", tool: "chat", sessionId: null },
  "/quiz": { title: "Quiz", tool: "quiz" },
  "/tasks": { title: "Task planner", tool: "task" },
  "/study-plan": { title: "Study plan", tool: "plan" },
  "/notes": { title: "Notes & PDFs", tool: "notes" },
  "/flashcards": { title: "Flashcards", tool: "flashcards" },
  "/progress": { title: "Progress", tool: "progress" },
  "/dashboard": { title: "Study dashboard", tool: "dashboard" },
  "/learning": { title: "Learning centre", tool: "learning" },
  "/reports": { title: "Weekly reports", tool: "reports" },
  "/profile": { title: "Profile", tool: "profile" },
  "/profile/change-password": { title: "Change password", tool: "change-password" },
};

export const ADMIN_SECTIONS = {
  Overview: "/admin",
  Users: "/admin/users",
  Activity: "/admin/activity",
  "Answer reports": "/admin/answer-reports",
  Jobs: "/admin/jobs",
  "Server events": "/admin/logs",
};

for (const [section, path] of Object.entries(ADMIN_SECTIONS)) {
  routes[path] = { title: `Admin · ${section}`, tool: "admin", admin: true, section };
}

export function normalizePath(path) {
  return (path || "/").replace(/\/+$/, "") || "/";
}

export function resolveRoute(path) {
  const normalized = normalizePath(path);
  if (Object.hasOwn(routes, normalized)) return { ...routes[normalized], path: normalized };
  const chat = normalized.match(/^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (chat) return { title: "Chat", tool: "chat", sessionId: chat[1].toLowerCase(), path: normalized };
  return null;
}

export function toolPath(tool, sessionId = null) {
  if (tool === "chat") return sessionId ? `/chat/${sessionId}` : "/chat";
  if (tool === "admin-users") return ADMIN_SECTIONS.Users;
  return Object.entries(routes).find(([, route]) => !route.public && route.tool === tool)?.[0] || "/home";
}

export function authRedirect(path, signedIn, recovering = false) {
  const route = resolveRoute(path);
  if (recovering && signedIn) return path === "/reset-password" ? null : "/reset-password";
  if (!route || route.recovery) return null;
  if (signedIn && route.public) return "/home";
  if (!signedIn && !route.public) return "/login";
  return null;
}
