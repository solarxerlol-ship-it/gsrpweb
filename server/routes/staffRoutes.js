/**
 * staffRoutes.js — Staff management: password generation, user listing, shifts, LOAs.
 */

const express  = require("express");
const router   = express.Router();
const bcrypt   = require("bcryptjs");
const crypto   = require("node:crypto");
const { StaffUser, Shift, LOA, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const { logLOAToDiscord, logPasswordGeneratedToDiscord } = require("../discord");

// ── GET /api/staff/roster ─────────────────────────────────────────────────────
router.get("/roster", requireAuth, async (req, res) => {
  try {
    const users = await StaffUser.find({}, {
      passwordHash: 0,
    }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/staff/generate-password-bot (called by Discord bot) ─────────────
// Authenticated by shared secret in x-bot-secret header instead of session
router.post("/generate-password-bot", apiWriteLimiter, async (req, res) => {
  try {
    const secret = process.env.PORTAL_INTERNAL_SECRET;
    if (!secret || req.headers["x-bot-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized — invalid bot secret." });
    }

    const { username, accessLevel } = req.body;
    if (!username) return res.status(400).json({ error: "username is required." });

    const rawPassword = crypto.randomBytes(8).toString("hex");
    const hash        = await bcrypt.hash(rawPassword, 12);

    const user = await StaffUser.findOneAndUpdate(
      { username: username.toLowerCase() },
      {
        username:     username.toLowerCase(),
        passwordHash: hash,
        accessLevel:  accessLevel || "staff",
        generatedBy:  "bot",
        authMethod:   "password",
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      actorId:   "bot",
      actorName: "Discord Bot",
      action:    "password_generated",
      target:    username,
      details:   { accessLevel: user.accessLevel },
    });

    res.json({ username: user.username, password: rawPassword, accessLevel: user.accessLevel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/staff/generate-password ─────────────────────────────────────────
// Creates / resets a password-login user. Owner/Management only (web session).
router.post("/generate-password", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const { username, accessLevel } = req.body;
    if (!username) return res.status(400).json({ error: "username is required." });

    const rawPassword = crypto.randomBytes(8).toString("hex"); // 16-char hex
    const hash        = await bcrypt.hash(rawPassword, 12);

    const user = await StaffUser.findOneAndUpdate(
      { username: username.toLowerCase() },
      {
        username:     username.toLowerCase(),
        passwordHash: hash,
        accessLevel:  accessLevel || "staff",
        generatedBy:  req.session.user.discordId,
        authMethod:   "password",
      },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "password_generated",
      target:    username,
      details:   { accessLevel },
    });

    // Return the plaintext password ONCE — it is not stored
    res.json({ username: user.username, password: rawPassword, accessLevel: user.accessLevel });

    // Discord log (fire-and-forget)
    logPasswordGeneratedToDiscord({
      username,
      accessLevel: accessLevel || "staff",
      generatedById: req.session.user.discordId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/staff/:userId/access-level ─────────────────────────────────────
// Owner only can change access levels
router.patch("/:userId/access-level", requireAuth, requireLevel("owner"), apiWriteLimiter, async (req, res) => {
  try {
    const { accessLevel } = req.body;
    const VALID = ["owner", "management", "admin", "moderator", "staff"];
    if (!VALID.includes(accessLevel)) return res.status(400).json({ error: "Invalid access level." });

    const user = await StaffUser.findByIdAndUpdate(
      req.params.userId,
      { accessLevel },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found." });

    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "access_level_changed",
      target:    req.params.userId,
      details:   { accessLevel },
    });

    res.json({ success: true, accessLevel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shifts ────────────────────────────────────────────────────────────────────

router.post("/shift/start", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.discordId || req.session.user._id;
    const existing = await Shift.findOne({ discordId: userId, active: true });
    if (existing) return res.status(400).json({ error: "Shift already active." });

    const shift = await Shift.create({
      discordId: userId,
      username:  req.session.user.displayName,
    });
    res.json(shift.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shift/end", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.discordId || req.session.user._id;
    const shift = await Shift.findOne({ discordId: userId, active: true });
    if (!shift) return res.status(400).json({ error: "No active shift." });

    const endedAt  = Date.now();
    const duration = endedAt - shift.startedAt;
    await Shift.findByIdAndUpdate(shift._id, { endedAt, duration, active: false });
    res.json({ duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/shift/active", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.discordId || req.session.user._id;
    const shift = await Shift.findOne({ discordId: userId, active: true }).lean();
    res.json(shift || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/shifts/all", requireAuth, requireLevel("moderator"), async (req, res) => {
  try {
    const shifts = await Shift.find({ active: true }).lean();
    // Enrich with avatar from StaffUser
    const ids   = shifts.map(s => s.discordId).filter(Boolean);
    const users = await StaffUser.find({ discordId: { $in: ids } }).lean();
    const uMap  = Object.fromEntries(users.map(u => [u.discordId, u]));
    const enriched = shifts.map(s => ({
      ...s,
      discordAvatar: uMap[s.discordId]?.discordAvatar || null,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/shifts/top", requireAuth, async (req, res) => {
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const shifts = await Shift.find({ startedAt: { $gte: sevenDaysAgo }, active: false })
      .sort({ duration: -1 }).limit(50).lean();
    const map = {};
    for (const s of shifts) {
      if (!map[s.discordId]) map[s.discordId] = { discordId: s.discordId, username: s.username, total: 0 };
      map[s.discordId].total += s.duration || 0;
    }
    const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
    // Enrich with avatar
    const ids   = sorted.map(u => u.discordId).filter(Boolean);
    const users = await StaffUser.find({ discordId: { $in: ids } }).lean();
    const uMap  = Object.fromEntries(users.map(u => [u.discordId, u]));
    const enriched = sorted.map(u => ({
      ...u,
      discordAvatar: uMap[u.discordId]?.discordAvatar || null,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── LOA ───────────────────────────────────────────────────────────────────────

router.post("/loa", requireAuth, async (req, res) => {
  try {
    const { reason, startDate, endDate } = req.body;
    if (!reason || !startDate || !endDate) {
      return res.status(400).json({ error: "reason, startDate, endDate required." });
    }
    const userId = req.session.user.discordId || req.session.user._id;
    const loa = await LOA.create({
      discordId: userId,
      username:  req.session.user.displayName,
      reason, startDate, endDate,
    });
    res.json(loa.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All staff can see LOAs (own + others shown based on role in frontend)
router.get("/loa/all", requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.discordId || req.session.user._id;
    const isMod  = ["moderator","admin","management","owner"].includes(req.session.user.accessLevel);
    // Moderators+ see all; regular staff see only their own
    const query  = isMod ? {} : { discordId: userId };
    const loas   = await LOA.find(query).sort({ createdAt: -1 }).lean();
    res.json(loas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/loa/:id", requireAuth, requireLevel("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const loa = await LOA.findByIdAndUpdate(
      req.params.id,
      { status, approvedBy: req.session.user.discordId },
      { new: true }
    );
    if (!loa) return res.status(404).json({ error: "LOA not found." });

    // Discord log
    logLOAToDiscord({
      userId:     loa.discordId,
      username:   loa.username,
      reason:     loa.reason,
      startDate:  loa.startDate,
      endDate:    loa.endDate,
      status,
      approvedBy: req.session.user.discordId,
    });

    res.json(loa.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Audit Logs ────────────────────────────────────────────────────────────────

router.get("/audit", requireAuth, requireLevel("management"), async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const [records, total] = await Promise.all([
      AuditLog.find().sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);
    res.json({ records, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
