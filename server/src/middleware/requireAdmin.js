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
