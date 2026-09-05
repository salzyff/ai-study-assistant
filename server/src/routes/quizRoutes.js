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
import { difficultyFromMastery, nextAdaptiveDifficulty } from "../utils/learning.js";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const quizSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", minItems: 4, maxItems: 4, items: { type: "string" } },
          correct_option: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
        },
        required: ["question", "options", "correct_option", "explanation"],
      },
    },
  },
  required: ["questions"],
};

async function adaptiveDifficulty(userId, subject, topic) {
  const { data, error } = await supabase
    .from("topic_mastery")
    .select("mastery_score")
    .eq("user_id", userId)
    .eq("subject", subject)
    .eq("topic", topic)
    .maybeSingle();

  if (error) throw error;
  return difficultyFromMastery(data?.mastery_score || 0);
}

function validateGeneratedQuestions(questions, count) {
  return (questions || [])
    .slice(0, count)
    .filter((question) =>
      typeof question.question === "string" &&
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      question.options.every((option) => typeof option === "string") &&
      Number.isInteger(question.correct_option) &&
      question.correct_option >= 0 &&
      question.correct_option <= 3 &&
      typeof question.explanation === "string",
    )
    .map((question) => ({
      question: question.question.slice(0, 1000),
      options: question.options.map((option) => option.slice(0, 500)),
      correct_option: question.correct_option,
      explanation: question.explanation.slice(0, 2000),
    }));
}

async function recordQuizLearning({ userId, quiz, questions, results, score }) {
  const now = new Date().toISOString();
  const wrongResults = results.filter((result) => !result.isCorrect);
  const correctIds = results.filter((result) => result.isCorrect).map((result) => result.questionId);

  if (correctIds.length > 0) {
    const { error } = await supabase
      .from("mistake_notebook")
      .update({ resolved: true })
      .eq("user_id", userId)
      .in("question_id", correctIds);
    if (error) throw error;
  }

  if (wrongResults.length > 0) {
    const wrongIds = wrongResults.map((result) => result.questionId);
    const { data: existing, error: existingError } = await supabase
      .from("mistake_notebook")
      .select("question_id, times_missed")
      .eq("user_id", userId)
      .in("question_id", wrongIds);
    if (existingError) throw existingError;

    const previousCounts = new Map((existing || []).map((item) => [item.question_id, item.times_missed]));
    const rows = wrongResults.map((result) => ({
      user_id: userId,
      quiz_id: quiz.id,
      question_id: result.questionId,
      subject: quiz.subject,
      topic: quiz.topic,
      question: result.question,
      options: result.options,
      selected_option: result.selectedOption,
      correct_option: result.correctOption,
      explanation: result.explanation,
      times_missed: Number(previousCounts.get(result.questionId) || 0) + 1,
      resolved: false,
      last_missed_at: now,
    }));

    const { error } = await supabase
      .from("mistake_notebook")
      .upsert(rows, { onConflict: "user_id,question_id" });
    if (error) throw error;
  }

  const { data: current, error: masteryError } = await supabase
    .from("topic_mastery")
    .select("correct_count, attempt_count")
    .eq("user_id", userId)
    .eq("subject", quiz.subject)
    .eq("topic", quiz.topic)
    .maybeSingle();
  if (masteryError) throw masteryError;

  const correctCount = Number(current?.correct_count || 0) + score;
  const attemptCount = Number(current?.attempt_count || 0) + questions.length;
  const masteryScore = attemptCount ? Math.round((correctCount / attemptCount) * 100) : 0;

  const { data: mastery, error: upsertError } = await supabase
    .from("topic_mastery")
    .upsert({
      user_id: userId,
      subject: quiz.subject,
      topic: quiz.topic,
      correct_count: correctCount,
      attempt_count: attemptCount,
      mastery_score: masteryScore,
      last_practiced_at: now,
    }, { onConflict: "user_id,subject,topic" })
    .select("subject, topic, correct_count, attempt_count, mastery_score, last_practiced_at")
    .single();
  if (upsertError) throw upsertError;

  return { mistakesSaved: wrongResults.length, mastery };
}

