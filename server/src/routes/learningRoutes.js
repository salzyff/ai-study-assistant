import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { recordAiUsage } from "../middleware/aiUsage.js";
import {
  RequestValidationError,
  integerField,
  stringField,
  uuidField,
} from "../utils/validation.js";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const teachBackSchema = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
    next_question: { type: "string" },
  },
  required: ["score", "strengths", "gaps", "feedback", "next_question"],
};

const markingSchema = {
  type: "object",
  properties: {
    awarded_marks: { type: "integer", minimum: 0, maximum: 100 },
    met_points: { type: "array", items: { type: "string" } },
    missed_points: { type: "array", items: { type: "string" } },
    feedback: { type: "string" },
  },
  required: ["awarded_marks", "met_points", "missed_points", "feedback"],
};

function parseLimit(value, fallback = 30) {
  return Math.min(Math.max(Number(value) || fallback, 1), 100);
}

function stringArray(value, name, { min = 1, max = 20, itemMax = 500 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new RequestValidationError(`${name} must contain ${min} to ${max} items`);
  }

  return value.map((item, index) =>
    stringField(item, `${name}[${index}]`, { min: 1, max: itemMax }),
  );
}

router.get("/mistakes", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 50);
    const resolved = req.query.resolved === "true";
    const { data, error } = await supabase
      .from("mistake_notebook")
      .select("id, quiz_id, question_id, subject, topic, question, options, selected_option, correct_option, explanation, times_missed, resolved, last_missed_at, created_at")
      .eq("user_id", req.user.id)
      .eq("resolved", resolved)
      .order("last_missed_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ mistakes: data });
  } catch (error) {
    console.error("Load mistakes error:", error);
    res.status(500).json({ error: "Could not load the mistake notebook" });
  }
});

router.patch("/mistakes/:mistakeId", async (req, res) => {
  try {
    const mistakeId = uuidField(req.params.mistakeId, "mistakeId");
    if (typeof req.body.resolved !== "boolean") {
      return res.status(400).json({ error: "resolved must be true or false" });
    }

    const { data, error } = await supabase
      .from("mistake_notebook")
      .update({ resolved: req.body.resolved })
      .eq("id", mistakeId)
      .eq("user_id", req.user.id)
      .select("id, resolved")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Mistake not found" });
    res.json({ mistake: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Update mistake error:", error);
    res.status(500).json({ error: "Could not update the mistake" });
  }
});

router.get("/recommendations", async (req, res) => {
  try {
    const [masteryResult, mistakesResult] = await Promise.all([
      supabase
        .from("topic_mastery")
        .select("subject, topic, mastery_score, correct_count, attempt_count, last_practiced_at")
        .eq("user_id", req.user.id)
        .lt("mastery_score", 75)
        .order("mastery_score", { ascending: true })
        .limit(15),
      supabase
        .from("mistake_notebook")
        .select("subject, topic, times_missed")
        .eq("user_id", req.user.id)
        .eq("resolved", false),
    ]);

    if (masteryResult.error) throw masteryResult.error;
    if (mistakesResult.error) throw mistakesResult.error;

    const missedByTopic = new Map();
    for (const mistake of mistakesResult.data || []) {
      const key = `${mistake.subject}\u0000${mistake.topic}`;
      missedByTopic.set(key, (missedByTopic.get(key) || 0) + Number(mistake.times_missed || 1));
    }

    const recommendations = (masteryResult.data || []).map((topic) => {
      const unresolvedMistakes = missedByTopic.get(`${topic.subject}\u0000${topic.topic}`) || 0;
      return {
        ...topic,
        unresolvedMistakes,
        priority: topic.mastery_score < 45 || unresolvedMistakes >= 3 ? "high" : "medium",
        action: topic.mastery_score < 45
          ? "Review the explanation, then take an easy adaptive quiz."
          : "Take an adaptive quiz and review any missed questions.",
      };
    });

    res.json({ recommendations });
  } catch (error) {
    console.error("Recommendations error:", error);
    res.status(500).json({ error: "Could not load recommendations" });
  }
});

router.get("/daily-queue", async (req, res) => {
  try {
    const now = new Date().toISOString();
    const [setsResult, tasksResult, masteryResult, mistakesResult, goalsResult] = await Promise.all([
      supabase.from("flashcard_sets").select("id, subject, topic").eq("user_id", req.user.id),
      supabase.from("tasks").select("id, title, subject, due_date, priority").eq("user_id", req.user.id).eq("completed", false).order("due_date", { ascending: true, nullsFirst: false }).limit(10),
      supabase.from("topic_mastery").select("id, subject, topic, mastery_score").eq("user_id", req.user.id).lt("mastery_score", 75).order("mastery_score", { ascending: true }).limit(10),
      supabase.from("mistake_notebook").select("id, subject, topic, question, times_missed").eq("user_id", req.user.id).eq("resolved", false).order("last_missed_at", { ascending: false }).limit(10),
      supabase.from("study_goals").select("id, title, subject, target_type, target_value, current_value, period_end").eq("user_id", req.user.id).eq("completed", false).gte("period_end", now).order("period_end", { ascending: true }).limit(10),
    ]);

    const firstError = [setsResult, tasksResult, masteryResult, mistakesResult, goalsResult]
      .find((result) => result.error)?.error;
    if (firstError) throw firstError;

    let dueFlashcards = [];
    if (setsResult.data?.length) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, set_id, front, next_review_at")
        .in("set_id", setsResult.data.map((set) => set.id))
        .lte("next_review_at", now)
        .order("next_review_at", { ascending: true })
        .limit(20);
      if (error) throw error;
      const setMap = new Map(setsResult.data.map((set) => [set.id, set]));
      dueFlashcards = (data || []).map((card) => ({ ...card, set: setMap.get(card.set_id) }));
    }

    res.json({
      generatedAt: now,
      dueFlashcards,
      openTasks: tasksResult.data,
      weakTopics: masteryResult.data,
      mistakes: mistakesResult.data,
      activeGoals: goalsResult.data,
    });
  } catch (error) {
    console.error("Daily queue error:", error);
    res.status(500).json({ error: "Could not build the daily revision queue" });
  }
});

router.post("/teach-back", async (req, res) => {
  try {
    const subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    const topic = stringField(req.body.topic, "topic", { max: 200 });
    const explanation = stringField(req.body.explanation, "explanation", { min: 20, max: 8000 });

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `A secondary-school student is teaching a topic back to you. Evaluate understanding, not writing style.\nSubject: ${subject}\nTopic: ${topic}\nStudent explanation:\n${explanation}\nReturn a fair score from 0 to 100, specific strengths, important knowledge gaps, supportive corrective feedback, and one follow-up question. Do not invent gaps unrelated to the topic.`,
      response_format: { type: "text", mime_type: "application/json", schema: teachBackSchema },
    });

    const result = JSON.parse(response.output_text);
    const cleanResult = {
      score: Math.min(Math.max(Number(result.score) || 0, 0), 100),
      strengths: (result.strengths || []).slice(0, 10).map((item) => String(item).slice(0, 500)),
      gaps: (result.gaps || []).slice(0, 10).map((item) => String(item).slice(0, 500)),
      feedback: String(result.feedback || "").slice(0, 3000),
      next_question: String(result.next_question || "").slice(0, 1000),
    };

    const { data, error } = await supabase
      .from("teach_back_attempts")
      .insert({ user_id: req.user.id, subject, topic, explanation, ...cleanResult })
      .select("id, subject, topic, explanation, score, strengths, gaps, feedback, next_question, created_at")
      .single();
    if (error) throw error;

    await recordAiUsage(req.user.id, "teach_back");
    res.status(201).json({ attempt: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Teach-back error:", error);
    res.status(500).json({ error: "Could not evaluate the explanation" });
  }
});

router.get("/teach-back", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("teach_back_attempts")
      .select("id, subject, topic, explanation, score, strengths, gaps, feedback, next_question, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(parseLimit(req.query.limit));
    if (error) throw error;
    res.json({ attempts: data });
  } catch (error) {
    console.error("Teach-back history error:", error);
    res.status(500).json({ error: "Could not load teach-back history" });
  }
});

