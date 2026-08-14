import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ["bot", "user"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chatSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    visitorName: { type: String, trim: true, maxlength: 100, default: "" },
    messages: {
      type: [chatMessageSchema],
      default: [],
      validate: [(arr) => arr.length <= 200, "Conversation too long."],
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("ChatSession", chatSessionSchema);
