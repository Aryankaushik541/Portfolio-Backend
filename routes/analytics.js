import { Router } from "express";
import rateLimit from "express-rate-limit";
import PageVisit from "../models/PageVisit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
});

const BOT_RE = /bot|crawler|spider|scraper|curl|python|wget|go-http|httpclient|java\//i;

// ─── PUBLIC: track a page visit ───────────────────────────────────────────────
router.post("/track", trackLimiter, async (req, res) => {
  res.json({ ok: true }); // respond immediately; don't block the page load
  try {
    const { path, referrer } = req.body || {};
    if (!path || typeof path !== "string") return;
    const ua = (req.headers["user-agent"] || "").slice(0, 300);
    if (BOT_RE.test(ua)) return;                        // skip bots
    const ip = (req.ip || "").replace("::ffff:", "").slice(0, 45);
    await PageVisit.create({
      path:     path.slice(0, 200),
      referrer: (referrer || "").slice(0, 200),
      ua,
      ip,
    });
  } catch {
    /* silent – never crash on tracking failure */
  }
});

// ─── PROTECTED: analytics summary for admin dashboard ─────────────────────────
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const now  = new Date();
    const ago  = (days) => new Date(now - days * 86_400_000);

    const [total, last30, last7, last24h, topPages, topReferrers, daily] =
      await Promise.all([
        PageVisit.countDocuments(),
        PageVisit.countDocuments({ createdAt: { $gte: ago(30) } }),
        PageVisit.countDocuments({ createdAt: { $gte: ago(7)  } }),
        PageVisit.countDocuments({ createdAt: { $gte: ago(1)  } }),

        PageVisit.aggregate([
          { $match: { createdAt: { $gte: ago(30) } } },
          { $group: { _id: "$path", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),

        PageVisit.aggregate([
          {
            $match: {
              createdAt: { $gte: ago(30) },
              referrer: {
                $nin: [""],
                $not: /aryan-kaushik-portfolio|localhost|127\.0\.0/i,
              },
            },
          },
          { $group: { _id: "$referrer", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 },
        ]),

        // Last 14 days – one bucket per calendar day
        PageVisit.aggregate([
          { $match: { createdAt: { $gte: ago(14) } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    res.json({
      ok: true,
      analytics: {
        total, last30, last7, last24h,
        topPages:     topPages.map((p) => ({ path: p._id, count: p.count })),
        topReferrers: topReferrers.map((r) => ({ ref: r._id, count: r.count })),
        daily:        daily.map((d) => ({ date: d._id, count: d.count })),
      },
    });
  } catch (err) {
    console.error("analytics/summary:", err.message);
    res.status(500).json({ ok: false, error: "Could not load analytics." });
  }
});

export default router;
