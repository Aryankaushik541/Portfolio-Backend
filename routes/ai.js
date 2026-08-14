import { Router } from "express";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import multer from "multer";
import mongoose from "mongoose";
import { requireAuth } from "../middleware/auth.js";
import AiKnowledgeDocument from "../models/AiKnowledgeDocument.js";

const router = Router();

// Only logged-in (allow-listed) users can reach this at all.
router.use(requireAuth);

const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many messages. Please slow down." },
});

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
const DEVELOPER_MODEL_NAME = "portfolio-developer";
const DEVELOPER_SYSTEM_PROMPT = `You are Portfolio Developer, a careful senior full-stack engineer.
Prioritize correct, secure, maintainable solutions. Before proposing a change, inspect the relevant code and state assumptions.
When writing code: provide complete runnable snippets, preserve existing project conventions, validate inputs, handle errors, and explain exact files/commands needed.
When debugging: identify the likely root cause, give a minimal fix first, then verification steps. Never invent APIs, package behavior, test results, or file contents.
For destructive, security-sensitive, deployment, payment, or data-loss actions, clearly warn the user and ask for confirmation.
Use concise Hindi/English (Hinglish) when the user writes in Hinglish.`;
// A smaller default improves time-to-first-answer and avoids wasting hosted
// model capacity. It can be raised with OPENAI_MAX_OUTPUT_TOKENS if needed.
const MAX_TOKENS = Math.min(Math.max(Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 2048, 256), 4096);
const MAX_HISTORY_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_KNOWLEDGE_CHARS = 60000;
const TEXT_FILE_TYPES = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
const TRAINING_EXTENSIONS = /\.(txt|md|markdown|csv|json)$/i;
const CHAT_EXTENSIONS = /\.(txt|md|markdown|csv|json|pdf|png|jpe?g|gif|webp)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    // Some browsers use application/octet-stream for .md/.csv, so accept a
    // small extension allow-list as well as known MIME types.
    const allowed = TEXT_FILE_TYPES.has(file.mimetype) || file.mimetype === "application/pdf" || file.mimetype.startsWith("image/") || CHAT_EXTENSIONS.test(file.originalname);
    callback(allowed ? null : new Error("Only text, CSV, JSON, PDF, and image files are supported."), allowed);
  },
});

