import { useState } from "react";
import { supabase } from "../supabase";
import PasswordEye from "./PasswordEye";

function Auth() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    if (loading) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (googleError) throw googleError;
    } catch (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (authMode === "forgot") {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin,
          });

        if (resetError) throw resetError;

        setMessage(
          "If an account exists for that email, a password-reset link has been sent."
        );
      } else if (authMode === "signup") {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        const { error: signupError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (signupError) throw signupError;

        setMessage(
          "Account created. Check your email if confirmation is required."
        );
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError) throw loginError;
      }
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-card">

        <div className="auth-logo">🧠</div>

        <h1>Study AI</h1>

        <h2>
          {authMode === "login" && "Welcome back! Log in to continue."}
          {authMode === "signup" && "Create your account and start learning."}
          {authMode === "forgot" && "Enter your email to reset your password."}
        </h2>

        {authMode !== "forgot" && (
          <>
            <button
              className="google-auth-button"
              type="button"
              disabled={loading}
              onClick={signInWithGoogle}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.909c1.702-1.567 2.683-3.874 2.683-6.614Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.181l-2.909-2.258c-.806.54-1.836.859-3.048.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
              </svg>
              Continue with Google
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>or continue with email</span>
            </div>
          </>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="auth-field">
            <label htmlFor="email">Email</label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          {authMode !== "forgot" && (
            <div className="auth-field">
              <label htmlFor="password">Password</label>

              <div className="password-input-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  minLength="6"
                  required
                />
                <button
                  className="password-visibility-button"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <PasswordEye visible={showPassword} />
                </button>
              </div>
            </div>
          )}

          {authMode === "signup" && (
            <div className="auth-field">
              <label htmlFor="confirm-password">Confirm password</label>

              <div className="password-input-wrap">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  minLength="6"
                  required
                />
                <button
                  className="password-visibility-button"
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                >
                  <PasswordEye visible={showConfirmPassword} />
                </button>
              </div>
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : authMode === "login"
                ? "Log in"
                : authMode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </button>

        </form>

        {authMode === "login" && (
          <>
            <button
              className="auth-switch"
              disabled={loading}
              type="button"
              onClick={() => {
                setAuthMode("forgot");
                setShowPassword(false);
                setShowConfirmPassword(false);
                setMessage("");
                setError("");
              }}
            >
              Forgot password?
            </button>

            <button
              className="auth-switch"
              disabled={loading}
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setShowPassword(false);
                setShowConfirmPassword(false);
                setMessage("");
                setError("");
              }}
            >
              Need an account? Sign up
            </button>
          </>
        )}

        {authMode !== "login" && (
          <button
            className="auth-switch"
              disabled={loading}
            type="button"
            onClick={() => {
              setAuthMode("login");
              setPassword("");
              setConfirmPassword("");
              setShowPassword(false);
              setShowConfirmPassword(false);
              setMessage("");
              setError("");
            }}
          >
            Back to login
          </button>
        )}

        {message && (
          <p className="auth-message">{message}</p>
        )}

        {error && (
          <p className="auth-error">Error: {error}</p>
        )}

      </div>
    </main>
  );
}

export default Auth;
