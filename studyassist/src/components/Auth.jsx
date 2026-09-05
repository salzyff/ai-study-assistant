import { useState } from "react";
import { supabase } from "../supabase";

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
              <span className="google-auth-mark" aria-hidden="true">G</span>
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
                  {showPassword ? "Hide" : "Show"}
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
                  {showConfirmPassword ? "Hide" : "Show"}
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
