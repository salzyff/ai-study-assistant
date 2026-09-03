import test from "node:test";
import assert from "node:assert/strict";
import { buildProgressSummary, calculateStreak } from "../src/utils/stats.js";

test("calculateStreak counts consecutive activity days", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  assert.equal(calculateStreak(["2026-09-03", "2026-09-02", "2026-09-01"], now), 3);
});

test("buildProgressSummary combines study, quiz, task, and flashcard data", () => {
  const summary = buildProgressSummary({
    tasks: [{ completed: true }, { completed: false }],
    attempts: [
      { score: 4, total: 5, created_at: "2026-09-03T10:00:00.000Z", quizzes: { subject: "Biology" } },
      { score: 3, total: 5, created_at: "2026-09-02T10:00:00.000Z", quizzes: { subject: "Biology" } },
    ],
    sessions: [
      { completed: true, subject: "Biology", actual_minutes: 30, completed_at: "2026-09-03T09:00:00.000Z" },
    ],
    reviews: [
      { rating: "good", created_at: "2026-09-03T08:00:00.000Z" },
      { rating: "again", created_at: "2026-09-03T08:05:00.000Z" },
    ],
  });

  assert.deepEqual(summary.tasks, { total: 2, completed: 1, open: 1 });
  assert.equal(summary.quizzes.averagePercentage, 70);
  assert.equal(summary.quizzes.bestPercentage, 80);
  assert.equal(summary.study.minutesStudied, 30);
  assert.equal(summary.flashcards.remembered, 1);
  assert.equal(summary.subjectProgress[0].subject, "Biology");
});