router.post("/mark-written", async (req, res) => {
  try {
    const subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    const topic = stringField(req.body.topic, "topic", { max: 200 });
    const question = stringField(req.body.question, "question", { max: 3000 });
    const studentAnswer = stringField(req.body.studentAnswer, "studentAnswer", { max: 8000 });
    const markingPoints = stringArray(req.body.markingPoints, "markingPoints", { min: 1, max: 20 });
    const maxMarks = integerField(req.body.maxMarks, "maxMarks", { min: 1, max: 100 });

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `Mark this secondary-school answer only against the supplied marking points.\nSubject: ${subject}\nTopic: ${topic}\nQuestion: ${question}\nMaximum marks: ${maxMarks}\nMarking points: ${markingPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}\nStudent answer: ${studentAnswer}\nAward no more than ${maxMarks} marks. Identify met and missed points and give concise improvement feedback.`,
      response_format: { type: "text", mime_type: "application/json", schema: markingSchema },
    });

    const result = JSON.parse(response.output_text);
    const awardedMarks = Math.min(Math.max(Number(result.awarded_marks) || 0, 0), maxMarks);
    const row = {
      user_id: req.user.id,
      subject,
      topic,
      question,
      student_answer: studentAnswer,
      marking_points: markingPoints,
      max_marks: maxMarks,
      awarded_marks: awardedMarks,
      met_points: (result.met_points || []).slice(0, 20).map((item) => String(item).slice(0, 500)),
      missed_points: (result.missed_points || []).slice(0, 20).map((item) => String(item).slice(0, 500)),
      feedback: String(result.feedback || "").slice(0, 3000),
    };

    const { data, error } = await supabase
      .from("written_assessments")
      .insert(row)
      .select("id, subject, topic, question, student_answer, marking_points, max_marks, awarded_marks, met_points, missed_points, feedback, created_at")
      .single();
    if (error) throw error;

    await recordAiUsage(req.user.id, "mark_written");
    res.status(201).json({ assessment: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Mark written answer error:", error);
    res.status(500).json({ error: "Could not mark the written answer" });
  }
});

router.get("/written-assessments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("written_assessments")
      .select("id, subject, topic, question, student_answer, marking_points, max_marks, awarded_marks, met_points, missed_points, feedback, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(parseLimit(req.query.limit));
    if (error) throw error;
    res.json({ assessments: data });
  } catch (error) {
    console.error("Written assessment history error:", error);
    res.status(500).json({ error: "Could not load marking history" });
  }
});

export default router;
