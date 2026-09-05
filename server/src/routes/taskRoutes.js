import express from "express";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { recordAiUsage } from "../middleware/aiUsage.js";
import {
  RequestValidationError,
  dateField,
  enumField,
  stringField,
  uuidField,
} from "../utils/validation.js";
import { paginationResult, parsePagination } from "../utils/pagination.js";

const router = express.Router();

const allowedPriorities = ["low", "medium", "high"];

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const studySessionSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    estimated_minutes: { type: "integer" },
    objective: { type: "string" },
    warm_up: { type: "string" },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          instruction: { type: "string" },
          minutes: { type: "integer" },
        },
        required: ["title", "instruction", "minutes"],
      },
    },
    self_check: { type: "string" },
    finish_line: { type: "string" },
  },
  required: [
    "title",
    "estimated_minutes",
    "objective",
    "warm_up",
    "steps",
    "self_check",
    "finish_line",
  ],
};

// Get only the logged-in student's tasks
router.get("/", async (req, res) => {
  try {
    const pagination = parsePagination(req.query, { defaultLimit: 50 });
    const { data, error, count } = await supabase
      .from("tasks")
      .select("*", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("completed", { ascending: true })
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      })
      .range(pagination.from, pagination.to);

    if (error) {
      throw error;
    }

    res.json({
      tasks: data,
      pagination: paginationResult({ ...pagination, count, returned: data.length }),
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Load tasks error:", error);

    res.status(500).json({
      error: "Could not load tasks",
    });
  }
});

// Create a task for the logged-in student
router.post("/", async (req, res) => {
  try {
    const title = stringField(req.body.title, "title", { max: 160 });
    const description = stringField(req.body.description, "description", {
      required: false,
      max: 2000,
    });
    const subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    const dueDate = dateField(req.body.dueDate, "dueDate");
    const priority = enumField(req.body.priority, "priority", allowedPriorities, "medium");

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: req.user.id,
        title,
        description,
        subject,
        due_date: dueDate,
        priority,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({
      task: data,
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Create task error:", error);

    res.status(500).json({
      error: "Could not create the task",
    });
  }
});

// Turn a saved task into a short AI-guided study session.
router.post("/:taskId/study-session", async (req, res) => {
  try {
    const taskId = uuidField(req.params.taskId, "taskId");
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description, subject, priority, due_date, completed")
      .eq("id", taskId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (taskError) throw taskError;

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.completed) {
      return res.status(400).json({
        error: "This task is already complete. Create a new revision task to study it again.",
      });
    }

    const prompt = `
You are creating one focused study session for a secondary-school student.

Subject: ${task.subject || "General"}
Task title: ${task.title}
Task details: ${task.description || "No extra details were provided."}
Priority: ${task.priority || "medium"}
Due date: ${task.due_date || "No deadline set"}

Rules:
- Keep the full session between 10 and 60 minutes.
- Use 2 to 5 clear steps with realistic time estimates.
- Teach or practise the actual topic; do not give generic motivation.
- Use simple language suitable for a secondary-school student.
- Include a quick warm-up recall activity and one self-check question.
- Do not reveal the answer to the self-check question.
- The finish line must say exactly what the student should do before marking the task complete.
`;

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: prompt,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: studySessionSchema,
      },
    });

    const generatedSession = JSON.parse(response.output_text);
    const session = {
      ...generatedSession,
      estimated_minutes: Math.min(
        Math.max(Number(generatedSession.estimated_minutes) || 25, 10),
        60,
      ),
      steps: generatedSession.steps.slice(0, 5).map((step) => ({
        title: String(step.title).slice(0, 100),
        instruction: String(step.instruction).slice(0, 500),
        minutes: Math.min(Math.max(Number(step.minutes) || 5, 1), 30),
      })),
    };

    if (session.steps.length < 2) {
      return res.status(422).json({
        error: "The AI could not create a complete study session. Please try again.",
      });
    }

    const { data: sessionRecord, error: sessionError } = await supabase
      .from("study_sessions")
      .insert({
        user_id: req.user.id,
        task_id: task.id,
        subject: task.subject || "General",
        topic: task.title,
        planned_minutes: session.estimated_minutes,
        plan: session,
      })
      .select("id, task_id, subject, topic, planned_minutes, completed, started_at")
      .single();

    if (sessionError) throw sessionError;

    await recordAiUsage(req.user.id, "task_study_session");
    res.json({ task, sessionId: sessionRecord.id, session });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Study session error:", error);
    res.status(500).json({ error: "Could not create a study session" });
  }
});

// Update only one of the logged-in student's tasks
router.patch("/:taskId", async (req, res) => {
  try {
    const taskId = uuidField(req.params.taskId, "taskId");
    const {
      title,
      description,
      subject,
      dueDate,
      priority,
      completed,
    } = req.body;

    if (
      completed !== undefined &&
      typeof completed !== "boolean"
    ) {
      return res.status(400).json({
        error: "Completed must be true or false",
      });
    }

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      updates.title = stringField(title, "title", { max: 160 });
    }

    if (description !== undefined) {
      updates.description = stringField(description, "description", {
        required: false,
        max: 2000,
      });
    }

    if (subject !== undefined) {
      updates.subject = stringField(subject, "subject", { max: 80 });
    }

    if (dueDate !== undefined) {
      updates.due_date = dateField(dueDate, "dueDate");
    }

    if (priority !== undefined) {
      updates.priority = enumField(priority, "priority", allowedPriorities);
    }

    if (completed !== undefined) {
      updates.completed = completed;
      updates.completed_at = completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json({
      task: data,
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Update task error:", error);

    res.status(500).json({
      error: "Could not update the task",
    });
  }
});

// Delete only one of the logged-in student's tasks
router.delete("/:taskId", async (req, res) => {
  try {
    const taskId = uuidField(req.params.taskId, "taskId");
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    res.json({
      message: "Task deleted",
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Delete task error:", error);

    res.status(500).json({
      error: "Could not delete the task",
    });
  }
});

export default router;
