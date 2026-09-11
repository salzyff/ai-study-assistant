import express from "express";
import { getAiUsage } from "../middleware/aiUsage.js";
import { supabase } from "../supabase.js";
import { adminUserProtectionReason, isAdminUser, isEnvironmentAdmin, requireAdmin } from "../middleware/requireAdmin.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";
import { RequestValidationError, uuidField, enumField } from "../utils/validation.js";
import { runBackgroundJobsOnce } from "../services/backgroundJobs.js";
import { getRecentLogs, logger } from "../utils/logger.js";
import { adminUserSummary, userNotFound } from "../utils/adminUsers.js";

const router = express.Router();

// Lets the frontend decide whether to display the admin navigation item.
// The protected endpoints below still perform their own server-side check.
router.get("/status", (req, res) => {
  res.json({ isAdmin: isAdminUser(req.user) });
});

router.use(requireAdmin);

router.get("/activity", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    let query = supabase.from("ai_usage").select("id, user_id, feature, created_at", { count: "exact" });
    if (req.query.userId) query = query.eq("user_id", uuidField(req.query.userId, "userId"));
    const { data, error, count } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(pagination.from, pagination.to);
    if (error) throw error;
    const rows = data || [];
    const emails = new Map(await Promise.all([...new Set(rows.map((event) => event.user_id))].map(async (id) => {
      const result = await supabase.auth.admin.getUserById(id);
      if (result.error && !userNotFound(result.error)) throw result.error;
      return [id, result.data?.user?.deleted_at ? null : result.data?.user?.email || null];
    })));
    res.json({ events: rows.map((event) => ({ ...event, email: emails.get(event.user_id) })), pagination: paginationResult({ ...pagination, count, returned: rows.length }) });
  } catch (error) {
    res.status(error instanceof RequestValidationError ? 400 : 500).json({ error: error instanceof RequestValidationError ? error.message : "Could not load activity" });
  }
});

router.get("/users/:userId/activity", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const [usage, events] = await Promise.all([
      getAiUsage(userId),
      supabase.from("ai_usage").select("id, feature, created_at", { count: "exact" })
        .eq("user_id", userId).order("created_at", { ascending: false })
        .order("id", { ascending: false }).range(pagination.from, pagination.to),
    ]);
    if (events.error) throw events.error;
    res.json({ usage, events: events.data, pagination: paginationResult({ ...pagination, count: events.count, returned: events.data.length }) });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Could not load user activity" });
  }
});

router.patch("/users/:userId/limit", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    const limit = req.body.limit;
    if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 10000)) {
      return res.status(400).json({ error: "Limit must be a whole number from 0 to 10000, or null to use the default" });
    }
    const { data: target, error: lookupError } = await supabase.auth.admin.getUserById(userId);
    if (lookupError && !userNotFound(lookupError)) throw lookupError;
    if (lookupError || !target?.user || target.user.deleted_at) return res.status(404).json({ error: "Active user not found" });
    if (isEnvironmentAdmin(target.user) && req.user.id !== userId) {
      return res.status(403).json({ error: "Only the original admin can change their own limit" });
    }
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { ...(target.user.app_metadata || {}), ai_daily_limit: limit },
    });
    if (error) throw error;
    logger.info("admin_user_limit_changed", { adminUserId: req.user.id, targetUserId: userId, limit });
    res.json({ message: limit === null ? "Default limit restored" : "Daily limit updated" });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: "Could not update the daily limit" });
  }
});

