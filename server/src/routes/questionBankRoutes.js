import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { recordAiUsage } from "../middleware/aiUsage.js";
import {
  RequestValidationError,
  enumField,
  integerField,
  stringField,
  uuidField,
} from "../utils/validation.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const difficulties = ["easy", "medium", "hard"];

const questionSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correct_option: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
          marking_points: { type: "array", items: { type: "string" } },
        },
        required: ["question", "options", "correct_option", "explanation", "marking_points"],
      },
    },
  },
  required: ["questions"],
};

function optionsField(value) {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new RequestValidationError("options must contain exactly four choices");
  }
  return value.map((option, index) => stringField(option, `options[${index}]`, { max: 500 }));
}

function markingPointsField(value, { required = false } = {}) {
  if (value === undefined && !required) return [];
  if (!Array.isArray(value) || value.length > 20 || (required && value.length === 0)) {
    throw new RequestValidationError("markingPoints must contain 1 to 20 items");
  }
  return value.map((point, index) => stringField(point, `markingPoints[${index}]`, { max: 500 }));
}

function yearField(value) {
  return value === undefined || value === null || value === ""
    ? null
    : integerField(value, "examYear", { min: 1900, max: 2100 });
}

function cleanGeneratedQuestion(question) {
  return {
    question: stringField(question.question, "generated question", { max: 2000 }),
    options: optionsField(question.options),
    correct_option: integerField(question.correct_option, "generated correct option", { min: 0, max: 3 }),
    explanation: stringField(question.explanation, "generated explanation", { max: 3000 }),
    marking_points: markingPointsField(question.marking_points),
  };
}

router.get("/", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 50 });
    let query = supabase
      .from("question_bank")
      .select("id, subject, topic, exam_type, exam_year, difficulty, question, options, explanation, marking_points, source_type, source_label, created_at", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(pagination.from, pagination.to);

    if (req.query.subject) query = query.eq("subject", stringField(req.query.subject, "subject", { max: 80 }));
    if (req.query.topic) query = query.ilike("topic", `%${stringField(req.query.topic, "topic", { max: 200 })}%`);
    if (req.query.examType) query = query.eq("exam_type", stringField(req.query.examType, "examType", { max: 80 }));
    if (req.query.examYear) query = query.eq("exam_year", yearField(req.query.examYear));
    if (req.query.difficulty) query = query.eq("difficulty", enumField(req.query.difficulty, "difficulty", difficulties));

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ questions: data, pagination: paginationResult({ ...pagination, count, returned: data.length }) });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Load question bank error:", error);
    res.status(500).json({ error: "Could not load the question bank" });
  }
});

router.post("/", async (req, res) => {
  try {
    if (req.body.hasRights !== true) {
      return res.status(400).json({
        error: "Confirm hasRights=true only for questions you created or have permission to store",
      });
    }

    const row = {
      user_id: req.user.id,
      subject: stringField(req.body.subject || "General", "subject", { max: 80 }),
      topic: stringField(req.body.topic, "topic", { max: 200 }),
      exam_type: stringField(req.body.examType || "Practice", "examType", { max: 80 }),
      exam_year: yearField(req.body.examYear),
      difficulty: enumField(req.body.difficulty, "difficulty", difficulties, "medium"),
      question: stringField(req.body.question, "question", { max: 2000 }),
      options: optionsField(req.body.options),
      correct_option: integerField(req.body.correctOption, "correctOption", { min: 0, max: 3 }),
      explanation: stringField(req.body.explanation, "explanation", { max: 3000 }),
      marking_points: markingPointsField(req.body.markingPoints),
      source_type: "user_authorized",
      source_label: stringField(req.body.sourceLabel || "My authorized question", "sourceLabel", { max: 200 }),
    };

    const { data, error } = await supabase
      .from("question_bank")
      .insert(row)
      .select("id, subject, topic, exam_type, exam_year, difficulty, question, options, explanation, marking_points, source_type, source_label, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({ question: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Save question error:", error);
    res.status(500).json({ error: "Could not save the question" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    const topic = stringField(req.body.topic, "topic", { max: 200 });
    const examType = stringField(req.body.examType || "Practice", "examType", { max: 80 });
    const examYear = yearField(req.body.examYear);
    const difficulty = enumField(req.body.difficulty, "difficulty", difficulties, "medium");
    const count = integerField(req.body.count ?? 5, "count", { min: 1, max: 10 });

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `Create exactly ${count} new, original multiple-choice practice questions.\nSubject: ${subject}\nTopic: ${topic}\nStyle label: ${examType}\nDifficulty: ${difficulty}\nRules: do not copy, quote, reconstruct, or claim these are official past-paper questions. Use the style label only for the expected curriculum level and format. Give exactly four options, one zero-based correct option, a teaching explanation, and short marking points.`,
      response_format: { type: "text", mime_type: "application/json", schema: questionSchema },
    });

    const generated = JSON.parse(response.output_text);
    const questions = (generated.questions || []).slice(0, count).map(cleanGeneratedQuestion);
    if (questions.length !== count) {
      return res.status(422).json({ error: "The AI did not generate the requested number of valid questions" });
    }

    const rows = questions.map((question) => ({
      ...question,
      user_id: req.user.id,
      subject,
      topic,
      exam_type: examType,
      exam_year: examYear,
      difficulty,
      source_type: "ai_original",
      source_label: "AI-generated original practice question",
    }));

    const { data, error } = await supabase
      .from("question_bank")
      .insert(rows)
      .select("id, subject, topic, exam_type, exam_year, difficulty, question, options, explanation, marking_points, source_type, source_label, created_at");
    if (error) throw error;

    await recordAiUsage(req.user.id, "question_bank_generate");
    res.status(201).json({ questions: data });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Generate question bank error:", error);
    res.status(500).json({ error: "Could not generate practice questions" });
  }
});

