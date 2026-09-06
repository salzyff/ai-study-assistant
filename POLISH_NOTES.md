# Password and interface update

- Restored the previous six-character password minimum on registration and reset. If you changed the Supabase minimum to 12, restore it to 6 in the dashboard too; a frontend update cannot change that hosted setting.
- Kept email-link password changes and the one-hour backend session rules.
- Prevented late stream events from switching a new chat back to an older conversation or modifying its messages/loading state after navigation.
- Released streaming readers after completion/errors.
- Replaced AbortSignal.timeout with an AbortController timer for wider browser compatibility, and handled offline sign-out errors.
- Applied shared purple/white styling across study pages: heading rhythm, form focus states, profile/password spacing, card surfaces, chat typography, code blocks, horizontally scrollable admin tables, red delete confirmations, mobile input sizes and safe-area spacing.

Validation: frontend lint/build and the existing 3 frontend tests pass; all 36 backend tests pass. No browser executable was available for visual screenshots or end-to-end navigation tests. This is a code-level review and targeted repair, not a claim that every page is visually perfect or that every possible bug is eliminated.

After deploying, check New Chat while an answer is streaming, opening an existing conversation, profile/reset email flow, and admin menus at mobile and desktop widths. If you have not deployed the previous security update, follow SECURITY_SETUP.md and run migration 005 first. No additional migration is required for this polish update.
