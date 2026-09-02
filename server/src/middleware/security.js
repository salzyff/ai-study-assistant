import { rateLimit } from "express-rate-limit";

const allowedOrigins = (
  process.env.CLIENT_URLS || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim());

export const corsOptions = {
  origin(origin, callback) {
    // Requests such as PowerShell and server-to-server calls
    // might not include an Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error: "AI request limit reached. Please wait before trying again.",
  },
});