import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "./supabase.js";
import { requireAuth } from "./middleware/requireAuth.js";
import taskRoutes from "./routes/taskRoutes.js";
import studyPlanRoutes from "./routes/studyPlanRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import helmet from "helmet";
import {
  corsOptions,
  apiLimiter,
  aiLimiter,
} from "./middleware/security.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    strictTransportSecurity: isProduction
      ? undefined
      : false,
  })
);

app.use(cors(corsOptions));

// Prevent clients from sending excessively large JSON bodies.
app.use(
  express.json({
    limit: "50kb",
  })
);

const studyModes = {
  ask: `
Answer the student's question clearly and directly.
Include examples when they improve understanding.
`,

  explain: `
Teach the topic step-by-step using simple language.
Define important terms and include a clear example.
`,

  summarize: `
Create a short, organized summary.
Include only the most important facts and key terms.
`,

  quiz: `
Create five questions about the requested topic.
Do not provide the answers yet.
Wait for the student to attempt them.
`,

  practice: `
Create three practice questions from easy to difficult.
Provide a small hint for each question, but do not reveal the answers.
`,
};

// Public route
app.get("/", (req, res) => {
  res.json({
    message: "AI Study Assistant backend is running",
  });
});

// Every route beginning with /api now requires login
app.use("/api", apiLimiter);
app.use("/api", requireAuth);

// Gemini-powered routes have stricter limits.
app.use("/api/chat", aiLimiter);
app.use("/api/study-plans", aiLimiter);
app.use("/api/quizzes/generate", aiLimiter);

// Create or continue a conversation
app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      subject = "General",
      mode = "ask",
      sessionId,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "A message is required",
      });
    }

    const cleanMessage = message.trim();

    if (!cleanMessage) {
      return res.status(400).json({
        error: "The message cannot be empty",
      });
    }

    if (!studyModes[mode]) {
      return res.status(400).json({
        error: "Mode must be ask, explain, summarize, quiz, or practice",
      });
    }

    let conversationId = sessionId;
    let previousInteractionId = null;

    if (conversationId) {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("id, gemini_interaction_id")
        .eq("id", conversationId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!conversation) {
        return res.status(404).json({
          error: "Conversation not found",
        });
      }

      previousInteractionId =
        conversation.gemini_interaction_id;
    } else {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({
          user_id: req.user.id,
          subject,
          mode,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      conversationId = conversation.id;
    }

    const prompt = `
You are an AI study assistant for secondary-school students.

Subject: ${subject}

General rules:
- Use simple language suitable for a secondary-school student.
- Help the student understand instead of only completing their work.
- For calculations, state the formula and show the working.
- Stay focused on the selected subject.
- Format the response so it is easy to read.
- Remember earlier messages in this conversation.

Selected study mode:
${mode}

Mode instructions:
${studyModes[mode]}

Student's message:
${cleanMessage}
`;

    const geminiRequest = {
      model: "gemini-3.1-flash-lite",
      input: prompt,
    };

    if (previousInteractionId) {
      geminiRequest.previous_interaction_id =
        previousInteractionId;
    }

    const aiResponse =
      await ai.interactions.create(geminiRequest);

    const answer = aiResponse.output_text;

    const { error: messagesError } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          role: "student",
          content: cleanMessage,
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: answer,
        },
      ]);

    if (messagesError) {
      throw messagesError;
    }

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        gemini_interaction_id: aiResponse.id,
        subject,
        mode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", req.user.id);

    if (updateError) {
      throw updateError;
    }

    res.json({
      sessionId: conversationId,
      subject,
      mode,
      answer,
    });
  } catch (error) {
    console.error("Chat error:", error);

    res.status(500).json({
      error: "The AI could not generate or save the answer",
    });
  }
});

// Get the logged-in student's conversations
app.get("/api/conversations", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, subject, mode, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      conversations: data,
    });
  } catch (error) {
    console.error("Conversation list error:", error);

    res.status(500).json({
      error: "Could not load conversations",
    });
  }
});

// Get messages belonging to one of the student's conversations
app.get(
  "/api/conversations/:sessionId/messages",
  async (req, res) => {
    try {
      const {
        data: conversation,
        error: conversationError,
      } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", req.params.sessionId)
        .eq("user_id", req.user.id)
        .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (!conversation) {
        return res.status(404).json({
          error: "Conversation not found",
        });
      }

      const { data, error } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      res.json({
        sessionId: conversation.id,
        messages: data,
      });
    } catch (error) {
      console.error("Message history error:", error);

      res.status(500).json({
        error: "Could not load message history",
      });
    }
  }
);

// Delete one of the student's conversations
app.delete(
  "/api/conversations/:sessionId",
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", req.params.sessionId)
        .eq("user_id", req.user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          error: "Conversation not found",
        });
      }

      res.json({
        message: "Conversation deleted",
      });
    } catch (error) {
      console.error("Delete error:", error);

      res.status(500).json({
        error: "Could not delete the conversation",
      });
    }
  }
);

// Task routes are also protected by requireAuth
app.use("/api/tasks", taskRoutes);
app.use("/api/study-plans", studyPlanRoutes);
app.use("/api/quizzes", quizRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});
app.use((error, req, res, next) => {
  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({
      error: "This website is not allowed to access the API",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: "Request body is too large",
    });
  }

  console.error("Unhandled server error:", error);

  res.status(500).json({
    error: "An unexpected server error occurred",
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});