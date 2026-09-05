import express from "express";
import { supabase } from "../supabase.js";
import { isAdminUser, requireAdmin } from "../middleware/requireAdmin.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";
import { RequestValidationError, uuidField } from "../utils/validation.js";
import { runBackgroundJobsOnce } from "../services/backgroundJobs.js";
import { getRecentLogs } from "../utils/logger.js";

const router = express.Router();

// Lets the frontend decide whether to display the admin navigation item.
// The protected endpoints below still perform their own server-side check.
router.get("/status", (req, res) => {
  res.json({ isAdmin: isAdminUser(req.user) });
});

router.use(requireAdmin);

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

router.get("/jobs", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 30 });
    const { data, error, count } = await supabase
      .from("background_jobs")
      .select("id, user_id, job_type, status, attempts, error_message, worker_id, created_at, started_at, finished_at", { count: "exact" })
      .order("created_at", { ascending: false })
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
