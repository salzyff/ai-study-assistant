# Study AI: 100-student rollout

## Apply once in Supabase

Run `server/supabase/migrations/006_school_scale.sql` in the Supabase SQL Editor.

## Render environment variables

Set these in the backend's Render environment. The shown values are safe starting points, not API keys.

```text
SCHOOL_SEAT_LIMIT=100
API_RATE_LIMIT=1500
AI_WINDOW_LIMIT=12
MAX_CONCURRENT_AI_REQUESTS=8
```

Keep the existing `CLIENT_URLS`, Supabase, Gemini, Brevo, and admin variables exactly as they are. Do not commit `.env` files.

## Before inviting the school

1. Open `https://your-render-service.onrender.com/health` and confirm it returns `status: ok`.
2. In Supabase, confirm Authentication email delivery and your production redirect URL work.
3. In the admin dashboard, confirm the seat count and account confirmation count update after a test signup.
4. Test with at least three student accounts from the same Wi-Fi network.
5. Make sure your Gemini project has enough paid quota for real student usage. Free quotas are not dependable for a school rollout.

## What the new limits mean

- Students are limited individually, rather than the whole school Wi-Fi sharing one AI limit.
- A student cannot start a second AI request while their first request is still running.
- At most eight AI requests run at the same time by default. Raise `MAX_CONCURRENT_AI_REQUESTS` only after checking Render and Gemini capacity.
