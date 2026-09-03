import "dotenv/config";
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { dailyAiLimit, recordAiUsage } from "../middleware/aiUsage.js";
import { stringField, uuidField, validateBody } from "../utils/validation.js";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const maxUploadMb = Math.min(Math.max(Number(process.env.MAX_UPLOAD_MB) || 5, 1), 10);
const allowedMimeTypes = new Set(["application/pdf", "text/plain", "text/markdown"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: maxUploadMb * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      const error = new Error("Only PDF, TXT, and Markdown notes are accepted");
      error.statusCode = 415;
      return callback(error);
    }

    callback(null, true);
  },
});

function cleanExtractedText(text) {
  return String(text || "")
    .replaceAll("\u0000", "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 100_000);
}

async function extractText(file) {
  if (file.mimetype !== "application/pdf") {
    return cleanExtractedText(file.buffer.toString("utf8"));
  }

  const parser = new PDFParse({ data: file.buffer });

  try {
    const result = await parser.getText();
    return cleanExtractedText(result.text);
  } finally {
    await parser.destroy();
  }
}

async function getOwnedNote(noteId, userId) {
  const { data, error } = await supabase
    .from("study_notes")
    .select("id, title, subject, original_filename, mime_type, text_content, char_count, created_at")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("study_notes")
      .select("id, title, subject, original_filename, mime_type, char_count, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ notes: data });
  } catch (error) {
    console.error("Load notes error:", error);
    res.status(500).json({ error: "Could not load notes" });
  }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A PDF, TXT, or Markdown file is required" });
    }

    const subject = stringField(req.body.subject || "General", "subject", { max: 80 });
    const title = stringField(req.body.title || req.file.originalname, "title", { max: 120 });
    const textContent = await extractText(req.file);

    if (textContent.length < 20) {
      return res.status(422).json({
        error: "No readable text was found in that file. Scanned image-only PDFs are not supported yet.",
      });
    }

    const { data, error } = await supabase
      .from("study_notes")
      .insert({
        user_id: req.user.id,
        title,
        subject,
        original_filename: req.file.originalname.slice(0, 255),
        mime_type: req.file.mimetype,
        text_content: textContent,
        char_count: textContent.length,
      })
      .select("id, title, subject, original_filename, mime_type, char_count, created_at")
      .single();

    if (error) throw error;
    res.status(201).json({ message: "Notes uploaded and processed", note: data });
  } catch (error) {
    console.error("Upload notes error:", error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Could not process notes" });
  }
});

router.get("/:noteId", async (req, res) => {
  try {
    const noteId = uuidField(req.params.noteId, "noteId");
    const note = await getOwnedNote(noteId, req.user.id);
    if (!note) return res.status(404).json({ error: "Notes not found" });
    res.json({ note });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    console.error("Load note error:", error);
    res.status(500).json({ error: "Could not load notes" });
  }
});

router.post(
  "/:noteId/ask",
  dailyAiLimit,
  validateBody((body) => ({ question: stringField(body.question, "question", { min: 3, max: 1000 }) })),
  async (req, res) => {
    try {
      const noteId = uuidField(req.params.noteId, "noteId");
      const note = await getOwnedNote(noteId, req.user.id);
      if (!note) return res.status(404).json({ error: "Notes not found" });

      const response = await ai.interactions.create({
        model: "gemini-3.1-flash-lite",
        input: `You are a study assistant. Answer using the student's notes below. If the notes do not contain the answer, say that clearly. Use simple secondary-school language.\n\nNOTES:\n${note.text_content.slice(0, 40_000)}\n\nQUESTION:\n${req.validatedBody.question}`,
      });

      await recordAiUsage(req.user.id, "notes_question");
      res.json({ noteId: note.id, answer: response.output_text });
    } catch (error) {
      console.error("Ask notes error:", error);
      res.status(500).json({ error: "Could not answer from these notes" });
    }
  },
);

router.post("/:noteId/summarize", dailyAiLimit, async (req, res) => {
  try {
    const noteId = uuidField(req.params.noteId, "noteId");
    const note = await getOwnedNote(noteId, req.user.id);
    if (!note) return res.status(404).json({ error: "Notes not found" });

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `Summarize these ${note.subject} notes for a secondary-school student. Organize the answer into key ideas, important terms, and what to revise. Do not add facts that are not supported by the notes.\n\n${note.text_content.slice(0, 40_000)}`,
    });

    await recordAiUsage(req.user.id, "notes_summary");
    res.json({ noteId: note.id, summary: response.output_text });
  } catch (error) {
    console.error("Summarize notes error:", error);
    res.status(500).json({ error: "Could not summarize these notes" });
  }
});

router.delete("/:noteId", async (req, res) => {
  try {
    const noteId = uuidField(req.params.noteId, "noteId");
    const { data, error } = await supabase
      .from("study_notes")
      .delete()
      .eq("id", noteId)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Notes not found" });
    res.json({ message: "Notes deleted" });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    console.error("Delete notes error:", error);
    res.status(500).json({ error: "Could not delete notes" });
  }
});

export default router;
