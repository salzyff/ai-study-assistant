import express from "express";
import { getAiUsage } from "../middleware/aiUsage.js";
import { supabase } from "../supabase.js";
import { adminUserProtectionReason, isAdminUser, isEnvironmentAdmin, requireAdmin } from "../middleware/requireAdmin.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";
import { RequestValidationError, uuidField, enumField } from "../utils/validation.js";
import { runBackgroundJobsOnce } from "../services/backgroundJobs.js";
import { getRecentLogs, logger } from "../utils/logger.js";

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
    const emails = new Map(await Promise.all([...new Set(data.map((event) => event.user_id))].map(async (id) => {
      const result = await supabase.auth.admin.getUserById(id);
      if (result.error && result.error.status !== 404) throw result.error;
      return [id, result.data?.user?.email || null];
    })));
    res.json({ events: data.map((event) => ({ ...event, email: emails.get(event.user_id) })), pagination: paginationResult({ ...pagination, count, returned: data.length }) });
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
    if (lookupError) throw lookupError;
    if (!target.user) return res.status(404).json({ error: "User not found" });
    if (isEnvironmentAdmin(target.user) && req.user.id !== userId) {
      return res.status(403).json({ error: "Only the original admin can change their own limit" });
    }
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { ai_daily_limit: limit },
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
    const [users, conversations, tasks, aiToday, failedJobs] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1 }),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("background_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    const databaseError = [conversations, tasks, aiToday, failedJobs].find((item) => item.error)?.error;
    if (users.error) throw users.error;
    if (databaseError) throw databaseError;
    res.json({
      generatedAt: new Date().toISOString(),
      users: users.data.total ?? users.data.users.length,
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

    const users = (data.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.user_metadata?.display_name || "Student",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      emailConfirmedAt: user.email_confirmed_at,
      bannedUntil: user.banned_until,
      isAdmin: isAdminUser(user),
      isEnvironmentAdmin: isEnvironmentAdmin(user),
      isCurrentUser: user.id === req.user.id,
    }));

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
  if (error) throw error;
  const target = data.user;
  if (!target) return { status: 404, error: "User not found" };
  const protectionReason = adminUserProtectionReason(target, currentUserId);
  if (protectionReason) return { status: target.id === currentUserId ? 400 : 403, error: protectionReason };
  return { target };
}

router.patch("/users/:userId/role", async (req, res) => {
  try {
    const userId = uuidField(req.params.userId, "userId");
    if (!["admin", "member"].includes(req.body.role)) {
      return res.status(400).json({ error: "role must be admin or member" });
    }

    const { data: targetResult, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError) throw targetError;
    const target = targetResult.user;
    if (!target) return res.status(404).json({ error: "User not found" });
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
    if (!manageable.target) return res.status(manageable.status).json({ error: manageable.error });

    const { error } = await supabase.auth.admin.deleteUser(userId, true);
    if (error) throw error;
    logger.info("admin_user_deleted", { adminUserId: req.user.id, targetUserId: userId });
    res.json({ message: "User deleted" });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "Could not delete this user" });
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
