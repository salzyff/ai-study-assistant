# Admin workspace update

## Included

- Separate Overview, Users, Activity, Jobs and Server events navigation.
- Responsive purple admin styling, larger spacing, and account/service shortcuts.
- Existing account actions and daily allowances inside Users; role and text filters apply to the current page only.
- Site-wide AI activity with pagination and email labels. Click an email to filter that account's events.
- User actions stay collapsed behind a keyboard-accessible three-dot disclosure.
- Server-side job status filtering, job IDs, user IDs, timestamps and failure details.
- Confirmations for retrying jobs and processing the next queued job.
- Severity filtering for server events and admin account-action logging.

## Fixes

- Successful dashboard requests survive another request failing; failures are identified by section.
- Older dashboard/user-list responses cannot overwrite newer responses.
- Repeated worker/retry clicks are guarded while a mutation is running.
- Manual worker wording now explains that it attempts one job; processing is not necessarily success.
- Job ordering has an ID tie-breaker for stable pagination.

## Deployment

No new SQL migration or environment variable is required beyond the existing setup.
Deploy frontend and backend together. Existing .env files are preserved in the archive
and excluded by UPDATE_GITHUB.ps1 when copying changes to your repository.

## Verification

Frontend ESLint and production build passed. Backend tests cover admin access,
invalid filters, user scoping, invalid allowance values, default reset and owner
protection, with database calls stubbed in the route integration test.

Live database behaviour and visual mobile layout require post-deployment checks:

1. Open each admin section on mobile and desktop.
2. Open a member in Users, adjust their allowance, then restore the default.
3. Verify Activity shows recorded feature names and times; filter a user ID.
4. Filter Jobs by failed. Review details before confirming a retry.
5. Attempt one queued job and refresh to check its outcome.
6. Use a member account to confirm admin access is denied.

Activity contains recorded AI requests, not every page visit or private chat content.
Server events are in-memory and reset on restart; they are not a durable audit log.
This is a scoped admin review, not a claim that the entire application is bug-free.

## Compact user actions
Actions now float above the table without expanding rows. The menu fits the viewport, closes on outside click or Escape, and highlights deletion in red. Existing confirmations and account protections remain.
