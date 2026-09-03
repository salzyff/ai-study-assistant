import express from "express";
import { supabase } from "../supabase.js";
import { buildProgressSummary } from "../utils/stats.js";
import { dateField, integerField, stringField, uuidField, validateBody } from "../utils/validation.js";

const router = express.Router();

function cutoffDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

async function loadProgressData(userId, days) {
  const since = cutoffDate(days);
  const [tasksResult, attemptsResult, sessionsResult, reviewsResult] = await Promise.all([
    supabase.from("tasks").select("id, completed, subject, priority, due_date").eq("user_id", userId),
    supabase.from("quiz_attempts").select("score, total, created_at, quizzes(subject, topic)").eq("user_id", userId).gte("created_at", since),
    supabase.from("study_sessions").select("id, subject, topic, planned_minutes, actual_minutes, completed, started_at, completed_at").eq("user_id", userId).gte("started_at", since),
    supabase.from("flashcard_reviews").select("rating, created_at").eq("user_id", userId).gte("created_at", since),
  ]);

  const firstError = [tasksResult, attemptsResult, sessionsResult, reviewsResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  return {
    tasks: tasksResult.data,
    attempts: attemptsResult.data,
    sessions: sessionsResult.data,
    reviews: reviewsResult.data,
  };
}

router.get("/", async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 365);
    const data = await loadProgressData(req.user.id, days);
    res.json({ periodDays: days, ...buildProgressSummary(data) });
  } catch (error) {
    console.error("Load progress error:", error);
    res.status(500).json({ error: "Could not load study progress" });
  }
});

router.get("/study-sessions", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const { data, error } = await supabase
      .from("study_sessions")
      .select("id, task_id, subject, topic, planned_minutes, actual_minutes, completed, started_at, completed_at")
      .eq("user_id", req.user.id)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ sessions: data });
  } catch (error) {
    console.error("Load study sessions error:", error);
    res.status(500).json({ error: "Could not load study sessions" });
  }
});

router.post(
  "/study-sessions",
  validateBody((body) => ({
    subject: stringField(body.subject || "General", "subject", { max: 80 }),
    topic: stringField(body.topic, "topic", { min: 2, max: 200 }),
    plannedMinutes: integerField(body.plannedMinutes ?? 25, "plannedMinutes", { min: 5, max: 180 }),
    taskId: uuidField(body.taskId, "taskId", { required: false }),
  })),
  async (req, res) => {
    try {
      const input = req.validatedBody;

      if (input.taskId) {
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .select("id")
          .eq("id", input.taskId)
          .eq("user_id", req.user.id)
          .maybeSingle();

        if (taskError) throw taskError;
        if (!task) return res.status(404).json({ error: "Task not found" });
      }

      const { data, error } = await supabase
        .from("study_sessions")
        .insert({
          user_id: req.user.id,
          task_id: input.taskId,
          subject: input.subject,
          topic: input.topic,
          planned_minutes: input.plannedMinutes,
        })
        .select("id, task_id, subject, topic, planned_minutes, completed, started_at")
        .single();

      if (error) throw error;
      res.status(201).json({ session: data });
    } catch (error) {
      console.error("Create study session error:", error);
      res.status(500).json({ error: "Could not create study session" });
    }
  },
);

router.patch(
  "/study-sessions/:sessionId/complete",
  validateBody((body) => ({
    actualMinutes: integerField(body.actualMinutes, "actualMinutes", { min: 1, max: 240 }),
    completedAt: dateField(body.completedAt, "completedAt", { required: false }),
  })),
  async (req, res) => {
    try {
      const sessionId = uuidField(req.params.sessionId, "sessionId");
      const { data: session, error } = await supabase
        .from("study_sessions")
        .update({
          actual_minutes: req.validatedBody.actualMinutes,
          completed: true,
          completed_at: req.validatedBody.completedAt || new Date().toISOString(),
        })
        .eq("id", sessionId)
        .eq("user_id", req.user.id)
        .select("id, task_id, subject, topic, planned_minutes, actual_minutes, completed, started_at, completed_at")
        .maybeSingle();

      if (error) throw error;
      if (!session) return res.status(404).json({ error: "Study session not found" });

      if (session.task_id) {
        await supabase
          .from("tasks")
          .update({ completed: true, completed_at: session.completed_at, updated_at: new Date().toISOString() })
          .eq("id", session.task_id)
          .eq("user_id", req.user.id);
      }

      res.json({ session });
    } catch (error) {
      if (error.statusCode === 400) return res.status(400).json({ error: error.message });
      console.error("Complete study session error:", error);
      res.status(500).json({ error: "Could not complete study session" });
    }
  },
);

export { loadProgressData };
export default router;
