import mongoose from "mongoose";

// Whitelist of people who are permitted to log in via email OTP.
// No password is stored anywhere — access is controlled purely by
// whether an email exists here (and is active).
const allowedUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, trim: true },
    role: { type: String, enum: ["admin"], default: "admin" },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("AllowedUser", allowedUserSchema);
