import { ipKeyGenerator, rateLimit } from "express-rate-limit";

function positiveIntegerEnv(name, fallback, { min = 1, max = 100000 } = {}) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

const allowedOrigins = (
  process.env.CLIENT_URLS || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const corsOptions = {
  origin(origin, callback) {
    // Requests such as PowerShell and server-to-server calls
    // might not include an Origin header.
    const normalizedOrigin = origin?.replace(/\/$/, "");
    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },

  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Request-Id", "X-AI-Daily-Limit", "X-AI-Daily-Remaining"],
  maxAge: 86400,
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // A school can have many students behind the same Wi-Fi address.
  // This protects the API without treating the whole school as one person.
  limit: positiveIntegerEnv("API_RATE_LIMIT", 1500),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error: "Too many requests. Please try again later.",
  },
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // This middleware runs after requireAuth, so each student has their own limit.
  limit: positiveIntegerEnv("AI_WINDOW_LIMIT", 12, { max: 120 }),
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error: "AI request limit reached. Please wait before trying again.",
  },
});
