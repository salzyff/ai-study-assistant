function environmentAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isEnvironmentAdmin(user) {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && environmentAdminEmails().has(email));
}

export function isAdminUser(user) {
  const role = user?.app_metadata?.role;
  return role === "admin" || isEnvironmentAdmin(user);
}

export function requireAdmin(req, res, next) {
  if (isAdminUser(req.user)) return next();
  return res.status(403).json({ error: "Administrator access required" });
}

export function adminUserProtectionReason(targetUser, currentUserId) {
  if (targetUser?.id === currentUserId) return "You cannot manage your own account here";
  if (isAdminUser(targetUser)) return "Administrator accounts are protected";
  return null;
}
