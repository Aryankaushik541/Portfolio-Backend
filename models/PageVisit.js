import mongoose from "mongoose";

const schema = new mongoose.Schema({
  path:     { type: String, required: true, maxlength: 200 },
  referrer: { type: String, default: "",    maxlength: 200 },
  ua:       { type: String, default: "",    maxlength: 300 },
  ip:       { type: String, default: "",    maxlength: 45  },
  createdAt:{ type: Date,   default: Date.now },
});

// Auto-delete visits older than 90 days to keep DB lean
schema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });
schema.index({ path: 1, createdAt: -1 });

export default mongoose.model("PageVisit", schema);