router.post("/quiz", async (req, res) => {
  let createdQuizId = null;
  try {
    if (!Array.isArray(req.body.questionIds) || req.body.questionIds.length < 1 || req.body.questionIds.length > 10) {
      return res.status(400).json({ error: "questionIds must contain 1 to 10 question ids" });
    }
    const questionIds = [...new Set(req.body.questionIds.map((id) => uuidField(id, "questionId")))];

    const { data: bankQuestions, error: bankError } = await supabase
      .from("question_bank")
      .select("id, subject, topic, exam_type, exam_year, difficulty, question, options, correct_option, explanation")
      .eq("user_id", req.user.id)
      .in("id", questionIds);
    if (bankError) throw bankError;
    if (bankQuestions.length !== questionIds.length) {
      return res.status(404).json({ error: "One or more questions were not found" });
    }

    const first = bankQuestions[0];
    const durationMinutes = integerField(req.body.durationMinutes ?? Math.max(5, bankQuestions.length * 2), "durationMinutes", { min: 1, max: 180 });
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: req.user.id,
        subject: first.subject,
        topic: first.topic,
        difficulty: first.difficulty,
        mode: "question_bank",
        exam_type: first.exam_type,
        exam_year: first.exam_year,
        duration_minutes: durationMinutes,
      })
      .select("id, subject, topic, difficulty, mode, exam_type, exam_year, duration_minutes, created_at, started_at")
      .single();
    if (quizError) throw quizError;
    createdQuizId = quiz.id;

    const { data: savedQuestions, error: questionError } = await supabase
      .from("quiz_questions")
      .insert(bankQuestions.map((question) => ({
        quiz_id: quiz.id,
        topic: question.topic,
        difficulty: question.difficulty,
        question: question.question,
        options: question.options,
        correct_option: question.correct_option,
        explanation: question.explanation,
      })))
      .select("id, question, options, topic, difficulty, created_at");
    if (questionError) throw questionError;

    res.status(201).json({ quiz, questions: savedQuestions });
  } catch (error) {
    if (createdQuizId) await supabase.from("quizzes").delete().eq("id", createdQuizId);
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Question bank quiz error:", error);
    res.status(500).json({ error: "Could not start the question-bank quiz" });
  }
});

router.delete("/:questionId", async (req, res) => {
  try {
    const questionId = uuidField(req.params.questionId, "questionId");
    const { data, error } = await supabase
      .from("question_bank")
      .delete()
      .eq("id", questionId)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Question not found" });
    res.json({ message: "Question deleted" });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Delete question error:", error);
    res.status(500).json({ error: "Could not delete the question" });
  }
});

export default router;
