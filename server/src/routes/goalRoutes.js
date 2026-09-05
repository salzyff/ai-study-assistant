import express from "express";
import { supabase } from "../supabase.js";
import { calculateGoalProgress } from "../utils/learning.js";
import {
  RequestValidationError,
  dateField,
  enumField,
  integerField,
  stringField,
  uuidField,
} from "../utils/validation.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";

const router = express.Router();
const targetTypes = ["study_minutes", "quiz_score", "tasks_completed", "sessions_completed"];

async function loadGoalActivity(userId) {
  const [sessionsResult, attemptsResult, tasksResult] = await Promise.all([
    supabase.from("study_sessions").select("subject, planned_minutes, actual_minutes, completed, completed_at").eq("user_id", userId),
    supabase.from("quiz_attempts").select("score, total, created_at, quizzes(subject)").eq("user_id", userId),
    supabase.from("tasks").select("subject, completed, completed_at").eq("user_id", userId),
  ]);

  const firstError = [sessionsResult, attemptsResult, tasksResult].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  return { sessions: sessionsResult.data, attempts: attemptsResult.data, tasks: tasksResult.data };
}

async function refreshGoals(userId, goals) {
  if (!goals.length) return [];
  const activity = await loadGoalActivity(userId);

  return Promise.all(goals.map(async (goal) => {
    const currentValue = calculateGoalProgress(goal, activity);
    const completed = currentValue >= goal.target_value;

    if (currentValue !== goal.current_value || completed !== goal.completed) {
      const { error } = await supabase
        .from("study_goals")
        .update({ current_value: currentValue, completed, updated_at: new Date().toISOString() })
        .eq("id", goal.id)
        .eq("user_id", userId);
      if (error) throw error;
    }

    return {
      ...goal,
      current_value: currentValue,
      completed,
      percentage: Math.min(Math.round((currentValue / goal.target_value) * 100), 100),
    };
  }));
}

router.get("/", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 30 });
    const { data, error, count } = await supabase
      .from("study_goals")
      .select("id, subject, title, target_type, target_value, current_value, period_start, period_end, completed, created_at, updated_at", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("period_end", { ascending: true })
      .range(pagination.from, pagination.to);
    if (error) throw error;
    const goals = await refreshGoals(req.user.id, data || []);
    res.json({ goals, pagination: paginationResult({ ...pagination, count, returned: goals.length }) });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Load goals error:", error);
    res.status(500).json({ error: "Could not load study goals" });
  }
});

router.post("/", async (req, res) => {
  try {
    const periodStart = dateField(req.body.periodStart, "periodStart") || new Date().toISOString();
    const periodEnd = dateField(req.body.periodEnd, "periodEnd", { required: true });
    if (new Date(periodEnd) <= new Date(periodStart)) {
      throw new RequestValidationError("periodEnd must be after periodStart");
    }

    const row = {
      user_id: req.user.id,
      subject: stringField(req.body.subject || "General", "subject", { max: 80 }),
      title: stringField(req.body.title, "title", { max: 160 }),
      target_type: enumField(req.body.targetType, "targetType", targetTypes),
      target_value: integerField(req.body.targetValue, "targetValue", { min: 1, max: 10_000 }),
      period_start: periodStart,
      period_end: periodEnd,
    };

    const { data, error } = await supabase
      .from("study_goals")
      .insert(row)
      .select("id, subject, title, target_type, target_value, current_value, period_start, period_end, completed, created_at, updated_at")
      .single();
    if (error) throw error;
    res.status(201).json({ goal: { ...data, percentage: 0 } });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Create goal error:", error);
    res.status(500).json({ error: "Could not create the study goal" });
  }
});

router.patch("/:goalId", async (req, res) => {
  try {
    const goalId = uuidField(req.params.goalId, "goalId");
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.subject !== undefined) updates.subject = stringField(req.body.subject, "subject", { max: 80 });
    if (req.body.title !== undefined) updates.title = stringField(req.body.title, "title", { max: 160 });
    if (req.body.targetType !== undefined) updates.target_type = enumField(req.body.targetType, "targetType", targetTypes);
    if (req.body.targetValue !== undefined) updates.target_value = integerField(req.body.targetValue, "targetValue", { min: 1, max: 10_000 });
    if (req.body.periodStart !== undefined) updates.period_start = dateField(req.body.periodStart, "periodStart", { required: true });
    if (req.body.periodEnd !== undefined) updates.period_end = dateField(req.body.periodEnd, "periodEnd", { required: true });

    const { data, error } = await supabase
      .from("study_goals")
      .update(updates)
      .eq("id", goalId)
      .eq("user_id", req.user.id)
      .select("id, subject, title, target_type, target_value, current_value, period_start, period_end, completed, created_at, updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Study goal not found" });
    res.json({ goal: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Update goal error:", error);
    res.status(500).json({ error: "Could not update the study goal" });
  }
});

router.delete("/:goalId", async (req, res) => {
  try {
    const goalId = uuidField(req.params.goalId, "goalId");
    const { data, error } = await supabase
      .from("study_goals")
      .delete()
      .eq("id", goalId)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Study goal not found" });
    res.json({ message: "Study goal deleted" });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Delete goal error:", error);
    res.status(500).json({ error: "Could not delete the study goal" });
  }
});

export default router;
