function serializeError(error) {
  if (!(error instanceof Error)) return error;
  return {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

function write(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  for (const [key, value] of Object.entries(payload)) {
    if (value instanceof Error) payload[key] = serializeError(value);
    if (value === undefined) delete payload[key];
  }

  recentLogs.push(payload);
  if (recentLogs.length > maxRecentLogs) recentLogs.shift();

  const line = JSON.stringify(payload);
  if (level === "error") process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export function getRecentLogs(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  return recentLogs.slice(-safeLimit).reverse().map((entry) => ({ ...entry }));
}

export const logger = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};

export function requestLogger(req, res, next) {
  const startedAt = performance.now();
  res.on("finish", () => {
    logger.info("request_completed", {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      userId: req.user?.id,
    });
  });
  next();
}
const recentLogs = [];
const maxRecentLogs = 200;
