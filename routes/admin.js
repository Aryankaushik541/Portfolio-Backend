import { Router } from "express";
import Message     from "../models/Message.js";
import Project     from "../models/Project.js";
import SiteSettings from "../models/SiteSettings.js";
import SiteProfile  from "../models/SiteProfile.js";
import ChatSession  from "../models/ChatSession.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Every route below requires a valid admin JWT.
router.use(requireAuth);

/* ─────────────────────────── Dashboard stats ──────────────────────────── */
router.get("/stats", async (req, res) => {
  try {
    const [messageCount, unreadCount, projectCount, chatCount, unreadChatCount] =
      await Promise.all([
        Message.countDocuments(),
        Message.countDocuments({ read: false }),
        Project.countDocuments(),
        ChatSession.countDocuments(),
        ChatSession.countDocuments({ read: false }),
      ]);
    res.json({ ok: true, stats: { messageCount, unreadCount, projectCount, chatCount, unreadChatCount } });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load stats." });
  }
});

/* ─────────────────────────── Chat sessions ─────────────────────────────── */
router.get("/chats", async (req, res) => {
  try {
    const chats = await ChatSession.find()
      .sort({ updatedAt: -1 })
      .limit(200)
      .select("sessionId visitorName read createdAt updatedAt messages");
    res.json({ ok: true, chats });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load chats." });
  }
});

router.patch("/chats/:id/read", async (req, res) => {
  try {
    const chat = await ChatSession.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!chat) return res.status(404).json({ ok: false, error: "Chat not found." });
    res.json({ ok: true, chat });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid chat id." });
  }
});

router.delete("/chats/:id", async (req, res) => {
  try {
    const chat = await ChatSession.findByIdAndDelete(req.params.id);
    if (!chat) return res.status(404).json({ ok: false, error: "Chat not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid chat id." });
  }
});

/* ──────────────────────────── Messages ─────────────────────────────────── */
router.get("/messages", async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(200);
    res.json({ ok: true, messages });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load messages." });
  }
});

router.patch("/messages/:id/read", async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!msg) return res.status(404).json({ ok: false, error: "Message not found." });
    res.json({ ok: true, message: msg });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid message id." });
  }
});

router.delete("/messages/:id", async (req, res) => {
  try {
    const msg = await Message.findByIdAndDelete(req.params.id);
    if (!msg) return res.status(404).json({ ok: false, error: "Message not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid message id." });
  }
});

/* ──────────────────────────── Projects ─────────────────────────────────── */
router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ order: 1, createdAt: -1 });
    res.json({ ok: true, projects });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load projects." });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const { name, stack, url, points, order, visible } = req.body || {};
    if (!name || typeof name !== "string")
      return res.status(400).json({ ok: false, error: "Project name is required." });
    const project = await Project.create({
      name,
      stack:   Array.isArray(stack)  ? stack  : [],
      url,
      points:  Array.isArray(points) ? points : [],
      order:   Number(order) || 0,
      visible: visible !== false,
    });
    res.status(201).json({ ok: true, project });
  } catch {
    res.status(400).json({ ok: false, error: "Could not create project." });
  }
});

router.put("/projects/:id", async (req, res) => {
  try {
    const { name, stack, url, points, order, visible } = req.body || {};
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, stack, url, points, order, visible },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ ok: false, error: "Project not found." });
    res.json({ ok: true, project });
  } catch {
    res.status(400).json({ ok: false, error: "Could not update project." });
  }
});

router.delete("/projects/:id", async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ ok: false, error: "Project not found." });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: "Invalid project id." });
  }
});

/* ──────────────────────────── Settings ─────────────────────────────────── */
router.get("/settings", async (req, res) => {
  try {
    const settings = (await SiteSettings.findOne({ key: "main" })) || {};
    res.json({ ok: true, settings });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load settings." });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { name, title, summary, email, phone, whatsapp, github, linkedin, maintenanceMode } = req.body || {};
    const settings = await SiteSettings.findOneAndUpdate(
      { key: "main" },
      { name, title, summary, email, phone, whatsapp, github, linkedin, maintenanceMode },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ ok: true, settings });
  } catch {
    res.status(400).json({ ok: false, error: "Could not update settings." });
  }
});

/* ──────────────────────────── Site Profile ─────────────────────────────── */
// Full profile content (hero, skills, experience, education, certifications, SEO meta)
router.get("/profile", async (req, res) => {
  try {
    const profile = await SiteProfile.findOne({ key: "main" });
    res.json({ ok: true, profile: profile || {} });
  } catch {
    res.status(500).json({ ok: false, error: "Could not load profile." });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const ALLOWED = [
      "name", "title", "summary", "availableFor", "heroAccent",
      "email", "phone", "location", "github", "linkedin",
      "credentials", "skillGroups", "experience",
      "education", "certifications",
      "seoTitle", "seoDescription", "seoKeywords",
    ];
    const update = {};
    for (const f of ALLOWED) {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    }
    const profile = await SiteProfile.findOneAndUpdate(
      { key: "main" },
      update,
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ ok: true, profile });
  } catch (err) {
    res.status(400).json({ ok: false, error: "Could not update profile." });
  }
});

export default router;
