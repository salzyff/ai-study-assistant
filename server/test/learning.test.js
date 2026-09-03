import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGoalProgress,
  difficultyFromMastery,
  nextAdaptiveDifficulty,
  nextFlashcardSchedule,
} from "../src/utils/learning.js";

test("difficultyFromMastery selects an appropriate level", () => {
  assert.equal(difficultyFromMastery(20), "easy");
  assert.equal(difficultyFromMastery(60), "medium");
  assert.equal(difficultyFromMastery(90), "hard");
});

test("nextAdaptiveDifficulty responds to the latest score", () => {
  assert.equal(nextAdaptiveDifficulty(30), "easy");
  assert.equal(nextAdaptiveDifficulty(65), "medium");
  assert.equal(nextAdaptiveDifficulty(85), "hard");
});

test("nextFlashcardSchedule delays remembered cards", () => {
  const now = new Date("2026-09-03T00:00:00.000Z");
  const schedule = nextFlashcardSchedule({ rating: "good", reviewCount: 0 }, now);
  assert.equal(schedule.intervalDays, 2);
  assert.equal(schedule.reviewCount, 1);
  assert.equal(schedule.nextReviewAt, "2026-09-05T00:00:00.000Z");
});

test("calculateGoalProgress totals completed study minutes", () => {
  const goal = {
    subject: "Biology",
    target_type: "study_minutes",
    period_start: "2026-09-01T00:00:00.000Z",
    period_end: "2026-09-08T00:00:00.000Z",
  };
  const value = calculateGoalProgress(goal, {
    sessions: [
      { subject: "Biology", completed: true, actual_minutes: 25, completed_at: "2026-09-02T00:00:00.000Z" },
      { subject: "Physics", completed: true, actual_minutes: 30, completed_at: "2026-09-02T00:00:00.000Z" },
    ],
  });
  assert.equal(value, 25);
});
