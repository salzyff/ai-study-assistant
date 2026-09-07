# Admin convenience update

Find upgrades under Admin > Users:
- Account status filters, email/recent-sign-in sorting, clear filters and last refreshed time.
- CSV export of the currently shown users, with formula-like cells escaped for spreadsheets.
- Copy email inside each three-dot menu.
- End existing registered Study AI sessions for a member, with on-screen confirmation. Study data is preserved. The member must log in again at the next app request/heartbeat. This affects app_sessions only, not every Supabase Auth session. Admin accounts and your own account are protected server-side. Audit event appears in the existing recent server logs (not a persistent audit archive).

Filters, sorting and export apply to the current page, not the entire user directory.
No new environment variables or migration. Migration 005 from the security update must already be installed. Preserve existing Supabase settings.

Update both Render and Vercel. Test filters, export, email copy, and end-session confirmation using a test member account. Browser visual/live-project testing was not available here. Backend tests cover member denial, original-admin protection and member session expiry update; frontend tests cover CSV escaping. Existing tests, lint and production build were also run.
