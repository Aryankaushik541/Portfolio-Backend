import mongoose from "mongoose";

// "Training" for this application means a private knowledge base: uploaded
// examples/documents are provided as context whenever the assistant answers.
// This is the practical and safe alternative to trying to retrain Anthropic's
// hosted foundation model from an Express server.
const aiKnowledgeDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 100 },
    content: { type: String, required: true, maxlength: 200000 },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("AiKnowledgeDocument", aiKnowledgeDocumentSchema);
