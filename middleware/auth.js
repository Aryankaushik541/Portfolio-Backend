import jwt from "jsonwebtoken";

// Verifies the Bearer token on protected admin/AI routes.
// Fails closed: any missing/invalid/expired token is rejected.
// Token payload contains { sub, email, role } — see routes/auth.js.
export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ ok: false, error: "Authentication required." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set — refusing to verify tokens.");
      return res.status(500).json({ ok: false, error: "Server misconfiguration." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden." });
    }

    req.admin = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid or expired session." });
  }
}
