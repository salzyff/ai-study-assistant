# Mobile navigation repair

This update fixes several concrete crash risks but the exact failure on the affected phone has not been reproduced.

- Report controls no longer call string methods on numeric message IDs. Unsupported IDs do not render a report button.
- Invalid chat-history entries are filtered before rendering; non-text content cannot crash the Markdown renderer.
- Browser storage failures no longer throw from the preferences effect.
- Changing pages or conversations resets the page scroll position.
- A root recovery screen catches render failures and can reopen the workspace without a manual refresh. Saved server data is unaffected.

Verification: three regression tests for message validation, message identifiers and blocked browser storage; ESLint and production build. Mobile browser interaction could not be verified in this environment.

Deploy the frontend update on Vercel. No new migration or backend change is required for this repair. The ZIP includes the previously delivered upgrades.

On your phone after deployment:
1. Reload once to load the updated assets.
2. Scroll down the home page and tap New Chat.
3. Return home and resume a saved conversation.
4. Open another tool, then tap New Chat again.
5. If the recovery screen appears, capture the browser console error labelled Study AI rendering error. That identifies any remaining crash instead of leaving an unexplained white screen.