router.get("/overview", async (_req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const seatLimit = Number.isInteger(Number.parseInt(process.env.SCHOOL_SEAT_LIMIT, 10))
      ? Math.max(1, Math.min(10000, Number.parseInt(process.env.SCHOOL_SEAT_LIMIT, 10)))
      : 100;
    const [users, conversations, tasks, aiToday, failedJobs] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("background_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    const databaseError = [conversations, tasks, aiToday, failedJobs].find((item) => item.error)?.error;
    if (users.error) throw users.error;
    if (databaseError) throw databaseError;
    const allUsers = (users.data.users || []).filter((user) => !user.deleted_at);
    const confirmedUsers = allUsers.filter((user) => user.email_confirmed_at).length;
    const activeUsersLast7Days = allUsers.filter((user) => user.last_sign_in_at && user.last_sign_in_at >= activeSince).length;
    const administrators = allUsers.filter((user) => isAdminUser(user)).length;
    const userCount = allUsers.length;
    res.json({
      generatedAt: new Date().toISOString(),
      users: userCount,
      seatLimit,
      seatsRemaining: Math.max(0, seatLimit - userCount),
      confirmedUsers,
      activeUsersLast7Days,
      administrators,
      conversations: conversations.count || 0,
      tasks: tasks.count || 0,
      aiRequestsLast24Hours: aiToday.count || 0,
      failedJobs: failedJobs.count || 0,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ error: "Could not load admin overview" });
  }
});

router.get("/logs", (req, res) => {
  res.json({
    logs: getRecentLogs(req.query.limit),
    note: "Recent logs from the current server instance",
  });
});

router.get("/users", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const page = Math.floor(pagination.offset / pagination.limit) + 1;
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pagination.limit,
    });
    if (error) throw error;

    const users = (data.users || []).map((user) => adminUserSummary(user, req.user.id));

    res.json({
      users,
      pagination: paginationResult({
        ...pagination,
        count: data.total,
        returned: users.length,
      }),
    });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Could not load users" });
  }
});

async function getManageableUser(userId, currentUserId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (userNotFound(error)) return { status: 404, error: "User not found" };
  if (error) throw error;
  const target = data?.user;
  if (!target) return { status: 404, error: "User not found" };
  const protectionReason = adminUserProtectionReason(target, currentUserId);
  if (protectionReason) return { status: target.id === currentUserId ? 400 : 403, error: protectionReason };
  return { target };
}

// End registered Study AI sessions without deleting the account or study data.
router.post("/users/:userId/end-sessions", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    const manageable = await getManageableUser(userId, req.user.id);
    if (manageable.error) return res.status(manageable.status).json({ error: manageable.error });
    const { error } = await supabase.from("app_sessions").update({ expired: true }).eq("user_id", userId);
    if (error) throw error;
    logger.info("admin_app_sessions_ended", { adminUserId: req.user.id, targetUserId: userId });
    res.json({ message: "Existing Study AI sessions ended. The member must sign in again on their next app request." });
  } catch (error) {
    res.status(error instanceof RequestValidationError ? 400 : 500).json({ error: error instanceof RequestValidationError ? error.message : "Could not end app sessions" });
  }
});

router.patch("/users/:userId/role", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    if (!["admin", "member"].includes(req.body.role)) {
      return res.status(400).json({ error: "role must be admin or member" });
    }

    const { data: targetResult, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError && !userNotFound(targetError)) throw targetError;
    const target = targetResult?.user;
    if (targetError || !target || target.deleted_at) return res.status(404).json({ error: "Active user not found" });
    if (target.id === req.user.id) return res.status(400).json({ error: "You cannot change your own administrator role" });

    const promoting = req.body.role === "admin";
    if (promoting && isAdminUser(target)) {
      return res.status(400).json({ error: "This user is already an administrator" });
    }
    if (!promoting && isEnvironmentAdmin(target)) {
      return res.status(403).json({ error: "The original environment administrator cannot be demoted" });
    }
    if (!promoting && target.app_metadata?.role !== "admin") {
      return res.status(400).json({ error: "This user is not a promoted administrator" });
    }

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(target.app_metadata || {}),
        role: req.body.role,
      },
    });
    if (error) throw error;

    logger.info(promoting ? "admin_user_promoted" : "admin_user_demoted", {
      adminUserId: req.user.id,
      targetUserId: userId,
    });

    res.json({
      user: { id: data.user.id, email: data.user.email, isAdmin: promoting },
      message: promoting
        ? "User promoted to administrator. They should sign out and sign in again to refresh access."
        : "Administrator demoted to member. Their administrator access has been removed.",
    });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin change user role error:", error);
    res.status(500).json({ error: "Could not change this user's role" });
  }
});

