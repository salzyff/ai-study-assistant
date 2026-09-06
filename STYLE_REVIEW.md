# Styling review

Changes preserve the existing purple/white design and application logic.

- Reduce nested padding in Learning Center and Dashboard, and give mobile tool pages usable content width.
- Wrap long profile emails, task names, admin headings, and error messages.
- Keep wide admin tables and chat code/math inside local scrolling containers.
- Wrap admin toolbars and allowance controls on smaller screens.
- Repair older selectors overriding the compact admin action menu.
- Give unconfirmed users an amber badge instead of the green active badge.
- Style the question bank and study goals forms to match the existing controls.
- Use red for deletion buttons and confirmation; retain role-change confirmation colours.
- Add visible keyboard focus and reduced-motion support.
- Allow the sidebar to scroll on short desktop windows.

Verification: ESLint and Vite production build. Browser rendering was unavailable because the Chromium download timed out; authenticated live pages and every populated state have not been visually verified. No live site deployment performed. Existing environment files are unchanged.
