import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    stack: [{ type: String, trim: true, maxlength: 40 }],
    url: { type: String, trim: true, maxlength: 300 },
    points: [{ type: String, trim: true, maxlength: 300 }],
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);