router.patch("/users/:userId/status", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    if (typeof req.body.suspended !== "boolean") {
      return res.status(400).json({ error: "suspended must be true or false" });
    }

    const manageable = await getManageableUser(userId, req.user.id);
    if (!manageable.target) return res.status(manageable.status).json({ error: manageable.error });
    if (manageable.target.deleted_at) return res.status(409).json({ error: "This account was already soft-deleted. Use Permanently remove instead." });

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: req.body.suspended ? "876000h" : "none",
    });
    if (error) throw error;
    logger.info(req.body.suspended ? "admin_user_suspended" : "admin_user_reactivated", { adminUserId: req.user.id, targetUserId: userId });
    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        bannedUntil: data.user.banned_until,
      },
      message: req.body.suspended ? "User suspended" : "User reactivated",
    });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin update user error:", error);
    res.status(500).json({ error: "Could not update this user" });
  }
});

router.delete("/users/:userId", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    const manageable = await getManageableUser(userId, req.user.id);
    if (manageable.status === 404) return res.json({ id: userId, deleted: true, message: "This account is already deleted." });
    if (!manageable.target) return res.status(manageable.status).json({ error: manageable.error });

    // Fail closed if ownership cascades have not been installed. Never delete
    // tables one by one: an Auth deletion must roll back if a relation blocks it.
    const readiness = await supabase.rpc("study_ai_user_deletion_ready");
    if (readiness.error || readiness.data !== true) {
      logger.error("admin_user_deletion_schema_unavailable", { code: readiness.error?.code });
      return res.status(503).json({ code: "DELETION_SETUP_REQUIRED", error: "No account was deleted. Run server/supabase/migrations/007_user_deletion.sql in Supabase, then retry." });
    }
    const { error } = await supabase.auth.admin.deleteUser(userId, false);
    if (userNotFound(error)) return res.json({ id: userId, deleted: true, message: "This account is already deleted." });
    if (error) throw error;

    const verification = await supabase.auth.admin.getUserById(userId);
    if ((!verification.error && verification.data?.user) || (verification.error && !userNotFound(verification.error))) {
      return res.status(502).json({ error: "Could not confirm permanent deletion. Refresh the user list before trying again." });
    }
    logger.info("admin_user_deleted", { adminUserId: req.user.id, targetUserId: userId });
    res.json({ id: userId, deleted: true, message: "Account and its study data permanently deleted." });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Permanent deletion failed. The account was not marked as deleted. Check server logs for a database constraint or Supabase Storage ownership error, then retry." });
  }
});

router.get("/jobs", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 30 });
    const status = enumField(req.query.status, "status", ["all", "queued", "processing", "completed", "failed"], "all");
    let query = supabase
      .from("background_jobs")
      .select("id, user_id, job_type, status, attempts, error_message, worker_id, created_at, started_at, finished_at", { count: "exact" });
    if (status !== "all") query = query.eq("status", status);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(pagination.from, pagination.to);
    if (error) throw error;
    res.json({ jobs: data, pagination: paginationResult({ ...pagination, count, returned: data.length }) });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin jobs error:", error);
    res.status(500).json({ error: "Could not load background jobs" });
  }
});

router.post("/jobs/:jobId/retry", async (req, res) => {
  try {
    const jobId = uuidField(req.params.jobId, "jobId");
    const { data, error } = await supabase
      .from("background_jobs")
      .update({ status: "queued", error_message: null, worker_id: null, started_at: null, finished_at: null, run_after: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "failed")
      .select("id, job_type, status, created_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Failed job not found" });
    logger.info("admin_job_retried", { adminUserId: req.user.id, jobId });
    res.json({ job: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Retry background job error:", error);
    res.status(500).json({ error: "Could not retry the background job" });
  }
});

router.post("/jobs/run-once", async (_req, res) => {
  try {
    res.json({ processed: await runBackgroundJobsOnce() });
  } catch (error) {
    console.error("Manual background job run error:", error);
    res.status(500).json({ error: "Could not run the background worker" });
  }
});

export default router;
