import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import AllowedUser from "../models/AllowedUser.js";
import OtpToken from "../models/OtpToken.js";
import { sendOtpEmail } from "../utils/mailer.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MINUTES = 10;
const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 45;

// ── Rate limiters ────────────────────────────────────────────────────────────
// Per-IP limits on top of the per-email cooldown below, so an attacker can't
// hammer the endpoint from one IP even while cycling through email addresses.
const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests. Please try again later." },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many attempts. Please try again later." },
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp() {
  // Cryptographically secure 6-digit code (000000–999999), zero-padded.
  const n = crypto.randomInt(0, 10 ** OTP_LENGTH);
  return String(n).padStart(OTP_LENGTH, "0");
}

// ── Step 1: request an OTP ───────────────────────────────────────────────────
router.post("/request-otp", requestOtpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    }

    // Generic response either way — never reveal whether an email is on the
    // allow-list, to prevent attackers from enumerating valid accounts.
    const genericResponse = {
      ok: true,
      message: "If this email has access, a sign-in code has been sent to it.",
    };

    const user = await AllowedUser.findOne({ email, isActive: true });
    if (!user) {
      return res.json(genericResponse);
    }

    // Enforce a resend cooldown per email so the inbox / mail provider can't
    // be spammed with codes.
    const recent = await OtpToken.findOne({ email, consumed: false }).sort({ createdAt: -1 });
    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        return res.json(genericResponse); // still generic, but effectively a no-op
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Invalidate any previous unused codes for this email before issuing a new one.
    await OtpToken.updateMany({ email, consumed: false }, { $set: { consumed: true } });

    const otpRecord = await OtpToken.create({
      email,
      otpHash,
      expiresAt,
      maxAttempts: MAX_ATTEMPTS,
      ip: req.ip,
    });

    try {
      await sendOtpEmail({ to: email, otp, minutesValid: OTP_TTL_MINUTES });
    } catch (mailErr) {
      console.error("Failed to send OTP email:", mailErr.message);
      // Do not leave an unsent OTP behind: it would trigger the resend
      // cooldown and make a correctly fixed SMTP configuration appear broken.
      await OtpToken.updateOne({ _id: otpRecord._id }, { $set: { consumed: true } }).catch(() => {});
      return res.status(500).json({ ok: false, error: "Could not send the email. Please try again shortly." });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error("request-otp error:", err.message);
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
});

// ── Step 2: verify the OTP and issue a session token ────────────────────────
router.post("/verify-otp", verifyOtpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!email || !EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ ok: false, error: "Enter the 6-digit code sent to your email." });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set.");
      return res.status(500).json({ ok: false, error: "Server misconfiguration." });
    }

    const record = await OtpToken.findOne({ email, consumed: false }).sort({ createdAt: -1 });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ ok: false, error: "Code expired or invalid. Request a new one." });
    }

    if (record.attempts >= record.maxAttempts) {
      record.consumed = true;
      await record.save();
      return res.status(429).json({ ok: false, error: "Too many incorrect attempts. Request a new code." });
    }

    const valid = await bcrypt.compare(otp, record.otpHash);

    if (!valid) {
      record.attempts += 1;
      await record.save();
      return res.status(401).json({ ok: false, error: "Incorrect code. Please try again." });
    }

    // Success — burn the code immediately so it can never be reused.
    record.consumed = true;
    await record.save();

    const user = await AllowedUser.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Access not permitted for this email." });
    }

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({ ok: true, token, email: user.email });
  } catch (err) {
    console.error("verify-otp error:", err.message);
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
});

export default router;
