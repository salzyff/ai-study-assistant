import { randomUUID } from "node:crypto";
import { supabase } from "../supabase.js";
import { loadProgressData } from "../routes/progressRoutes.js";
import { buildProgressSummary } from "../utils/stats.js";
import { logger } from "../utils/logger.js";

const workerId = `${process.env.RENDER_INSTANCE_ID || "local"}-${randomUUID()}`;
let timer;
let running = false;

async function claimJob() {
  const { data, error } = await supabase.rpc("claim_background_job", {
    worker_id_input: workerId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function buildWeeklyReport(job) {
  const days = Math.min(Math.max(Number(job.payload?.days) || 7, 1), 90);
  const progressData = await loadProgressData(job.user_id, days);
  return {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    summary: buildProgressSummary(progressData),
  };
}

async function processJob(job) {
  if (job.job_type === "weekly_report") return buildWeeklyReport(job);
  throw new Error(`Unsupported background job type: ${job.job_type}`);
}

async function finishJob(jobId, updates) {
  const { error } = await supabase
    .from("background_jobs")
    .update({ ...updates, finished_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

export async function runBackgroundJobsOnce() {
  if (running) return false;
  running = true;
  try {
    const job = await claimJob();
    if (!job) return false;

    try {
      const result = await processJob(job);
      await finishJob(job.id, { status: "completed", result, error_message: null });
      logger.info("background_job_completed", { jobId: job.id, jobType: job.job_type, workerId });
    } catch (error) {
      await finishJob(job.id, { status: "failed", error_message: String(error.message || error).slice(0, 2000) });
      logger.error("background_job_failed", { jobId: job.id, jobType: job.job_type, workerId, error });
    }
    return true;
  } finally {
    running = false;
  }
}

export function startBackgroundWorker() {
  if (timer || process.env.ENABLE_BACKGROUND_WORKER !== "true") return;
  const intervalMs = Math.min(Math.max(Number(process.env.JOB_POLL_INTERVAL_MS) || 30_000, 5_000), 300_000);
  logger.info("background_worker_started", { workerId, intervalMs });
  runBackgroundJobsOnce().catch((error) => logger.error("background_worker_poll_failed", { error }));
  timer = setInterval(() => {
    runBackgroundJobsOnce().catch((error) => logger.error("background_worker_poll_failed", { error }));
  }, intervalMs);
  timer.unref?.();
}

export function stopBackgroundWorker() {
  if (timer) clearInterval(timer);
  timer = undefined;
}
