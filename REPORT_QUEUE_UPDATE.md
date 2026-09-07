# Admin review queue update

Removed user CSV export, its helper and test. The update script removes those files from the Git checkout too.

Answer Reports is now a styled review queue: status tabs via selector, type filter, text search on the current page, collapsible Markdown/math answer previews, save-note without changing status, review/dismiss/reopen actions, loading/retry/empty states, and mobile layout. Internal notes do not correct the original answer or notify a student.

Extra conveniences: user success notices can be dismissed; deleting the last account on a page moves back a page; resolving the last report on a page does the same. Unsaved notes survive in-panel filtering/refresh but are not persisted across leaving the panel. No new migration or environment values beyond the existing security setup.

Test after deployment: review a report, save a note without closing it, filter quiz/chat reports, reopen a dismissed item, and verify user export is gone. Live visual/browser verification was unavailable.