router.post("/generate", async (req, res) => {
  let createdQuizId = null;

  try {
    const noteId = uuidField(req.body.noteId, "noteId", { required: false });
    let subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    let topic = stringField(req.body.topic, "topic", { required: false, max: 200 });
    let mode = enumField(req.body.mode, "mode", ["practice", "adaptive", "exam", "notes"], "practice");
    let difficulty = enumField(req.body.difficulty, "difficulty", ["easy", "medium", "hard"], "medium");
    const questionCount = integerField(req.body.numberOfQuestions ?? 5, "numberOfQuestions", { min: 3, max: 10 });
    const durationMinutes = mode === "exam"
      ? integerField(req.body.durationMinutes ?? 10, "durationMinutes", { min: 1, max: 180 })
      : null;
    let sourceText = "";

    if (noteId) {
      const { data: note, error } = await supabase
        .from("study_notes")
        .select("id, title, subject, text_content")
        .eq("id", noteId)
        .eq("user_id", req.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!note) return res.status(404).json({ error: "Notes not found" });
      subject = note.subject;
      topic = topic || note.title;
      mode = "notes";
      sourceText = `Use only the following student notes as the factual source. Do not add unsupported facts:\n${note.text_content.slice(0, 40_000)}`;
    }

    if (!topic) throw new RequestValidationError("topic is required");
    if (mode === "adaptive") difficulty = await adaptiveDifficulty(req.user.id, subject, topic);

    const modeInstructions = {
      practice: "Create clear practice questions with explanations.",
      adaptive: `Match every question to ${difficulty} difficulty so the student is challenged without being overwhelmed.`,
      exam: "Create original exam-style questions. Do not copy or claim to reproduce an official past paper. Do not provide hints before submission.",
      notes: "Test only ideas supported by the supplied notes.",
    };

    const aiResponse = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `Create exactly ${questionCount} multiple-choice questions for a secondary-school student.\nSubject: ${subject}\nTopic: ${topic}\nDifficulty: ${difficulty}\nMode: ${mode}\n${modeInstructions[mode]}\n${sourceText}\nRules: exactly four options per question; one correct option; correct_option is a zero-based index from 0 to 3; include a short teaching explanation; avoid ambiguity and trick questions.`,
      response_format: { type: "text", mime_type: "application/json", schema: quizSchema },
    });

    const generated = JSON.parse(aiResponse.output_text);
    const validQuestions = validateGeneratedQuestions(generated.questions, questionCount);
    if (validQuestions.length !== questionCount) {
      return res.status(422).json({ error: "The AI did not produce a complete valid quiz" });
    }

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: req.user.id,
        subject,
        topic,
        difficulty,
        mode,
        source_note_id: noteId,
        duration_minutes: durationMinutes,
      })
      .select("id, subject, topic, difficulty, mode, source_note_id, duration_minutes, created_at, started_at")
      .single();
    if (quizError) throw quizError;
    createdQuizId = quiz.id;

    const { data: savedQuestions, error: questionError } = await supabase
      .from("quiz_questions")
      .insert(validQuestions.map((question) => ({
        ...question,
        quiz_id: quiz.id,
        topic,
        difficulty,
      })))
      .select("id, question, options, topic, difficulty, created_at");
    if (questionError) throw questionError;

    await recordAiUsage(req.user.id, `quiz_${mode}`);
    res.status(201).json({ quiz, questions: savedQuestions });
  } catch (error) {
    if (createdQuizId) await supabase.from("quizzes").delete().eq("id", createdQuizId);
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Generate quiz error:", error);
    res.status(500).json({ error: "Could not generate the quiz" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const { data, error } = await supabase
      .from("quiz_attempts")
      .select("id, score, total, mode, duration_seconds, created_at, quizzes(id, subject, topic, difficulty, mode, duration_minutes)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ attempts: data });
  } catch (error) {
    console.error("Quiz history error:", error);
    res.status(500).json({ error: "Could not load quiz history" });
  }
});

router.post("/:quizId/submit", async (req, res) => {
  try {
    const quizId = uuidField(req.params.quizId, "quizId");
    const answers = req.body.answers;
    const durationSeconds = integerField(req.body.durationSeconds, "durationSeconds", { required: false, min: 0, max: 86_400 });

    if (!Array.isArray(answers) || answers.length > 10) {
      return res.status(400).json({ error: "Quiz answers must be an array containing at most 10 answers" });
    }

    const normalizedAnswers = answers.map((answer) => {
      if (!answer || typeof answer.questionId !== "string") {
        throw new RequestValidationError("Every answer must contain a questionId");
      }
      const selectedOption = answer.selectedOption === null || answer.selectedOption === undefined
        ? null
        : integerField(answer.selectedOption, "selectedOption", { min: 0, max: 3 });
      return { questionId: uuidField(answer.questionId, "questionId"), selectedOption };
    });

    if (new Set(normalizedAnswers.map((answer) => answer.questionId)).size !== normalizedAnswers.length) {
      return res.status(400).json({ error: "Each quiz question can only be answered once" });
    }

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, subject, topic, difficulty, mode, duration_minutes")
      .eq("id", quizId)
      .eq("user_id", req.user.id)
      .maybeSingle();
    if (quizError) throw quizError;
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    const { data: previousAttempt, error: previousAttemptError } = await supabase
      .from("quiz_attempts")
      .select("id")
      .eq("quiz_id", quiz.id)
      .eq("user_id", req.user.id)
      .limit(1)
      .maybeSingle();
    if (previousAttemptError) throw previousAttemptError;
    if (previousAttempt) {
      return res.status(409).json({ error: "This quiz has already been submitted" });
    }

    const { data: questions, error: questionError } = await supabase
      .from("quiz_questions")
      .select("id, question, options, correct_option, explanation, topic, difficulty")
      .eq("quiz_id", quiz.id)
      .order("created_at", { ascending: true });
    if (questionError) throw questionError;

    const questionIds = new Set(questions.map((question) => question.id));
    if (normalizedAnswers.some((answer) => !questionIds.has(answer.questionId))) {
      return res.status(400).json({ error: "One or more answers do not belong to this quiz" });
    }

    const submitted = new Map(normalizedAnswers.map((answer) => [answer.questionId, answer.selectedOption]));
    let score = 0;
    const results = questions.map((question) => {
      const selectedOption = submitted.has(question.id) ? submitted.get(question.id) : null;
      const isCorrect = selectedOption === question.correct_option;
      if (isCorrect) score += 1;
      return {
        questionId: question.id,
        question: question.question,
        options: question.options,
        selectedOption,
        correctOption: question.correct_option,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const { data: attempt, error: attemptError } = await supabase
      .from("quiz_attempts")
      .insert({
        quiz_id: quiz.id,
        user_id: req.user.id,
        answers: results.map((result) => ({ questionId: result.questionId, selectedOption: result.selectedOption })),
        score,
        total: questions.length,
        mode: quiz.mode,
        duration_seconds: durationSeconds,
      })
      .select("id, score, total, mode, duration_seconds, created_at")
      .single();
    if (attemptError) throw attemptError;

    let learning = { mistakesSaved: 0, mastery: null };
    try {
      learning = await recordQuizLearning({ userId: req.user.id, quiz, questions, results, score });
    } catch (learningError) {
      // The quiz attempt is already saved, so return its result even if the
      // optional mastery/mistake tracking update fails.
      console.error("Quiz learning update error:", learningError);
    }
    const percentage = questions.length ? Math.round((score / questions.length) * 100) : 0;

    res.json({
      quiz,
      attempt,
      score,
      total: questions.length,
      percentage,
      results,
      mistakesSaved: learning.mistakesSaved,
      mastery: learning.mastery,
      nextDifficulty: nextAdaptiveDifficulty(percentage),
    });
  } catch (error) {
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Submit quiz error:", error);
    res.status(500).json({ error: "Could not mark the quiz" });
  }
});

export default router;
