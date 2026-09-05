# Google sign-in setup

The app code is ready for Google sign-in. Complete these dashboard steps once.

## 1. Configure Supabase URLs

In Supabase, open **Authentication > URL Configuration**.

- Site URL: `https://studyaing.vercel.app`
- Redirect URL: `https://studyaing.vercel.app/`
- Local redirect URL: `http://localhost:5173/`

## 2. Create the Google OAuth client

In Google Cloud Console, open **Google Auth Platform > Clients** and create an
OAuth client with the **Web application** type.

Add these Authorized JavaScript origins:

- `https://studyaing.vercel.app`
- `http://localhost:5173`

Add this Authorized redirect URI:

- `https://rlajonkzmuubpppckpgc.supabase.co/auth/v1/callback`

If Supabase displays a different callback URL on its Google provider page, use
the URL displayed by Supabase instead.

## 3. Enable Google in Supabase

Open **Authentication > Sign In / Providers > Google** in Supabase.

1. Turn the provider on.
2. Paste the Google Client ID and Client Secret.
3. Save the provider.

Keep the Google Client Secret in Supabase. Do not place it in the React `.env`
file, Vercel environment variables, or GitHub.

## 4. Test it

Open the login or registration page and select **Continue with Google**. After
Google authentication, the user should return to Study AI already signed in.

If the Google OAuth app is still in testing mode, add the Google accounts you
want to test with as test users in Google Cloud Console.
