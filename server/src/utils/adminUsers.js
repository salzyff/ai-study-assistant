import { isAdminUser, isEnvironmentAdmin } from "../middleware/requireAdmin.js";

export function userNotFound(error) {
  return error?.status === 404 || error?.code === "user_not_found";
}

export function adminUserSummary(user, currentUserId) {
  const isDeleted = Boolean(user.deleted_at);
  const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.user_metadata?.name;
  return {
    id: user.id,
    email: isDeleted ? null : user.email || null,
    displayName: isDeleted ? "Previously deleted account" : typeof name === "string" ? name : "Student",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    emailConfirmedAt: user.email_confirmed_at,
    bannedUntil: user.banned_until,
    deletedAt: user.deleted_at || null,
    isDeleted,
    isAdmin: isAdminUser(user),
    isEnvironmentAdmin: isEnvironmentAdmin(user),
    isCurrentUser: user.id === currentUserId,
  };
}
