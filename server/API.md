# AI Study Assistant Backend API

All `/api` routes require this header:

```http
Authorization: Bearer SUPABASE_ACCESS_TOKEN
```

Run both migrations in order in the Supabase SQL editor before using the new routes:

1. `supabase/migrations/001_learning_features.sql`
2. `supabase/migrations/002_adaptive_learning.sql`
3. `supabase/migrations/003_production_backend.sql`

Then copy `.env.example` to `.env`, fill in the existing secrets, and run:

```bash
npm install
npm run dev
```

Migration and backup commands:

```bash
npm run db:verify
supabase db push
npm run db:backup
```

`db:backup` requires PostgreSQL's `pg_dump` command and a `SUPABASE_DB_URL`
environment variable. Backups are stored in `server/backups/`, which Git ignores.

## Production environment variables

- `ADMIN_EMAILS`: comma-separated administrator email addresses.
- `ENABLE_BACKGROUND_WORKER=true`: processes queued weekly reports on Render.
- `JOB_POLL_INTERVAL_MS`: optional worker interval; defaults to 30 seconds.
- `SUPABASE_DB_URL`: direct database URL used only by the local backup command.

Never place the Supabase secret key or database URL in the React/Vite environment.

## Streaming chat

### `POST /api/chat/stream`

Accepts the same JSON body as `/api/chat` and returns Server-Sent Events:

- `meta`: conversation ID, subject, and mode
- `delta`: the next piece of the answer
- `done`: the saved response is complete
- `error`: generation or saving failed

The React chat already uses this route, so answers appear as they are generated.

## Pagination

List routes support `limit` and `offset` query parameters and return a
`pagination` object containing `total`, `hasMore`, and `nextOffset`. This is
available for conversations, tasks, notes, flashcard sets, quiz history,
question-bank entries, goals, reports, and admin jobs.

## Background weekly reports

- `POST /api/reports/weekly` queues a seven-day progress report.
- `GET /api/reports?limit=20&offset=0` returns completed and pending reports.

The database claim function prevents two Render instances from processing the
same report. Interrupted jobs are automatically reclaimable after 15 minutes.

## Administrator API

Set `ADMIN_EMAILS` on Render, then sign in with one of those accounts.

- `GET /api/admin/status` tells the frontend whether the signed-in account is an administrator.
- `GET /api/admin/overview` returns user, conversation, task, AI-usage, and failed-job totals.
- `GET /api/admin/logs` returns a protected rolling view of recent structured server events.
- `GET /api/admin/users` lists authentication accounts with pagination.
- `PATCH /api/admin/users/:userId/status` suspends or reactivates a non-admin account.
- `PATCH /api/admin/users/:userId/role` promotes a member or demotes a promoted administrator. Environment administrators cannot be demoted.
- `DELETE /api/admin/users/:userId` soft-deletes a non-admin account.
- `GET /api/admin/jobs` lists background jobs with pagination.
- `POST /api/admin/jobs/:jobId/retry` retries a failed job.
- `POST /api/admin/jobs/run-once` asks the worker to process one queued job immediately.

## Upload security

Uploads are restricted by size, MIME type, matching filename extension, PDF
signature, and binary-content checks. Encrypted PDFs and PDFs containing scripts,
embedded files, launch actions, or automatic actions are rejected.

## AI usage

Every successful AI operation is recorded per user. `AI_DAILY_LIMIT` controls the daily maximum; it defaults to 75.

### `GET /api/ai-usage`

Returns `{ used, limit, remaining }` for the current UTC day.

## Notes and PDFs

### `POST /api/notes`

Send `multipart/form-data`:

- `file`: one PDF, TXT, or Markdown file
- `title`: optional title
- `subject`: optional subject

The default maximum is 5 MB. Files are processed in memory and only extracted text is saved. Image-only scanned PDFs require OCR and return an error for now.

### `GET /api/notes`

Lists the logged-in student's uploaded notes without returning their full text.

### `GET /api/notes/:noteId`

Returns one note, including its extracted text.

### `POST /api/notes/:noteId/ask`

```json
{ "question": "What is the role of chlorophyll?" }
```

The answer is grounded in the selected notes. The API says when the notes do not contain the answer.

### `POST /api/notes/:noteId/summarize`

Returns an AI summary of the selected notes.

### `DELETE /api/notes/:noteId`

Deletes the selected note belonging to the logged-in student.

## Flashcards

### `POST /api/flashcards/generate`

Generate from a topic:

```json
{
  "subject": "Biology",
  "topic": "Photosynthesis",
  "count": 10
}
```

Or generate from uploaded notes:

```json
{
  "noteId": "NOTE_UUID",
  "count": 10
}
```

### `GET /api/flashcards/sets`

Lists the student's saved flashcard sets.

### `GET /api/flashcards/sets/:setId`

Returns one set and all of its cards.

### `GET /api/flashcards/due?limit=20`

Returns cards due for spaced-repetition review. A review rating automatically calculates and saves the card's next review date.

