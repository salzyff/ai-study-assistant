import { useState } from "react";
import { supabase } from "../supabase";

function Auth() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (authMode === "signup") {
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signupError) throw signupError;

        setMessage(
          "Account created. Check your email if confirmation is required."
        );
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email,
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

        <h1>AI Study Assistant</h1>

        <h2>
          {authMode === "login"
            ? "Welcome back! Log in to continue."
            : "Create your account and start learning."}
        </h2>

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

          <div className="auth-field">
            <label htmlFor="password">Password</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              minLength="6"
              required
            />
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : authMode === "login"
                ? "Log in"
                : "Create account"}
          </button>

        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() =>
            setAuthMode((currentMode) =>
              currentMode === "login" ? "signup" : "login"
            )
          }
        >
          {authMode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </button>

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
