import mongoose from "mongoose";

const expSchema = new mongoose.Schema({
  role:   { type: String, maxlength: 200 },
  org:    { type: String, maxlength: 200 },
  period: { type: String, maxlength: 100 },
  points: [{ type: String, maxlength: 500 }],
}, { _id: false });

const eduSchema = new mongoose.Schema({
  degree: { type: String, maxlength: 200 },
  school: { type: String, maxlength: 200 },
  period: { type: String, maxlength: 100 },
  note:   { type: String, maxlength: 100 },
}, { _id: false });

const skillGroupSchema = new mongoose.Schema({
  label: { type: String, maxlength: 60 },
  items: [{ type: String, maxlength: 80 }],
}, { _id: false });

const schema = new mongoose.Schema(
  {
    key:          { type: String, default: "main", unique: true },
    name:         { type: String, maxlength: 100 },
    title:        { type: String, maxlength: 150 },
    summary:      { type: String, maxlength: 2000 },
    availableFor: { type: String, default: "AVAILABLE FOR OPPORTUNITIES", maxlength: 100 },
    heroAccent:   { type: String, default: "MERN", maxlength: 50 },
    email:        { type: String, maxlength: 150 },
    phone:        { type: String, maxlength: 30 },
    location:     { type: String, maxlength: 100 },
    github:       { type: String, maxlength: 200 },
    linkedin:     { type: String, maxlength: 200 },
    credentials:  [{ type: String, maxlength: 150 }],
    skillGroups:  [skillGroupSchema],
    experience:   [expSchema],
    education:    [eduSchema],
    certifications: [{ type: String, maxlength: 300 }],
    seoTitle:       { type: String, maxlength: 70 },
    seoDescription: { type: String, maxlength: 160 },
    seoKeywords:    { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

export default mongoose.model("SiteProfile", schema);
