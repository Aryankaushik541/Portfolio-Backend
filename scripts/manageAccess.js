// Manage who is allowed to log in (email allow-list). No passwords involved —
// being on this list (and isActive: true) is the only requirement to receive
// a login OTP.
//
// Usage:
//   node scripts/manageAccess.js add    someone@example.com "Optional Name"
//   node scripts/manageAccess.js remove someone@example.com
//   node scripts/manageAccess.js disable someone@example.com
//   node scripts/manageAccess.js enable  someone@example.com
//   node scripts/manageAccess.js list
import dotenv from "dotenv";
import mongoose from "mongoose";
import AllowedUser from "../models/AllowedUser.js";

dotenv.config();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set in .env");

  const [, , command, emailArg, ...rest] = process.argv;
  const email = emailArg ? emailArg.trim().toLowerCase() : null;

  if (!command || !["add", "remove", "disable", "enable", "list"].includes(command)) {
    console.log("Usage: node scripts/manageAccess.js <add|remove|disable|enable|list> [email] [name]");
    process.exit(1);
  }

  await mongoose.connect(uri);

  if (command === "list") {
    const users = await AllowedUser.find().sort({ createdAt: 1 });
    if (users.length === 0) console.log("No allowed users yet.");
    for (const u of users) {
      console.log(`${u.isActive ? "✅" : "🚫"} ${u.email}${u.name ? `  (${u.name})` : ""}  last login: ${u.lastLoginAt || "never"}`);
    }
    await mongoose.disconnect();
    return;
  }

  if (!email || !EMAIL_RE.test(email)) {
    throw new Error("A valid email is required for this command.");
  }

  if (command === "add") {
    const name = rest.join(" ").trim();
    const user = await AllowedUser.findOneAndUpdate(
      { email },
      { email, name: name || undefined, isActive: true },
      { upsert: true, new: true }
    );
    console.log(`✅ Access granted: ${user.email}`);
  } else if (command === "remove") {
    await AllowedUser.deleteOne({ email });
    console.log(`🗑️  Removed: ${email}`);
  } else if (command === "disable") {
    await AllowedUser.findOneAndUpdate({ email }, { isActive: false });
    console.log(`🚫 Disabled: ${email}`);
  } else if (command === "enable") {
    await AllowedUser.findOneAndUpdate({ email }, { isActive: true });
    console.log(`✅ Enabled: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌ Failed:", err.message);
  process.exit(1);
});
