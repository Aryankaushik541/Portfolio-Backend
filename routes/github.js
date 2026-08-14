import { Router } from "express";
import fetch from "node-fetch";

const router = Router();

// Simple in-memory cache so we don't hammer GitHub's rate limit
// and so the page still loads fast if GitHub is slow.
let cache = { data: null, fetchedAt: 0 };
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

router.get("/repos", async (req, res) => {
  const username = process.env.GITHUB_USERNAME || "Aryankaushik541";
  const now = Date.now();

  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    return res.json({ ok: true, cached: true, repos: cache.data });
  }

  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded ${response.status}`);
    }

    const raw = await response.json();

    const repos = raw
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        url: r.html_url,
        homepage: r.homepage,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        topics: r.topics || [],
        updatedAt: r.updated_at,
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    cache = { data: repos, fetchedAt: now };
    return res.json({ ok: true, cached: false, repos });
  } catch (err) {
    console.error("GitHub route error:", err.message);
    // Serve stale cache if we have it, otherwise fail gracefully
    if (cache.data) {
      return res.json({ ok: true, cached: true, stale: true, repos: cache.data });
    }
    return res.status(502).json({ ok: false, error: "Could not reach GitHub right now." });
  }
});

export default router;