function llmConfiguration() {
  const requestedProvider = (process.env.AI_PROVIDER || "auto").trim().toLowerCase();
  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  const hasUsableOpenAiKey = /^sk-/i.test(openaiKey);
  const isCloudDeployment = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
  const provider = requestedProvider === "auto" ? (hasUsableOpenAiKey ? "openai" : "ollama") : requestedProvider;

  if (!["openai", "ollama"].includes(provider)) return { error: "AI_PROVIDER must be auto, openai, or ollama." };
  if (provider === "ollama" && isCloudDeployment) {
    return { error: "Ollama is local-only. On Render, set AI_PROVIDER=openai and configure OPENAI_API_KEY." };
  }
  if (provider === "openai" && !hasUsableOpenAiKey) {
    return { error: "OPENAI_API_KEY is not a valid OpenAI API-key format. Add a key beginning with sk-, or set AI_PROVIDER=ollama." };
  }
  return provider === "openai"
    ? { provider, model: (process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim(), apiKey: openaiKey }
    : { provider, model: (process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim(), baseUrl: (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "") };
}

function ollamaMessages(messages, system) {
  return [{ role: "system", content: system }, ...messages.map((message) => ({
    role: message.role,
    content: typeof message.content === "string" ? message.content : message.content.filter((block) => block.type === "input_text").map((block) => block.text).join("\n"),
  }))];
}

function sanitizeHistory(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
}

function parseMessages(req) {
  if (typeof req.body?.messages === "string") {
    try {
      return JSON.parse(req.body.messages);
    } catch {
      return null;
    }
  }
  return req.body?.messages;
}

function attachmentBlocks(files) {
  return (files || []).map((file) => {
    if (file.mimetype === "application/pdf") {
      return { type: "input_file", filename: file.originalname, file_data: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` };
    }
    if (file.mimetype.startsWith("image/")) {
      return { type: "input_image", image_url: `data:${file.mimetype};base64,${file.buffer.toString("base64")}` };
    }
    return { type: "input_text", text: `Attached file: ${file.originalname}\n${file.buffer.toString("utf8").slice(0, 100000)}` };
  });
}

async function knowledgeContext() {
  if (mongoose.connection.readyState !== 1) return "";
  const docs = await AiKnowledgeDocument.find().sort({ updatedAt: -1 }).lean();
  let remaining = MAX_KNOWLEDGE_CHARS;
  const sections = [];
  for (const doc of docs) {
    if (remaining <= 0) break;
    const content = doc.content.slice(0, remaining);
    sections.push(`Source: ${doc.name}\n${content}`);
    remaining -= content.length;
  }
  return sections.length ? `Use the following private training knowledge when relevant. If it does not answer the question, say so; do not invent facts.\n\n${sections.join("\n\n---\n\n")}` : "";
}

router.get("/status", (req, res) => {
  const llm = llmConfiguration();
  return res.json({
    ok: true,
    configured: !llm.error,
    provider: llm.provider || null,
    model: llm.model || null,
    error: llm.error || null,
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

// Upload plain-text documents as a reusable knowledge base. This does not
// claim to fine-tune Claude; the documents are injected as bounded context.
router.post("/train", aiLimiter, upload.array("files", 3), async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ ok: false, error: "MongoDB is required to save training documents." });
  }
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ ok: false, error: "Upload at least one TXT, MD, CSV, or JSON file." });
  if (files.some((file) => !TEXT_FILE_TYPES.has(file.mimetype) && !TRAINING_EXTENSIONS.test(file.originalname))) {
    return res.status(400).json({ ok: false, error: "Training accepts TXT, MD, CSV, and JSON files. PDFs/images can be attached directly to chat." });
  }
  try {
    const documents = await AiKnowledgeDocument.insertMany(files.map((file) => ({
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      content: file.buffer.toString("utf8").slice(0, 200000),
    })));
    return res.status(201).json({ ok: true, trained: documents.map((doc) => ({ id: doc.id, name: doc.name, size: doc.size })) });
  } catch (err) {
    console.error("AI training upload error:", err.message);
    return res.status(500).json({ ok: false, error: "Could not save training documents." });
  }
});

router.get("/training-data", async (req, res) => {
  if (mongoose.connection.readyState !== 1) return res.json({ ok: true, documents: [] });
  const documents = await AiKnowledgeDocument.find().sort({ updatedAt: -1 }).select("name mimeType size createdAt updatedAt").lean();
  return res.json({ ok: true, documents });
});

// Creates a persistent Ollama-derived developer profile. This is an
// instruction-tuned local model layer, while /train supplies project-specific
// knowledge at request time. It never alters the base model's weights.
router.post("/train/developer-model", aiLimiter, async (req, res) => {
  const llm = llmConfiguration();
  if (llm.provider !== "ollama") {
    return res.status(400).json({ ok: false, error: "Developer model training is available when AI_PROVIDER is ollama." });
  }
  const baseModel = String(req.body?.baseModel || DEFAULT_OLLAMA_MODEL).trim();
  if (!/^[a-zA-Z0-9._:/-]{1,100}$/.test(baseModel)) {
    return res.status(400).json({ ok: false, error: "Invalid base model name." });
  }
  try {
    const upstream = await fetch(`${llm.baseUrl}/api/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEVELOPER_MODEL_NAME,
        from: baseModel,
        system: DEVELOPER_SYSTEM_PROMPT,
        parameters: { temperature: 0.2, num_ctx: 16384 },
        stream: false,
      }),
    });
    if (!upstream.ok) {
      const details = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({ ok: false, error: `Could not create developer model: ${details.slice(0, 300)}` });
    }
    return res.status(201).json({ ok: true, model: DEVELOPER_MODEL_NAME, baseModel, message: "Developer model created. Set OLLAMA_MODEL=portfolio-developer and restart the backend." });
  } catch (err) {
    return res.status(503).json({ ok: false, error: `Could not reach Ollama: ${err.message}` });
  }
});