### `POST /api/flashcards/sets/:setId/review`

```json
{
  "cardId": "CARD_UUID",
  "rating": "good"
}
```

Allowed ratings are `again`, `hard`, `good`, and `easy`.

### `DELETE /api/flashcards/sets/:setId`

Deletes a set and its cards.

## Adaptive quizzes and exam mode

### `POST /api/quizzes/generate`

```json
{
  "subject": "Biology",
  "topic": "Cellular respiration",
  "numberOfQuestions": 5,
  "mode": "adaptive",
  "difficulty": "medium",
  "durationMinutes": 10,
  "noteId": "OPTIONAL_NOTE_UUID"
}
```

Modes are `practice`, `adaptive`, `exam`, and `notes`. Adaptive mode selects difficulty from saved topic mastery. Exam mode is timed by the client. Supplying `noteId` creates a quiz grounded in that note.

### `POST /api/quizzes/:quizId/submit`

Accepts answers and an optional `durationSeconds`. Unanswered questions may use `null`, which allows timed exams to auto-submit. The response includes corrections, score, updated mastery, the recommended next difficulty, and the number of mistakes saved.

### `GET /api/quizzes/history?limit=30`

Returns practice and exam score history.

## Mistakes, recommendations, and revision queue

- `GET /api/learning/mistakes?resolved=false` lists the mistake notebook.
- `PATCH /api/learning/mistakes/:mistakeId` with `{ "resolved": true }` marks one reviewed.
- `GET /api/learning/recommendations` returns weak topics and suggested next actions.
- `GET /api/learning/daily-queue` combines due flashcards, open tasks, weak topics, unresolved mistakes, and active goals.

## Teach-back and written marking

### `POST /api/learning/teach-back`

```json
{
  "subject": "Physics",
  "topic": "Newton's second law",
  "explanation": "My explanation in my own words..."
}
```

Returns a score, strengths, knowledge gaps, feedback, and a follow-up question. History is available from `GET /api/learning/teach-back`.

### `POST /api/learning/mark-written`

```json
{
  "subject": "Biology",
  "topic": "Photosynthesis",
  "question": "Explain why light is needed.",
  "studentAnswer": "My written answer...",
  "markingPoints": ["Mentions light energy", "Links light energy to glucose production"],
  "maxMarks": 4
}
```

The answer is marked only against the supplied marking points. History is available from `GET /api/learning/written-assessments`.

## Practice question bank

- `GET /api/question-bank` supports subject, topic, exam type, year, and difficulty filters.
- `POST /api/question-bank/generate` creates original exam-style practice questions.
- `POST /api/question-bank` stores a user-provided question only when `hasRights` is `true`.
- `POST /api/question-bank/quiz` creates a quiz from 1–10 selected question IDs.
- `DELETE /api/question-bank/:questionId` deletes an owned question.

The app does not bundle or reproduce official copyrighted papers. Store only questions you created or have permission to use.

## Study goals

- `GET /api/goals` recalculates goal progress from real study activity.
- `POST /api/goals` creates a goal.
- `PATCH /api/goals/:goalId` updates it.
- `DELETE /api/goals/:goalId` deletes it.

Supported target types are `study_minutes`, `sessions_completed`, `tasks_completed`, and `quiz_score`.

## AI study tasks

### `POST /api/tasks/:taskId/study-session`

Turns an existing task into a stored AI study session with an objective, warm-up, timed steps, self-check question, and finish line. The response includes `sessionId`.

## Progress

### `GET /api/progress/study-sessions?limit=30`

Lists the logged-in student's newest study sessions. The optional limit can be 1–100.

### `POST /api/progress/study-sessions`

Creates a manually timed session:

```json
{
  "subject": "Physics",
  "topic": "Electric circuits",
  "plannedMinutes": 25,
  "taskId": "OPTIONAL_TASK_UUID"
}
```

### `PATCH /api/progress/study-sessions/:sessionId/complete`

```json
{ "actualMinutes": 28 }
```

Completing a session linked to a task also completes that task.

### `GET /api/progress?days=30`

Returns task completion, quiz averages, study minutes, study streak, flashcard reviews, and progress grouped by subject. `days` can be 7–365.

## Dashboard

### `GET /api/dashboard`

Returns one compact response containing open tasks, due/overdue tasks, quiz average, study minutes, streak, note count, flashcard-set count, subject progress, and AI usage.

## Validation and errors

New endpoints validate required strings, UUIDs, dates, number ranges, and allowed enum values. Errors use this shape:

```json
{ "error": "Human-readable explanation" }
```

Common statuses are `400` invalid input, `401` unauthenticated, `404` missing resource, `413` upload too large, `422` unusable AI/file result, `429` rate limit, and `500` server/database failure.

## Tests

Run:

```bash
npm test
```

The included tests cover validation, adaptive difficulty, spaced repetition, goal calculations, and progress statistics without contacting Gemini or Supabase.
