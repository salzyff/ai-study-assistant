import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "../supabase.js";
import { dailyAiLimit, recordAiUsage } from "../middleware/aiUsage.js";
import { nextFlashcardSchedule } from "../utils/learning.js";
import {
  RequestValidationError,
  enumField,
  integerField,
  stringField,
  uuidField,
  validateBody,
} from "../utils/validation.js";

const router = express.Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const flashcardSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      minItems: 5,
      maxItems: 20,
      items: {
        type: "object",
        properties: {
          front: { type: "string" },
          back: { type: "string" },
          hint: { type: "string" },
        },
        required: ["front", "back", "hint"],
      },
    },
  },
  required: ["cards"],
};

const generateValidator = validateBody((body) => ({
  subject: stringField(body.subject || "General", "subject", { max: 80 }),
  topic: stringField(body.topic, "topic", { required: false, max: 200 }),
  noteId: uuidField(body.noteId, "noteId", { required: false }),
  count: integerField(body.count ?? 10, "count", { min: 5, max: 20 }),
}));

router.post("/generate", dailyAiLimit, generateValidator, async (req, res) => {
  let createdSetId = null;

  try {
    const { subject, topic, noteId, count } = req.validatedBody;
    let sourceText = "";
    let finalSubject = subject;
    let finalTopic = topic;

    if (noteId) {
      const { data: note, error: noteError } = await supabase
        .from("study_notes")
        .select("id, title, subject, text_content")
        .eq("id", noteId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (noteError) throw noteError;
      if (!note) return res.status(404).json({ error: "Notes not found" });

      finalSubject = note.subject;
      finalTopic = topic || note.title;
      sourceText = `Use only these student notes as the main source:\n${note.text_content.slice(0, 40_000)}`;
    }

    if (!finalTopic) {
      throw new RequestValidationError("topic is required when noteId is not provided");
    }

    const response = await ai.interactions.create({
      model: "gemini-3.1-flash-lite",
      input: `Create exactly ${count} flashcards for a secondary-school student.\nSubject: ${finalSubject}\nTopic: ${finalTopic}\n${sourceText}\nRules: each front must contain one clear question or term; each back must be concise and correct; each hint should help without revealing the answer; avoid duplicates.`,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: flashcardSchema,
      },
    });

    const generated = JSON.parse(response.output_text);
    const cards = generated.cards
      .slice(0, count)
      .filter((card) => card.front && card.back && card.hint)
      .map((card) => ({
        front: String(card.front).slice(0, 500),
        back: String(card.back).slice(0, 1000),
        hint: String(card.hint).slice(0, 500),
      }));

    if (cards.length < 5) {
      return res.status(422).json({ error: "The AI did not create enough valid flashcards" });
    }

    const { data: set, error: setError } = await supabase
      .from("flashcard_sets")
      .insert({
        user_id: req.user.id,
        source_note_id: noteId,
        subject: finalSubject,
        topic: finalTopic,
      })
      .select("id, subject, topic, source_note_id, created_at")
      .single();

    if (setError) throw setError;
    createdSetId = set.id;

    const { data: savedCards, error: cardsError } = await supabase
      .from("flashcards")
      .insert(cards.map((card, position) => ({ ...card, set_id: set.id, position })))
      .select("id, front, back, hint, position");

    if (cardsError) throw cardsError;

    await recordAiUsage(req.user.id, "flashcards");
    res.status(201).json({ set, cards: savedCards });
  } catch (error) {
    if (createdSetId) await supabase.from("flashcard_sets").delete().eq("id", createdSetId);
    if (error instanceof RequestValidationError) return res.status(400).json({ error: error.message });
    console.error("Generate flashcards error:", error);
    res.status(500).json({ error: "Could not generate flashcards" });
  }
});

router.get("/sets", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("flashcard_sets")
      .select("id, subject, topic, source_note_id, created_at, flashcards(count)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ sets: data });
  } catch (error) {
    console.error("Load flashcard sets error:", error);
    res.status(500).json({ error: "Could not load flashcard sets" });
  }
});

