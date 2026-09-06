import { supabase } from "../supabase.js";

export function createRequireAuth(client) {
  return async function requireAuth(req, res, next) {
    res.setHeader("Cache-Control", "no-store");
    const deny = () => res.status(401).json({ error: "Your session has ended. Please sign in again.", code: "SESSION_ENDED" });
    try {
      const authorization = req.headers.authorization;
      if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return res.status(401).json({ error: "Authentication required" });
      const token = authorization.slice(7);
      if (token.length > 16384) return deny();
      const { data, error } = await client.auth.getUser(token);
      if (error || !data?.user) return deny();
      // Decode only AFTER Supabase verifies the token. Never authorize using an unverified JWT.
      let claims;
      try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); } catch { return deny(); }
      if (claims.sub !== data.user.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id || "")) return deny();
      const { data: allowed, error: sessionError } = await client.rpc("check_app_session", {
        p_session_id: claims.session_id, p_user_id: data.user.id,
      });
      if (sessionError) {
        console.error("Session validation unavailable", sessionError.code);
        return res.status(503).json({ error: "Login verification is temporarily unavailable. Please try again." });
      }
      if (allowed !== true) return deny();
      req.user = data.user;
      req.authSessionId = claims.session_id;
      return next();
    } catch {
      return res.status(503).json({ error: "Login verification is temporarily unavailable. Please try again." });
    }
  };
}
export const requireAuth = createRequireAuth(supabase);
