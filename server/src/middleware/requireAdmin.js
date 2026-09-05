export function isAdminUser(user) {
  const adminEmails = new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const role = user?.app_metadata?.role;
  const email = user?.email?.toLowerCase();
  return role === "admin" || Boolean(email && adminEmails.has(email));
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
