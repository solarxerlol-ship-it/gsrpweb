/**
 * infractions.js — REST API for infraction CRUD.
 * Rank requirements: moderator+ to add/remove, management+ to clear all.
 */

const express = require("express");
const router  = express.Router();
const { Infraction, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");

// ── GET /api/infractions/:userId ──────────────────────────────────────────────
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const records = await Infraction.find({ userId: req.params.userId })
      .sort({ timestamp: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/infractions (all, paginated) ─────────────────────────────────────
router.get("/", requireAuth, requireLevel("moderator"), async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 25;
    const query = req.query.search
      ? { $or: [{ userId: req.query.search }, { reason: { $regex: req.query.search, $options: "i" } }] }
      : {};
    const [records, total] = await Promise.all([
      Infraction.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Infraction.countDocuments(query),
    ]);
    res.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/infractions ─────────────────────────────────────────────────────
router.post("/", requireAuth, requireLevel("moderator"), apiWriteLimiter, async (req, res) => {
  try {
    const { userId, type, reason, description } = req.body;
    if (!userId || !type || !reason) {
      return res.status(400).json({ error: "userId, type, and reason are required." });
    }
    const count  = await Infraction.countDocuments();
    const caseId = count + 1;
    const record = await Infraction.create({
      userId, type, reason, description: description || "",
      moderator: req.session.user.discordId || req.session.user.displayName,
      caseId, source: "web", timestamp: Date.now(),
    });
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "infraction_add",
      target:    userId,
      details:   { type, reason, caseId },
    });
    res.json(record.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/infractions/:caseId ──────────────────────────────────────────
router.delete("/:caseId", requireAuth, requireLevel("moderator"), apiWriteLimiter, async (req, res) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const result = await Infraction.deleteOne({ caseId });
    if (!result.deletedCount) return res.status(404).json({ error: "Case not found." });
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "infraction_remove",
      target:    String(caseId),
      details:   {},
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/infractions/user/:userId/clear ───────────────────────────────
router.delete("/user/:userId/clear", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    await Infraction.deleteMany({ userId: req.params.userId });
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "infractions_clear",
      target:    req.params.userId,
      details:   {},
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
