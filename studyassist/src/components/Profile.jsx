import { useState } from "react";
import { supabase } from "../supabase";
import { SUBJECTS } from "../constants/subjects";

const STUDY_MODES = ["ask", "explain", "summarize", "practice"];

function Profile({ user, preferences, onPreferencesChange, onBack, onLogout, onChangePassword, isAdmin, onOpenAdmin }) {
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name || "Student");
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try { await onLogout(); }
    catch (err) { setError(err.message); }
    finally { setLoggingOut(false); }
  }

  function updatePreference(key, value) {
    onPreferencesChange({ ...preferences, [key]: value });
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError(""); setMessage(""); setSavingProfile(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() || "Student" },
      });
      if (updateError) throw updateError;
      setMessage("Saved. Your name is up to date.");
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <section className="tool-page profile-page profile-redesign">
      <button className="back-button" type="button" onClick={onBack}>← Home</button>
      <header className="profile-overview"><div className="profile-monogram" aria-hidden="true">{(user.user_metadata?.display_name || user.email || "S").charAt(0).toUpperCase()}</div><div><h1>Your profile</h1><p>{user.email}</p></div></header>

      <div className="profile-layout">
        <section className="profile-panel">
          <h2>Account details</h2>
          <p className="panel-description">Choose the name shown in your workspace.</p>
          <form className="auth-form" onSubmit={saveProfile}>
            <div className="auth-field"><label htmlFor="display-name">Display name</label>
              <input id="display-name" value={displayName} maxLength="50" onChange={(event) => setDisplayName(event.target.value)} required /></div>
            <button className="auth-submit" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</button>
          </form>
        </section>

        <section className="profile-panel">
          <h2>Study defaults</h2>
          <div className="profile-settings-row">
            <div className="auth-field"><label htmlFor="default-subject">Default subject</label>
              <select id="default-subject" value={preferences.defaultSubject} onChange={(event) => updatePreference("defaultSubject", event.target.value)}>
                {SUBJECTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select></div>
            <div className="auth-field"><label htmlFor="default-mode">Default study mode</label>
              <select id="default-mode" value={preferences.defaultMode} onChange={(event) => updatePreference("defaultMode", event.target.value)}>
                {STUDY_MODES.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
              </select></div>
          </div>
          <p className="profile-help">New chats will begin with these choices.</p>
        </section>

        <section className="profile-panel profile-access">
          <h2>Account access</h2><p className="panel-description">Manage your password or sign out of this device.</p>
          <button className="profile-action-row" type="button" onClick={onChangePassword}>
            Change password →
          </button>
          <button className="profile-action-row profile-signout" type="button" onClick={handleLogout} disabled={loggingOut}>⇥ {loggingOut ? "Logging out..." : "Log out"}</button>
        </section>

        {isAdmin && (
          <section className="profile-panel">
            <h2>Administration</h2>
            <p className="profile-help">Monitor system totals and manage background jobs.</p>
            <button className="profile-action-row" type="button" onClick={onOpenAdmin}>
              Open admin dashboard →
            </button>
          </section>
        )}
      </div>
      {message && <p className="profile-success" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">Error: {error}</p>}
    </section>
  );
}

export default Profile;

