import express from "express";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { recordAiUsage } from "../middleware/aiUsage.js";

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
    const {
      subject,
      topics,
      examDate,
      availableDays = 7,
    } = req.body;

    if (!subject || typeof subject !== "string") {
      return res.status(400).json({
        error: "A subject is required",
      });
    }


    if (subject.trim().length > 80) {
      return res.status(400).json({
        error: "The subject must be 80 characters or fewer",
      });
    }

    if (!topics || typeof topics !== "string") {
      return res.status(400).json({
        error: "Study topics are required",
      });
    }


    if (!topics.trim() || topics.trim().length > 4000) {
      return res.status(400).json({
        error: "Study topics must be between 1 and 4000 characters",
      });
    }

    if (!examDate || Number.isNaN(Date.parse(examDate))) {
      return res.status(400).json({
        error: "A valid exam date is required",
      });
    }

    const parsedExamDate = new Date(examDate);

    if (parsedExamDate <= new Date()) {
      return res.status(400).json({
        error: "The exam date must be in the future",
      });
    }

    const safeAvailableDays = Math.min(
      Math.max(Number(availableDays) || 7, 1),
      14
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

    const tasks = generatedPlan.tasks
      .slice(0, safeAvailableDays)
      .filter((task) => {
        const taskDate = new Date(task.due_date);

        return (
          !Number.isNaN(taskDate.getTime()) &&
          taskDate > new Date() &&
          taskDate < parsedExamDate
        );
      })
      .map((task) => ({
        user_id: req.user.id,
        title: task.title,
        description: task.description,
        subject,
        due_date: new Date(task.due_date).toISOString(),
        priority: task.priority,
      }));

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
    console.error("Study plan error:", error);

    res.status(500).json({
      error: "Could not generate the study plan",
    });
  }
});

export default router;
