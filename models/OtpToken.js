import mongoose from "mongoose";

// Short-lived, single-use OTP codes for email login.
// The raw code is NEVER stored — only a bcrypt hash of it — so a database
// leak alone cannot be used to log in.
const otpTokenSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    consumed: { type: Boolean, default: false },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — Mongo automatically deletes expired OTP documents on its own,
// so stale/used codes don't linger in the database.
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OtpToken", otpTokenSchema);
