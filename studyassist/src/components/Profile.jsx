import { useState } from "react";
import { supabase } from "../supabase";
import { SUBJECTS } from "../constants/subjects";

const STUDY_MODES = ["ask", "explain", "quiz", "summarize", "practice"];

function Profile({ user, preferences, onPreferencesChange, onBack, onLogout, onChangePassword }) {
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name || "Student");
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setMessage("Profile saved successfully.");
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <section className="tool-page profile-page">
      <button className="back-button" type="button" onClick={onBack}>← Back to Dashboard</button>
      <div className="tool-page-header"><div><h1>Profile & Settings</h1><p>Personalize your account and study experience.</p></div></div>

      <div className="profile-card profile-settings-card">
        <div className="profile-section">
          <h2>Account details</h2>
          <div className="profile-identity">
            <div className="avatar">{user.email?.charAt(0).toUpperCase()}</div>
            <div><strong>{displayName || "Student"}</strong><p>{user.email}</p></div>
          </div>
          <form className="auth-form" onSubmit={saveProfile}>
            <div className="auth-field"><label htmlFor="display-name">Display name</label>
              <input id="display-name" value={displayName} maxLength="50" onChange={(event) => setDisplayName(event.target.value)} required /></div>
            <button className="auth-submit" type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</button>
          </form>
        </div>

        <div className="profile-section">
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
        </div>

        <div className="profile-section profile-security-section">
          <h2>Security</h2>
          <button className="profile-secondary-button" type="button" onClick={onChangePassword}>
            Change password →
          </button>
          <button className="logout-button" type="button" onClick={onLogout}>⇥ Log out</button>
        </div>
      </div>
      {message && <p className="profile-success">{message}</p>}
      {error && <p className="auth-error">Error: {error}</p>}
    </section>
  );
}

export default Profile;
