function percentage(score, total) {
  if (!total) return 0;
  return Math.round((Number(score) / Number(total)) * 100);
}

function dateKey(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null;
}

export function calculateStreak(activityDates, now = new Date()) {
  const dates = new Set(activityDates.filter(Boolean));
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (!dates.has(dateKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;

  while (dates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export function buildProgressSummary({ tasks = [], attempts = [], sessions = [], reviews = [] }) {
  const completedSessions = sessions.filter((session) => session.completed);
  const quizPercentages = attempts.map((attempt) => percentage(attempt.score, attempt.total));
  const activityDates = [
    ...completedSessions.map((session) => dateKey(session.completed_at || session.started_at)),
    ...attempts.map((attempt) => dateKey(attempt.created_at)),
    ...reviews.map((review) => dateKey(review.created_at)),
  ];

  const subjects = {};

  for (const session of completedSessions) {
    const subject = session.subject || "General";
    subjects[subject] ||= { studySessions: 0, minutesStudied: 0, quizAttempts: 0, quizAverage: 0, _quizTotal: 0 };
    subjects[subject].studySessions += 1;
    subjects[subject].minutesStudied += Number(session.actual_minutes || session.planned_minutes || 0);
  }

  for (const attempt of attempts) {
    const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
    const subject = quiz?.subject || "General";
    subjects[subject] ||= { studySessions: 0, minutesStudied: 0, quizAttempts: 0, quizAverage: 0, _quizTotal: 0 };
    subjects[subject].quizAttempts += 1;
    subjects[subject]._quizTotal += percentage(attempt.score, attempt.total);
  }

  const subjectProgress = Object.entries(subjects).map(([subject, values]) => ({
    subject,
    studySessions: values.studySessions,
    minutesStudied: values.minutesStudied,
    quizAttempts: values.quizAttempts,
    quizAverage: values.quizAttempts ? Math.round(values._quizTotal / values.quizAttempts) : 0,
  }));

  return {
    tasks: {
      total: tasks.length,
      completed: tasks.filter((task) => task.completed).length,
      open: tasks.filter((task) => !task.completed).length,
    },
    quizzes: {
      attempts: attempts.length,
      averagePercentage: quizPercentages.length
        ? Math.round(quizPercentages.reduce((sum, value) => sum + value, 0) / quizPercentages.length)
        : 0,
      bestPercentage: quizPercentages.length ? Math.max(...quizPercentages) : 0,
    },
    study: {
      sessionsCompleted: completedSessions.length,
      minutesStudied: completedSessions.reduce(
        (sum, session) => sum + Number(session.actual_minutes || session.planned_minutes || 0),
        0,
      ),
      streakDays: calculateStreak(activityDates),
    },
    flashcards: {
      reviews: reviews.length,
      remembered: reviews.filter((review) => ["good", "easy"].includes(review.rating)).length,
    },
    subjectProgress,
  };
}
