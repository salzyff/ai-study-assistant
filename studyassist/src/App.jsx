import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import Auth from "./components/Auth";
import TaskPlanner from "./components/TaskPlanner";
import { supabase } from "./supabase";
import StudyPlanGenerator from "./components/StudyPlanGenerator";
import Quiz from "./components/Quiz";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("General");
  const [mode, setMode] = useState("ask");
  const [sessionId, setSessionId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const accessToken = session?.access_token;

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      setSession(currentSession);
      setAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setAuthLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accessToken) {
      loadConversations();
    } else {
      setConversations([]);
      setMessages([]);
      setSessionId(null);
    }
  }, [accessToken]);

  function getAuthHeaders(includeJson = false) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  async function loadConversations() {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/conversations`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load conversations"
        );
      }

      setConversations(data.conversations);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function openConversation(conversation) {
    try {
      setError("");
      setHistoryLoading(true);

      const response = await fetch(
        `${API_URL}/api/conversations/${conversation.id}/messages`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load this conversation"
        );
      }

      setSessionId(conversation.id);
      setSubject(conversation.subject);
      setMode(conversation.mode);
      setMessages(data.messages);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();

    const cleanMessage = message.trim();

    if (!cleanMessage || loading) {
      return;
    }

    setError("");
    setLoading(true);
    setMessage("");

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        role: "student",
        content: cleanMessage,
      },
    ]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          message: cleanMessage,
          subject,
          mode,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not generate an answer"
        );
      }

      setSessionId(data.sessionId);

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);

      await loadConversations();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setSessionId(null);
    setMessages([]);
    setMessage("");
    setSubject("General");
    setMode("ask");
    setError("");
  }

  async function deleteConversation(conversationId) {
    const shouldDelete = window.confirm(
      "Are you sure you want to delete this conversation?"
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not delete conversation"
        );
      }

      if (sessionId === conversationId) {
        startNewChat();
      }

      await loadConversations();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function logOut() {
    setError("");

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
    }
  }

  if (authLoading) {
    return <p>Loading...</p>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <main>
      <h1>AI Study Assistant</h1>

      <p>Logged in as: {session.user.email}</p>

      <button type="button" onClick={logOut}>
        Log out
      </button>

      <aside>
        <h2>Conversation History</h2>

        <button type="button" onClick={startNewChat}>
          New chat
        </button>

        {conversations.length === 0 && (
          <p>No saved conversations yet.</p>
        )}

        <ul>
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() =>
                  openConversation(conversation)
                }
              >
                {conversation.subject} — {conversation.mode}
              </button>

              <button
                type="button"
                onClick={() =>
                  deleteConversation(conversation.id)
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        <label htmlFor="subject">Subject</label>

        <select
          id="subject"
          value={subject}
          onChange={(event) =>
            setSubject(event.target.value)
          }
        >
          <option value="General">General</option>
          <option value="Mathematics">Mathematics</option>
          <option value="English">English</option>
          <option value="Biology">Biology</option>
          <option value="Chemistry">Chemistry</option>
          <option value="Physics">Physics</option>
          <option value="Economics">Economics</option>
        </select>

        <label htmlFor="mode">Study mode</label>

        <select
          id="mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="ask">Ask</option>
          <option value="explain">Explain</option>
          <option value="summarize">Summarize</option>
          <option value="practice">Practice</option>
        </select>
      </section>

      <section>
        {historyLoading && <p>Loading conversation...</p>}

        {!historyLoading && messages.length === 0 && (
          <p>Choose a subject and ask your first question.</p>
        )}

        {messages.map((chatMessage, index) => (
          <article key={chatMessage.id || index}>
            <strong>
              {chatMessage.role === "student"
                ? "You"
                : "Study Assistant"}
            </strong>

            <ReactMarkdown>
              {chatMessage.content}
            </ReactMarkdown>
          </article>
        ))}

        {loading && <p>Study Assistant is thinking...</p>}
        {error && <p>Error: {error}</p>}
      </section>

      <form onSubmit={sendMessage}>
        <textarea
          value={message}
          onChange={(event) =>
            setMessage(event.target.value)
          }
          placeholder="Ask a study question..."
          rows="4"
        />

        <button
          type="submit"
          disabled={loading || !message.trim()}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
      <Quiz accessToken={accessToken} />

      <StudyPlanGenerator accessToken={accessToken} />
      <TaskPlanner accessToken={accessToken} />
    </main>
  );
}

export default App;