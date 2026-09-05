import express from "express";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { recordAiUsage } from "../middleware/aiUsage.js";
import {
  RequestValidationError,
  dateField,
  enumField,
  integerField,
  stringField,
} from "../utils/validation.js";

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const studyPlanSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short study-task title",
          },
          description: {
            type: "string",
            description: "What the student should study",
          },
          due_date: {
            type: "string",
            description: "ISO 8601 date and time",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
        },
        required: [
          "title",
          "description",
          "due_date",
          "priority",
        ],
      },
    },
  },
  required: ["tasks"],
};

router.post("/generate", async (req, res) => {
  try {
    const subject = stringField(req.body.subject, "subject", { max: 80 });
    const topics = stringField(req.body.topics, "topics", { max: 4000 });
    const parsedExamDate = new Date(
      dateField(req.body.examDate, "examDate", { required: true }),
    );

    if (parsedExamDate <= new Date()) {
      return res.status(400).json({
        error: "The exam date must be in the future",
      });
    }

    const safeAvailableDays = integerField(
      req.body.availableDays ?? 7,
      "availableDays",
      { min: 1, max: 14 },
    );

    const prompt = `
Create a realistic study plan for a secondary-school student.

Subject: ${subject}
Topics: ${topics}
Exam date: ${parsedExamDate.toISOString()}
Maximum number of study days: ${safeAvailableDays}
Current date: ${new Date().toISOString()}

Rules:
- Create between 1 and ${safeAvailableDays} tasks.
- Schedule every task before the exam.
- Begin with foundational topics.
- Move gradually toward practice and revision.
- Keep every session manageable for a student.
- Use high priority for difficult or final revision tasks.
- Use ISO 8601 dates and times.
`;

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: studyPlanSchema,
      },
    });

    const generatedPlan = JSON.parse(response.output_text);
    const generatedTasks = Array.isArray(generatedPlan.tasks)
      ? generatedPlan.tasks
      : [];

    const tasks = generatedTasks
      .slice(0, safeAvailableDays)
      .flatMap((task) => {
        try {
          const dueDate = dateField(task?.due_date, "generated due date", { required: true });
          const taskDate = new Date(dueDate);
          if (taskDate <= new Date() || taskDate >= parsedExamDate) return [];

          return [{
            user_id: req.user.id,
            title: stringField(task?.title, "generated title", { max: 160 }),
            description: stringField(task?.description, "generated description", { max: 2000 }),
            subject,
            due_date: dueDate,
            priority: enumField(task?.priority, "generated priority", ["low", "medium", "high"]),
          }];
        } catch {
          return [];
        }
      });

    if (tasks.length === 0) {
      return res.status(422).json({
        error: "The AI did not produce a valid study plan",
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert(tasks)
      .select();

    if (error) {
      throw error;
    }

    await recordAiUsage(req.user.id, "study_plan");

    res.status(201).json({
      message: "Study plan created",
      tasks: data,
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Study plan error:", error);

    res.status(500).json({
      error: "Could not generate the study plan",
    });
  }
});

export default router;
