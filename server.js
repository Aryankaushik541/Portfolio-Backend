import express      from "express";
import cors         from "cors";
import helmet       from "helmet";
import dotenv       from "dotenv";
import rateLimit    from "express-rate-limit";
import { connectDB }          from "./config/db.js";
import { sanitizeInput }      from "./middleware/sanitize.js";
import contactRoutes          from "./routes/contact.js";
import githubRoutes           from "./routes/github.js";
import profileRoutes          from "./routes/profile.js";
import authRoutes             from "./routes/auth.js";
import adminRoutes            from "./routes/admin.js";
import publicProjectsRoutes   from "./routes/publicProjects.js";
import chatRoutes             from "./routes/chat.js";
import analyticsRoutes        from "./routes/analytics.js";
import aiRoutes                from "./routes/ai.js";

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// The AI chat endpoint sends the full conversation history on every turn,
// so it gets its own larger body-size limit. Mounted before the global
// parser so it takes effect for /api/ai and isn't double-parsed.
app.use("/api/ai", express.json({ limit: "1mb" }));
app.use(express.json({ limit: "50kb" }));
app.use(sanitizeInput);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowedOrigins.includes("*") || !origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ── Rate limits ───────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { ok: false, error: "Too many requests." } });
const chatLimiter    = rateLimit({ windowMs:  5 * 60 * 1000, limit: 60, message: { ok: false, error: "Too many messages."  } });

app.use("/api", globalLimiter);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({
  ok: true,
  service: "portfolio-api",
  mailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  ts: new Date(),
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/contact",  contactLimiter, contactRoutes);
app.use("/api/chat",     chatLimiter,    chatRoutes);
app.use("/api/github",                  githubRoutes);
app.use("/api/profile",                 profileRoutes);
app.use("/api/auth",                    authRoutes);
app.use("/api/admin",                   adminRoutes);        // protected via requireAuth
app.use("/api/public",                  publicProjectsRoutes);
app.use("/api/analytics",               analyticsRoutes);    // visit tracking + admin summary
app.use("/api/ai",                      aiRoutes);           // Claude-style chat, protected via requireAuth

app.use((req, res) => res.status(404).json({ ok: false, error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ ok: false, error: "Internal server error." });
});

connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 API running on https://portfolio-backend-69v7.onrender.com`));
});
