import { supabase } from "../supabase.js";

export function getDailyLimit(user) {
  const override = user?.app_metadata?.ai_daily_limit;
  if (Number.isInteger(override) && override >= 0 && override <= 10000) return override;
  const configuredLimit = Number(process.env.AI_DAILY_LIMIT);
  return Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : 75;
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function getAiUsage(userId) {
  const { data, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) throw userError;
  if (!data.user) throw new Error("User not found");
  const dailyLimit = getDailyLimit(data.user);
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfUtcDay());

  if (error) throw error;

  const used = count || 0;
  return {
    used,
    limit: dailyLimit,
    remaining: Math.max(dailyLimit - used, 0),
  };
}

export async function dailyAiLimit(req, res, next) {
  try {
    const usage = await getAiUsage(req.user.id);

    res.setHeader("X-AI-Daily-Limit", usage.limit);
    res.setHeader("X-AI-Daily-Remaining", usage.remaining);

    if (usage.remaining <= 0) {
      return res.status(429).json({
        error: "Daily AI limit reached. Try again tomorrow.",
        usage,
      });
    }

    req.aiUsage = usage;
    next();
  } catch (error) {
    console.error("AI usage check error:", error);
    res.status(503).json({
      error: "AI usage limits are temporarily unavailable",
    });
  }
}

export async function recordAiUsage(userId, feature) {
  const { error } = await supabase.from("ai_usage").insert({
    user_id: userId,
    feature,
  });

  if (error) {
    console.error("AI usage recording error:", error);
  }
}
