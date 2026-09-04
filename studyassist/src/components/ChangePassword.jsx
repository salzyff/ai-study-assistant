import { useState } from "react";
import { supabase } from "../supabase";

function ChangePassword({ onBack }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmPassword("");
      setMessage("Your password has been changed successfully.");
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="tool-page profile-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← Back to Profile
      </button>

      <div className="tool-page-header">
        <div>
          <h1>Change password</h1>
          <p>Choose a strong new password for your account.</p>
        </div>
      </div>

      <div className="profile-card password-page-card">
        <form className="auth-form" onSubmit={changePassword}>
          <div className="auth-field">
            <label htmlFor="account-new-password">New password</label>
            <input id="account-new-password" type="password" value={password}
              onChange={(event) => setPassword(event.target.value)} minLength="6"
              autoComplete="new-password" required />
          </div>

          <div className="auth-field">
            <label htmlFor="account-confirm-password">Confirm new password</label>
            <input id="account-confirm-password" type="password" value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)} minLength="6"
              autoComplete="new-password" required />
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        {message && <p className="profile-success">{message}</p>}
        {error && <p className="auth-error">Error: {error}</p>}
      </div>
    </section>
  );
}

export default ChangePassword;
