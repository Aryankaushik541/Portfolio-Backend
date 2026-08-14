import { Router } from "express";
import mongoose from "mongoose";
import ChatSession from "../models/ChatSession.js";

const router = Router();

const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

// Appends one or more messages to a chat session, creating it if new.
// The frontend chatbot widget calls this after every exchange so the
// conversation shows up live in the admin dashboard.
router.post("/message", async (req, res) => {
  try {
    const { sessionId, messages, visitorName } = req.body || {};

    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      return res.status(400).json({ ok: false, error: "Invalid session id." });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: "No messages provided." });
    }

    const cleanMessages = messages
      .filter((m) => m && (m.from === "bot" || m.from === "user") && typeof m.text === "string")
      .map((m) => ({ from: m.from, text: m.text.slice(0, 2000), at: new Date() }))
      .slice(0, 20);

    if (cleanMessages.length === 0) {
      return res.status(400).json({ ok: false, error: "No valid messages provided." });
    }

    if (mongoose.connection.readyState !== 1) {
      // No DB configured — acknowledge without persisting so the widget
      // doesn't error out in local/dev environments without Mongo.
      return res.json({ ok: true, stored: false });
    }

    const update = {
      $push: { messages: { $each: cleanMessages } },
      $set: { read: false },
    };
    if (visitorName) update.$set.visitorName = String(visitorName).slice(0, 100);

    await ChatSession.findOneAndUpdate({ sessionId }, update, {
      upsert: true,
      setDefaultsOnInsert: true,
    });

    return res.json({ ok: true, stored: true });
  } catch (err) {
    console.error("Chat log route error:", err.message);
    return res.status(500).json({ ok: false, error: "Could not save conversation." });
  }
});

export default router;
