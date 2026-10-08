import { useState } from "react";
import { supabase } from "../supabase";

export default function ChangePassword({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function sendConfirmation() {
    if (loading || sent) return;
    setLoading(true); setError("");
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user?.email) throw new Error("Please sign in again to confirm your email.");
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(data.user.email, {
        redirectTo: window.location.origin,
      });
      if (sendError) throw sendError;
      setSent(true);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <section className="tool-page profile-page">
    <button className="back-button" type="button" onClick={onBack}>← Profile</button>
    <div className="tool-page-header"><div><h1>Change password</h1>
      <p>Confirm through your email before choosing a new password.</p></div></div>
    <div className="profile-card password-page-card">
      <p>We’ll send a secure link to your account email. Open that link to set your new password.</p>
      <button className="auth-submit" type="button" disabled={loading || sent} onClick={sendConfirmation}>
        {loading ? "Sending…" : sent ? "Email sent" : "Email me a reset link"}
      </button>
      {sent && <p className="profile-success" role="status">Check your inbox and spam folder. After changing your password, sign in again on your devices.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  </section>;
}

