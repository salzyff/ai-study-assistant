function positiveIntegerEnv(name, fallback, { min = 1, max = 100 } = {}) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

// Keeps one impatient user from opening many costly Gemini requests at once,
// while also keeping a small Render service responsive during busy periods.
export function createAiConcurrencyLimiter({ maxConcurrent } = {}) {
  const activeUsers = new Set();
  let activeRequests = 0;
  const capacity = maxConcurrent ?? positiveIntegerEnv("MAX_CONCURRENT_AI_REQUESTS", 8);

  return function aiConcurrencyLimiter(req, res, next) {
    const userId = req.user?.id;

    if (!userId) return next();

    if (activeUsers.has(userId)) {
      res.setHeader("Retry-After", "3");
      return res.status(429).json({ error: "Your previous AI request is still being answered. Please wait a moment." });
    }

    if (activeRequests >= capacity) {
      res.setHeader("Retry-After", "5");
      return res.status(429).json({ error: "Study AI is busy right now. Please try again in a few seconds." });
    }

    activeUsers.add(userId);
    activeRequests += 1;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeUsers.delete(userId);
      activeRequests = Math.max(0, activeRequests - 1);
    };

    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

export const aiConcurrencyLimiter = createAiConcurrencyLimiter();
