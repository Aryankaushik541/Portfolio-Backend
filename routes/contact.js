import { Router } from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        error: "Name, email, and message are required.",
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    }
    if (message.length > 3000) {
      return res.status(400).json({ ok: false, error: "Message is too long." });
    }

    // If MongoDB isn't configured, acknowledge but skip persistence
    if (mongoose.connection.readyState !== 1) {
      console.log("📩 Contact form (not persisted — no DB):", { name, email, subject });
      return res.status(201).json({ ok: true, stored: false });
    }

    const doc = await Message.create({ name, email, subject, message });
    return res.status(201).json({ ok: true, stored: true, id: doc._id });
  } catch (err) {
    console.error("Contact route error:", err.message);
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
});

export default router;
