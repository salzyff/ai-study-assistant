# Seven study upgrades

## Before deployment
1. Extract the ZIP.
2. In your Supabase project's SQL Editor, run server/supabase/migrations/004_answer_reports.sql. This adds the answer report queue. Existing migrations 001–003 must already be installed for adaptive learning, task sessions and flashcards.
3. Run UPDATE_GITHUB.ps1 from the extracted folder. It preserves environment files and pushes changed code only. It stops if your repository has uncommitted changes.
4. Deploy the new backend on Render and frontend on Vercel. Both are needed. No new npm packages or environment variables are required.

## Where to find the upgrades
- Home: Continue studying opens the latest chat, saved quiz, tasks or flashcards. In Tasks, Resume latest study session restores the latest unfinished generated plan.
- Quiz: Give me a hint offers up to three progressively clearer hints. Each successful hint uses one AI request from the daily allowance. Exam-mode hints are blocked by the server. AI wording is not guaranteed to avoid every answer clue.
- Quiz: selected options are immediately saved per account in this browser. Refresh and choose Resume saved quiz. Recovery checks ownership and whether the quiz was submitted before loading safe question fields. Clearing browser data or changing devices does not retain these drafts.
- Quiz: enable Adaptive difficulty from my results. The existing topic-mastery scores choose easy, medium or hard for the next generated quiz, not each individual question. New topics start easy.
- Flashcards: Review due cards loads up to 100 scheduled cards across your sets. Ratings update the existing server schedule. Again schedules ten minutes later; other ratings use progressively longer intervals. Repeat when another batch is due.
- Home: Topics to practise shows up to three weak topics based on completed quizzes. Practise this topic pre-fills an adaptive quiz. If another quiz is unfinished, resume or discard that draft first.
- Chat and Quiz: Report incorrect answer submits a reason and server-verified content snapshot. Chat reporting appears once the streamed answer is saved. Admin Dashboard > Answer reports supports open/reviewed/dismissed filters, pagination, notes and reopening. Reviewing a report does not automatically rewrite content.

## Checks to try
1. Generate a quiz, select two answers, refresh, resume and check both choices.
2. Sign into another account in the same browser; it must not see the first account's quiz draft.
3. Use a hint and check the allowance. Complete the quiz and check that its draft disappears.
4. Complete a low-scoring quiz, return home and use its practice suggestion.
5. Rate a due card; it should leave the due queue until its next review time.
6. Generate a task study session, leave the page, return and restore it.
7. Report a saved chat answer or quiz question. As admin, add a note and mark reviewed. As a member, the admin report endpoint must return 403.

## Verification and limits
Frontend ESLint and production build passed. All 30 backend tests passed with test credentials, including ownership checks and admin-only report access. Existing tests cover adaptive difficulty and flashcard scheduling. Live Gemini requests, the SQL migration against your database, and browser interactions have not been executed in your production account. The earlier browser installation timeout prevented visual browser testing here. Deployment is not performed by creating the ZIP.
