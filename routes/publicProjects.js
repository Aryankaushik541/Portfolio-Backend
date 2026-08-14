import { Router } from "express";
import Project from "../models/Project.js";
import SiteSettings from "../models/SiteSettings.js";

const router = Router();

router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find({ visible: true }).sort({ order: 1, createdAt: -1 });
    res.json({ ok: true, projects, source: projects.length ? "db" : "empty" });
  } catch (err) {
    res.json({ ok: true, projects: [], source: "unavailable" });
  }
});

// Public, read-only subset of site settings — used by the frontend to render
// the live WhatsApp number / contact links without a redeploy.
router.get("/settings", async (req, res) => {
  try {
    const settings = await SiteSettings.findOne({ key: "main" });
    if (!settings) return res.json({ ok: true, settings: null });
    const { name, title, summary, email, phone, whatsapp, github, linkedin, maintenanceMode } = settings;
    res.json({ ok: true, settings: { name, title, summary, email, phone, whatsapp, github, linkedin, maintenanceMode } });
  } catch (err) {
    res.json({ ok: true, settings: null });
  }
});

export default router;
