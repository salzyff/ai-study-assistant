import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
          question: {
            type: "string",
          },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "string",
            },
          },
          correct_option: {
            type: "integer",
            minimum: 0,
            maximum: 3,
          },
          explanation: {
            type: "string",
          },
        },
        required: [
          "question",
          "options",
          "correct_option",
          "explanation",
        ],
      },
    },
  },
  required: ["questions"],
};

// Generate and save a multiple-choice quiz
router.post("/generate", async (req, res) => {
  let createdQuizId = null;

  try {
    const {
      subject,
      topic,
      numberOfQuestions = 5,
    } = req.body;

    if (!subject || typeof subject !== "string") {
      return res.status(400).json({
        error: "A subject is required",
      });
    }

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({
        error: "A quiz topic is required",
      });
    }

    const questionCount = Math.min(
      Math.max(Number(numberOfQuestions) || 5, 3),
      10
    );

    const prompt = `
Create a multiple-choice quiz for a secondary-school student.

Subject: ${subject}
Topic: ${topic.trim()}
Number of questions: ${questionCount}

Rules:
- Generate exactly ${questionCount} questions.
- Every question must have exactly four options.
- Only one option can be correct.
- correct_option must be the zero-based index of the correct option.
- Index 0 means the first option.
- Index 3 means the fourth option.
- Include a short explanation for the correct answer.
- Use clear language appropriate for a secondary-school student.
- Avoid trick questions and ambiguous answers.
`;

    const aiResponse = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: quizSchema,
      },
    });

    const generatedQuiz = JSON.parse(aiResponse.output_text);

    const validQuestions = generatedQuiz.questions
      .slice(0, questionCount)
      .filter(
        (question) =>
          typeof question.question === "string" &&
          Array.isArray(question.options) &&
          question.options.length === 4 &&
          Number.isInteger(question.correct_option) &&
          question.correct_option >= 0 &&
          question.correct_option <= 3 &&
          typeof question.explanation === "string"
      );

    if (validQuestions.length === 0) {
      return res.status(422).json({
        error: "The AI did not produce a valid quiz",
      });
    }

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        user_id: req.user.id,
        subject,
        topic: topic.trim(),
      })
      .select("id, subject, topic, created_at")
      .single();

    if (quizError) {
      throw quizError;
    }

    createdQuizId = quiz.id;

    const questionRows = validQuestions.map((question) => ({
      quiz_id: quiz.id,
      question: question.question,
      options: question.options,
      correct_option: question.correct_option,
      explanation: question.explanation,
    }));

    const { data: savedQuestions, error: questionsError } =
      await supabase
        .from("quiz_questions")
        .insert(questionRows)
        .select("id, question, options");

    if (questionsError) {
      throw questionsError;
    }

    // Correct answers are intentionally not sent here.
    res.status(201).json({
      quiz,
      questions: savedQuestions,
    });
  } catch (error) {
    console.error("Generate quiz error:", error);

    if (createdQuizId) {
      await supabase
        .from("quizzes")
        .delete()
        .eq("id", createdQuizId);
    }

    res.status(500).json({
      error: "Could not generate the quiz",
    });
  }
});
// Submit and mark a completed quiz
router.post("/:quizId/submit", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: "Quiz answers must be provided",
      });
    }

    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, subject, topic")
      .eq("id", req.params.quizId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (quizError) {
      throw quizError;
    }

    if (!quiz) {
      return res.status(404).json({
        error: "Quiz not found",
      });
    }

    const { data: questions, error: questionsError } =
      await supabase
        .from("quiz_questions")
        .select(
          "id, question, options, correct_option, explanation"
        )
        .eq("quiz_id", quiz.id)
        .order("created_at", { ascending: true });

    if (questionsError) {
      throw questionsError;
    }

    const submittedAnswers = new Map(
      answers.map((answer) => [
        answer.questionId,
        answer.selectedOption,
      ])
    );

    let score = 0;

    const results = questions.map((question) => {
      const selectedOption =
        submittedAnswers.get(question.id) ?? null;

      const isCorrect =
        selectedOption === question.correct_option;

      if (isCorrect) {
        score += 1;
      }

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

    const savedAnswers = results.map((result) => ({
      questionId: result.questionId,
      selectedOption: result.selectedOption,
    }));

    const { data: attempt, error: attemptError } =
      await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quiz.id,
          user_id: req.user.id,
          answers: savedAnswers,
          score,
          total: questions.length,
        })
        .select("id, score, total, created_at")
        .single();

    if (attemptError) {
      throw attemptError;
    }

    res.json({
      quiz,
      attempt,
      score,
      total: questions.length,
      percentage:
        questions.length > 0
          ? Math.round((score / questions.length) * 100)
          : 0,
      results,
    });
  } catch (error) {
    console.error("Submit quiz error:", error);

    res.status(500).json({
      error: "Could not mark the quiz",
    });
  }
});

export default router;