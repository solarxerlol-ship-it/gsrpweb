/**
 * db.js — MongoDB connection + all Mongoose models.
 * Uses a cached connection so Vercel serverless functions
 * don't open a new connection on every cold start.
 */

const mongoose = require("mongoose");

// Cache connection across serverless invocations
let _conn = null;

async function connect() {
  if (_conn && mongoose.connection.readyState === 1) return _conn;

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI environment variable is not set");
  }

  _conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  console.log("[DB] Connected to MongoDB");
  return _conn;
}

// Start connection immediately (non-blocking — errors logged, not thrown)
connect().catch(err => console.error("[DB] Connection error:", err.message));

// ── Schemas ───────────────────────────────────────────────────────────────────

const infractionSchema = new mongoose.Schema({
  userId:          String,   // Roblox username
  robloxUserId:    String,   // Roblox numeric ID (for avatar fetching)
  robloxAvatarUrl: String,   // cached headshot URL
  caseId:          Number,
  type:            String,
  reason:          String,
  description:     String,
  moderator:       String,
  guild:           String,
  source:          { type: String, default: "bot" },
  timestamp:       { type: Number, default: () => Date.now() },
});

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

const staffUserSchema = new mongoose.Schema({
  discordId:       { type: String, unique: true, sparse: true },
  username:        String,
  passwordHash:    String,
  generatedBy:     String,
  accessLevel:     { type: String, enum: ["owner","management","admin","moderator","staff"], default: "staff" },
  numericLevel:    { type: Number, default: 20 },
  roleLabel:       { type: String, default: "" },
  roleColor:       { type: String, default: "#22c55e" },
  discordUsername: String,
  discordAvatar:   String,
  discordRoles:    [String],
  authMethod:      { type: String, enum: ["discord","password"] },
  lastLogin:       Number,
  createdAt:       { type: Number, default: () => Date.now() },
});

const shiftSchema = new mongoose.Schema({
  discordId: String,
  username:  String,
  startedAt: { type: Number, default: () => Date.now() },
  endedAt:   { type: Number, default: null },
  duration:  { type: Number, default: null },
  active:    { type: Boolean, default: true },
});

const loaSchema = new mongoose.Schema({
  discordId:  String,
  username:   String,
  reason:     String,
  startDate:  Number,
  endDate:    Number,
  approved:   { type: Boolean, default: false },
  approvedBy: String,
  status:     { type: String, enum: ["pending","approved","denied","expired"], default: "pending" },
  createdAt:  { type: Number, default: () => Date.now() },
});

const auditSchema = new mongoose.Schema({
  actorId:   String,
  actorName: String,
  action:    String,
  target:    String,
  details:   mongoose.Schema.Types.Mixed,
  timestamp: { type: Number, default: () => Date.now() },
});

const announcementSchema = new mongoose.Schema({
  title:      String,
  content:    String,
  authorId:   String,
  authorName: String,
  pinned:     { type: Boolean, default: false },
  createdAt:  { type: Number, default: () => Date.now() },
});

const applicationSchema = new mongoose.Schema({
  robloxUsername:  { type: String, required: true },
  discordUsername: { type: String, required: true },
  discordId:       { type: String, required: true },
  age:             { type: String, required: true },
  department:      { type: String, required: true },
  experience:      { type: String, required: true },
  whyJoin:         { type: String, required: true },
  rpMeaning:       { type: String, required: true },
  extra:           { type: String, default: '' },
  status:          { type: String, enum: ['pending','accepted','denied'], default: 'pending' },
  reviewedBy:      { type: String, default: null },
  createdAt:       { type: Number, default: () => Date.now() },
  reviewedAt:      { type: Number, default: null },
});

// ── Models (safe re-use across hot reloads) ───────────────────────────────────
const Infraction   = mongoose.models.Infraction   || mongoose.model("Infraction",   infractionSchema);
const Promotion    = mongoose.models.Promotion    || mongoose.model("Promotion",    promotionSchema);
const StaffUser    = mongoose.models.StaffUser    || mongoose.model("StaffUser",    staffUserSchema);
const Shift        = mongoose.models.Shift        || mongoose.model("Shift",        shiftSchema);
const LOA          = mongoose.models.LOA          || mongoose.model("LOA",          loaSchema);
const AuditLog     = mongoose.models.AuditLog     || mongoose.model("AuditLog",     auditSchema);
const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
const Application  = mongoose.models.Application  || mongoose.model("Application",  applicationSchema);

module.exports = { connect, Infraction, Promotion, StaffUser, Shift, LOA, AuditLog, Announcement, Application };