// Streams the assistant's reply back to the browser as Server-Sent Events,
// so the frontend can render it token-by-token like the real Claude UI.
router.post("/chat", aiLimiter, upload.array("files", 5), async (req, res) => {
  const llm = llmConfiguration();
  if (llm.error) return res.status(500).json({ ok: false, error: llm.error });

  const messages = sanitizeHistory(parseMessages(req));
  if (messages.length === 0) {
    return res.status(400).json({ ok: false, error: "No message provided." });
  }
  if (messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ ok: false, error: "Last message must be from the user." });
  }

  const attachments = attachmentBlocks(req.files);
  if (attachments.length) {
    const last = messages.length - 1;
    messages[last] = { role: "user", content: [{ type: "input_text", text: messages[last].content }, ...attachments] };
  }
  const trainingContext = await knowledgeContext().catch((err) => {
    console.error("AI knowledge lookup failed:", err.message);
    return "";
  });
  const system = ["You are a helpful, concise assistant embedded in a personal portfolio site. Be friendly and clear.", trainingContext].filter(Boolean).join("\n\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let upstream;
  try {
    const openAiRequest = llm.provider === "openai";
    upstream = await fetch(openAiRequest ? "https://api.openai.com/v1/responses" : `${llm.baseUrl}/api/chat`, {
      method: "POST",
      headers: openAiRequest ? { "Content-Type": "application/json", Authorization: `Bearer ${llm.apiKey}` } : { "Content-Type": "application/json" },
      body: JSON.stringify(openAiRequest
        ? { model: llm.model, instructions: system, input: messages, max_output_tokens: MAX_TOKENS, stream: true, store: false }
        : { model: llm.model, messages: ollamaMessages(messages, system), stream: true, options: { num_predict: MAX_TOKENS } }),
    });
  } catch (err) {
    console.error(`${llm.provider} request failed:`, err.message);
    send("error", { error: llm.provider === "ollama" ? `Could not reach Ollama at ${llm.baseUrl}. Install Ollama, start it, then run: ollama pull ${llm.model}` : "Could not reach the AI service." });
    return res.end();
  }

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error(`${llm.provider} API error:`, upstream.status, errText.slice(0, 300));
    const apiMessage = (() => { try { return JSON.parse(errText).error?.message; } catch { return null; } })();
    send("error", { error: apiMessage || `The ${llm.provider} service returned an error (HTTP ${upstream.status}).` });
    return res.end();
  }

  // node-fetch exposes `body` as a plain Node.js Readable stream (not the
  // browser's WHATWG ReadableStream), so we consume it with an async iterator.
  let buffer = "";

  res.on("close", () => {
    try {
      upstream.body.destroy();
    } catch {
      /* no-op */
    }
  });

  try {
    for await (const chunk of upstream.body) {
      buffer += chunk.toString("utf8");

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (llm.provider === "openai") {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "response.output_text.delta") send("delta", { text: event.delta });
            if (event.type === "response.completed" || event.type === "response.done") send("done", {});
            if (event.type === "error" || event.type === "response.failed") send("error", { error: event.error?.message || "OpenAI stream error." });
          } catch { /* ignore malformed stream events */ }
          continue;
        }
        if (llm.provider === "ollama") {
          try {
            const event = JSON.parse(line);
            if (event.message?.content) send("delta", { text: event.message.content });
            if (event.done) send("done", {});
          } catch { /* ignore incomplete JSON */ }
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          send("delta", { text: event.delta.text });
        } else if (event.type === "message_stop") {
          send("done", {});
        } else if (event.type === "error") {
          send("error", { error: event.error?.message || "AI stream error." });
        }
      }
    }
  } catch (err) {
    console.error("Stream read error:", err.message);
    send("error", { error: "Connection interrupted." });
  }

  res.end();
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: "Upload limit exceeded: maximum 5 files, 5 MB each." });
  }
  if (err?.message) return res.status(400).json({ ok: false, error: err.message });
  return next(err);
});

export default router;
