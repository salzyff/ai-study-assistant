import express from "express";
import { supabase } from "../supabase.js";

const router = express.Router();

const allowedPriorities = ["low", "medium", "high"];

// Get only the logged-in student's tasks
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", req.user.id)
      .order("completed", { ascending: true })
      .order("due_date", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      throw error;
    }

    res.json({
      tasks: data,
    });
  } catch (error) {
    console.error("Load tasks error:", error);

    res.status(500).json({
      error: "Could not load tasks",
    });
  }
});

// Create a task for the logged-in student
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description = null,
      subject = "General",
      dueDate = null,
      priority = "medium",
    } = req.body;

    if (
      !title ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        error: "A task title is required",
      });
    }

    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({
        error: "Priority must be low, medium, or high",
      });
    }

    if (dueDate && Number.isNaN(Date.parse(dueDate))) {
      return res.status(400).json({
        error: "The due date is invalid",
      });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: req.user.id,
        title: title.trim(),
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
    console.error("Create task error:", error);

    res.status(500).json({
      error: "Could not create the task",
    });
  }
});

// Update only one of the logged-in student's tasks
router.patch("/:taskId", async (req, res) => {
  try {
    const {
      title,
      description,
      subject,
      dueDate,
      priority,
      completed,
    } = req.body;

    if (
      title !== undefined &&
      (typeof title !== "string" || !title.trim())
    ) {
      return res.status(400).json({
        error: "The task title cannot be empty",
      });
    }

    if (
      priority !== undefined &&
      !allowedPriorities.includes(priority)
    ) {
      return res.status(400).json({
        error: "Priority must be low, medium, or high",
      });
    }

    if (
      dueDate !== undefined &&
      dueDate !== null &&
      Number.isNaN(Date.parse(dueDate))
    ) {
      return res.status(400).json({
        error: "The due date is invalid",
      });
    }

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
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (subject !== undefined) {
      updates.subject = subject;
    }

    if (dueDate !== undefined) {
      updates.due_date = dueDate;
    }

    if (priority !== undefined) {
      updates.priority = priority;
    }

    if (completed !== undefined) {
      updates.completed = completed;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", req.params.taskId)
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
    console.error("Update task error:", error);

    res.status(500).json({
      error: "Could not update the task",
    });
  }
});

// Delete only one of the logged-in student's tasks
router.delete("/:taskId", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", req.params.taskId)
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
    console.error("Delete task error:", error);

    res.status(500).json({
      error: "Could not delete the task",
    });
  }
});

export default router;