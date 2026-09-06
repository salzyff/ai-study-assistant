import { useState } from "react";
import { supabase } from "../supabase";

function ResetPassword({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function updatePassword(event) {
    event.preventDefault();
    if (loading) return;
    setError("");

    if (password.length < 6) { setError("Use at least 6 characters for your new password."); return; }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;
      const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
      if (signOutError) throw new Error("Password changed, but signing out other devices failed. Please retry signing out from your profile.");
      onComplete();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🧠</div>
        <h1>Reset password</h1>
        <h2>Choose a new password for your account.</h2>

        <form className="auth-form" onSubmit={updatePassword}>
          <div className="auth-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength="6"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-new-password">Confirm new password</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength="6"
              autoComplete="new-password"
              required
            />
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        {error && <p className="auth-error">Error: {error}</p>}
      </div>
    </main>
  );
}

export default ResetPassword;
