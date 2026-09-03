const DAY_MS = 24 * 60 * 60 * 1000;

export function difficultyFromMastery(masteryScore) {
  const score = Number(masteryScore) || 0;
  if (score < 45) return "easy";
  if (score < 75) return "medium";
  return "hard";
}

export function nextAdaptiveDifficulty(percentage) {
  const score = Number(percentage) || 0;
  if (score < 50) return "easy";
  if (score < 80) return "medium";
  return "hard";
}

export function nextFlashcardSchedule(
  { rating, intervalDays = 0, reviewCount = 0 },
  now = new Date(),
) {
  const currentInterval = Math.max(Number(intervalDays) || 0, 0);
  let nextInterval;
  let nextReviewAt;

  if (rating === "again") {
    nextInterval = 0;
    nextReviewAt = new Date(now.getTime() + 10 * 60 * 1000);
  } else {
    const multipliers = { hard: 1.2, good: 2.5, easy: 3.5 };
    const firstIntervals = { hard: 1, good: 2, easy: 4 };
    nextInterval = reviewCount === 0
      ? firstIntervals[rating]
      : Math.max(1, Math.round(currentInterval * multipliers[rating]));
    nextInterval = Math.min(nextInterval, 365);
    nextReviewAt = new Date(now.getTime() + nextInterval * DAY_MS);
  }

  return {
    intervalDays: nextInterval,
    reviewCount: Number(reviewCount || 0) + 1,
    nextReviewAt: nextReviewAt.toISOString(),
  };
}

export function calculateGoalProgress(goal, { sessions = [], attempts = [], tasks = [] }) {
  const start = new Date(goal.period_start).getTime();
  const end = new Date(goal.period_end).getTime();
  const matchesSubject = (subject) => goal.subject === "General" || subject === goal.subject;
  const withinPeriod = (value) => {
    const time = value ? new Date(value).getTime() : Number.NaN;
    return time >= start && time <= end;
  };

  if (goal.target_type === "study_minutes") {
    return sessions
      .filter((session) => session.completed && matchesSubject(session.subject) && withinPeriod(session.completed_at))
      .reduce((total, session) => total + Number(session.actual_minutes || session.planned_minutes || 0), 0);
  }

  if (goal.target_type === "sessions_completed") {
    return sessions.filter(
      (session) => session.completed && matchesSubject(session.subject) && withinPeriod(session.completed_at),
    ).length;
  }

  if (goal.target_type === "tasks_completed") {
    return tasks.filter(
      (task) => task.completed && matchesSubject(task.subject) && withinPeriod(task.completed_at),
    ).length;
  }

  if (goal.target_type === "quiz_score") {
    const percentages = attempts
      .filter((attempt) => {
        const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
        return matchesSubject(quiz?.subject) && withinPeriod(attempt.created_at);
      })
      .map((attempt) => attempt.total ? Math.round((Number(attempt.score) / Number(attempt.total)) * 100) : 0);
    return percentages.length ? Math.max(...percentages) : 0;
  }

  return 0;
}
