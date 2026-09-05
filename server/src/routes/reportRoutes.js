import express from "express";
import { supabase } from "../supabase.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";
import { RequestValidationError } from "../utils/validation.js";

const router = express.Router();

router.post("/weekly", async (req, res) => {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("background_jobs")
      .select("id, status, created_at")
      .eq("user_id", req.user.id)
      .eq("job_type", "weekly_report")
      .in("status", ["queued", "processing"])
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return res.status(202).json({ job: existing, message: "A weekly report is already being prepared" });

    const { data, error } = await supabase
      .from("background_jobs")
      .insert({ user_id: req.user.id, job_type: "weekly_report", payload: { days: 7 } })
      .select("id, job_type, status, created_at")
      .single();
    if (error) throw error;
    res.status(202).json({ job: data });
  } catch (error) {
    console.error("Queue weekly report error:", error);
    res.status(500).json({ error: "Could not queue the weekly report" });
  }
});

router.get("/", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 20 });
    const { data, error, count } = await supabase
      .from("background_jobs")
      .select("id, job_type, status, result, error_message, created_at, started_at, finished_at", { count: "exact" })
      .eq("user_id", req.user.id)
      .eq("job_type", "weekly_report")
      .order("created_at", { ascending: false })
      .range(pagination.from, pagination.to);
    if (error) throw error;
    res.json({ reports: data, pagination: paginationResult({ ...pagination, count, returned: data.length }) });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Load reports error:", error);
    res.status(500).json({ error: "Could not load reports" });
  }
});

export default router;
