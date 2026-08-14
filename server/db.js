/**
 * db.js — Shared MongoDB connection + all models for the staff portal.
 * Reuses the same database as the Discord bot.
 */

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("[DB] Connected to MongoDB"))
  .catch(err => console.error("[DB] Connection error:", err));

// ── Infraction ────────────────────────────────────────────────────────────────
const infractionSchema = new mongoose.Schema({
  userId:      String,
  caseId:      Number,
  type:        String,
  reason:      String,
  description: String,
  moderator:   String,    // Discord user ID
  guild:       String,
  source:      { type: String, default: "bot" }, // "bot" | "web"
  timestamp:   { type: Number, default: () => Date.now() },
});

// ── Promotion ─────────────────────────────────────────────────────────────────
const promotionSchema = new mongoose.Schema({
  userId:     String,
  fromRole:   String,
  toRole:     String,
  fromDept:   String,
  toDept:     String,
  notes:      String,
  reason:     String,
  approvedBy: String,
  executor:   String,
  type:       String,
  source:     { type: String, default: "bot" },
  timestamp:  { type: Number, default: () => Date.now() },
});

// ── Staff Portal User ─────────────────────────────────────────────────────────
const staffUserSchema = new mongoose.Schema({
  discordId:     { type: String, unique: true, sparse: true },
  username:      String,   // for password login
  passwordHash:  String,
  generatedBy:   String,   // Discord ID of whoever generated the password
  accessLevel:   { type: String, enum: ["owner", "management", "admin", "moderator", "staff"], default: "staff" },
  discordUsername: String,
  discordAvatar:   String,
  discordRoles:    [String],
  authMethod:    { type: String, enum: ["discord", "password"] },
  lastLogin:     Number,
  createdAt:     { type: Number, default: () => Date.now() },
});

// ── Shift ─────────────────────────────────────────────────────────────────────
const shiftSchema = new mongoose.Schema({
  discordId:   String,
  username:    String,
  startedAt:   { type: Number, default: () => Date.now() },
  endedAt:     { type: Number, default: null },
  duration:    { type: Number, default: null }, // ms
  active:      { type: Boolean, default: true },
});

// ── LOA ───────────────────────────────────────────────────────────────────────
const loaSchema = new mongoose.Schema({
  discordId:  String,
  username:   String,
  reason:     String,
  startDate:  Number,
  endDate:    Number,
  approved:   { type: Boolean, default: false },
  approvedBy: String,
  status:     { type: String, enum: ["pending", "approved", "denied", "expired"], default: "pending" },
  createdAt:  { type: Number, default: () => Date.now() },
});

// ── Audit Log ─────────────────────────────────────────────────────────────────
const auditSchema = new mongoose.Schema({
  actorId:    String,
  actorName:  String,
  action:     String,
  target:     String,
  details:    mongoose.Schema.Types.Mixed,
  timestamp:  { type: Number, default: () => Date.now() },
});

// ── Portal Announcement ───────────────────────────────────────────────────────
const announcementSchema = new mongoose.Schema({
  title:      String,
  content:    String,
  authorId:   String,
  authorName: String,
  pinned:     { type: Boolean, default: false },
  createdAt:  { type: Number, default: () => Date.now() },
});

// ── Models ────────────────────────────────────────────────────────────────────
const Infraction   = mongoose.models.Infraction   || mongoose.model("Infraction",   infractionSchema);
const Promotion    = mongoose.models.Promotion    || mongoose.model("Promotion",    promotionSchema);
const StaffUser    = mongoose.models.StaffUser    || mongoose.model("StaffUser",    staffUserSchema);
const Shift        = mongoose.models.Shift        || mongoose.model("Shift",        shiftSchema);
const LOA          = mongoose.models.LOA          || mongoose.model("LOA",          loaSchema);
const AuditLog     = mongoose.models.AuditLog     || mongoose.model("AuditLog",     auditSchema);
const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);

module.exports = { Infraction, Promotion, StaffUser, Shift, LOA, AuditLog, Announcement };
