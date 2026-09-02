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
        const { error: signupError } =
          await supabase.auth.signUp({
            email,
            password,
          });

        if (signupError) {
          throw signupError;
        }

        setMessage(
          "Account created. Check your email if confirmation is required."
        );
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (loginError) {
          throw loginError;
        }
      }
    } catch (authError) {
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>AI Study Assistant</h1>

      <h2>
        {authMode === "login" ? "Log in" : "Create account"}
      </h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength="6"
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : authMode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>

      <button
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

      {message && <p>{message}</p>}
      {error && <p>Error: {error}</p>}
    </main>
  );
}

export default Auth;