router.get("/due", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const { data: sets, error: setsError } = await supabase
      .from("flashcard_sets")
      .select("id, subject, topic")
      .eq("user_id", req.user.id);

    if (setsError) throw setsError;
    if (!sets?.length) return res.json({ cards: [] });

    const { data: cards, error: cardsError } = await supabase
      .from("flashcards")
      .select("id, set_id, front, back, hint, position, next_review_at, interval_days, review_count")
      .in("set_id", sets.map((set) => set.id))
      .lte("next_review_at", new Date().toISOString())
      .order("next_review_at", { ascending: true })
      .limit(limit);

    if (cardsError) throw cardsError;
    const setMap = new Map(sets.map((set) => [set.id, set]));
    res.json({
      cards: (cards || []).map((card) => ({ ...card, set: setMap.get(card.set_id) })),
    });
  } catch (error) {
    console.error("Load due flashcards error:", error);
    res.status(500).json({ error: "Could not load due flashcards" });
  }
});

router.get("/sets/:setId", async (req, res) => {
  try {
    const setId = uuidField(req.params.setId, "setId");
    const { data: set, error: setError } = await supabase
      .from("flashcard_sets")
      .select("id, subject, topic, source_note_id, created_at")
      .eq("id", setId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (setError) throw setError;
    if (!set) return res.status(404).json({ error: "Flashcard set not found" });

    const { data: cards, error: cardsError } = await supabase
      .from("flashcards")
      .select("id, front, back, hint, position, next_review_at, interval_days, review_count")
      .eq("set_id", set.id)
      .order("position", { ascending: true });

    if (cardsError) throw cardsError;
    res.json({ set, cards });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    console.error("Load flashcard set error:", error);
    res.status(500).json({ error: "Could not load flashcards" });
  }
});

router.post(
  "/sets/:setId/review",
  validateBody((body) => ({
    cardId: uuidField(body.cardId, "cardId"),
    rating: enumField(body.rating, "rating", ["again", "hard", "good", "easy"]),
  })),
  async (req, res) => {
    try {
      const setId = uuidField(req.params.setId, "setId");
      const { data: set, error: setError } = await supabase
        .from("flashcard_sets")
        .select("id")
        .eq("id", setId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (setError) throw setError;
      if (!set) return res.status(404).json({ error: "Flashcard set not found" });

      const { data: card, error: cardError } = await supabase
        .from("flashcards")
        .select("id, interval_days, review_count")
        .eq("id", req.validatedBody.cardId)
        .eq("set_id", set.id)
        .maybeSingle();

      if (cardError) throw cardError;
      if (!card) return res.status(404).json({ error: "Flashcard not found in this set" });

      const { data: review, error: reviewError } = await supabase
        .from("flashcard_reviews")
        .insert({ user_id: req.user.id, card_id: card.id, rating: req.validatedBody.rating })
        .select("id, card_id, rating, created_at")
        .single();

      if (reviewError) throw reviewError;

      const schedule = nextFlashcardSchedule({
        rating: req.validatedBody.rating,
        intervalDays: card.interval_days,
        reviewCount: card.review_count,
      });
      const { error: scheduleError } = await supabase
        .from("flashcards")
        .update({
          interval_days: schedule.intervalDays,
          review_count: schedule.reviewCount,
          next_review_at: schedule.nextReviewAt,
        })
        .eq("id", card.id)
        .eq("set_id", set.id);

      if (scheduleError) throw scheduleError;
      res.status(201).json({ review, schedule });
    } catch (error) {
      if (error.statusCode === 400) return res.status(400).json({ error: error.message });
      console.error("Review flashcard error:", error);
      res.status(500).json({ error: "Could not save flashcard review" });
    }
  },
);

router.delete("/sets/:setId", async (req, res) => {
  try {
    const setId = uuidField(req.params.setId, "setId");
    const { data, error } = await supabase
      .from("flashcard_sets")
      .delete()
      .eq("id", setId)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Flashcard set not found" });
    res.json({ message: "Flashcard set deleted" });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    console.error("Delete flashcard set error:", error);
    res.status(500).json({ error: "Could not delete flashcard set" });
  }
});

export default router;
