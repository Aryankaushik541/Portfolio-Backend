import mongoose from "mongoose";

// Single-document collection: there is only ever one settings doc (singleton),
// found/created by the fixed key below.
const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    name: { type: String, trim: true, maxlength: 100 },
    title: { type: String, trim: true, maxlength: 150 },
    summary: { type: String, trim: true, maxlength: 1000 },
    email: { type: String, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, maxlength: 30 },
    whatsapp: { type: String, trim: true, maxlength: 30 },
    github: { type: String, trim: true, maxlength: 200 },
    linkedin: { type: String, trim: true, maxlength: 200 },
    maintenanceMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("SiteSettings", siteSettingsSchema);
