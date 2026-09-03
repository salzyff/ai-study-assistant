import express from "express";
import { supabase } from "../supabase.js";
import { getAiUsage } from "../middleware/aiUsage.js";
import { loadProgressData } from "./progressRoutes.js";
import { buildProgressSummary } from "../utils/stats.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const [progressData, notesResult, setsResult, aiUsage] = await Promise.all([
      loadProgressData(req.user.id, 30),
      supabase.from("study_notes").select("id", { count: "exact", head: true }).eq("user_id", req.user.id),
      supabase.from("flashcard_sets").select("id", { count: "exact", head: true }).eq("user_id", req.user.id),
      getAiUsage(req.user.id),
    ]);

    if (notesResult.error) throw notesResult.error;
    if (setsResult.error) throw setsResult.error;

    const now = Date.now();
    const inSevenDays = now + 7 * 24 * 60 * 60 * 1000;
    const openTasks = progressData.tasks.filter((task) => !task.completed);
    const progress = buildProgressSummary(progressData);

    res.json({
      generatedAt: new Date().toISOString(),
      cards: {
        openTasks: openTasks.length,
        dueThisWeek: openTasks.filter((task) => {
          const dueTime = task.due_date ? new Date(task.due_date).getTime() : null;
          return dueTime && dueTime >= now && dueTime <= inSevenDays;
        }).length,
        overdueTasks: openTasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < now).length,
        quizAverage: progress.quizzes.averagePercentage,
        minutesStudied: progress.study.minutesStudied,
        studyStreak: progress.study.streakDays,
        savedNotes: notesResult.count || 0,
        flashcardSets: setsResult.count || 0,
      },
      subjectProgress: progress.subjectProgress,
      aiUsage,
    });
  } catch (error) {
    console.error("Load dashboard error:", error);
    res.status(500).json({ error: "Could not load dashboard statistics" });
  }
});

export default router;
