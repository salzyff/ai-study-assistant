import { supabase } from "../supabase.js";

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const accessToken = authorization.slice(7);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired login",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(500).json({
      error: "Could not verify authentication",
    });
  }
}