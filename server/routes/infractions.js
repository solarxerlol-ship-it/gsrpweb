/**
 * infractions.js — REST API for infraction CRUD.
 * Saves to MongoDB AND posts a Discord embed via bot token.
 * Rank requirements: moderator+ to add/remove, management+ to clear all.
 */

const express = require("express");
const router  = express.Router();
const { Infraction, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const {
  logInfractionToDiscord,
  logInfractionRemovedToDiscord,
  logInfractionsClearedToDiscord,
} = require("../discord");

// ── GET /api/infractions (all, paginated) — must come before /:userId ─────────
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

// ── POST /api/infractions ─────────────────────────────────────────────────────
router.post("/", requireAuth, requireLevel("moderator"), apiWriteLimiter, async (req, res) => {
  try {
    const { userId, type, reason, description } = req.body;
    if (!userId || !type || !reason) {
      return res.status(400).json({ error: "userId, type, and reason are required." });
    }

    const count  = await Infraction.countDocuments();
    const caseId = count + 1;
    const actor  = req.session.user;

    const record = await Infraction.create({
      userId, type, reason,
      description: description || "",
      moderator:   actor.discordId || actor.displayName,
      caseId,
      source:      "web",
      timestamp:   Date.now(),
    });

    // ── Log to audit DB ───────────────────────────────────────────────────────
    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "infraction_add",
      target:    userId,
      details:   { type, reason, caseId },
    });

    // ── Post Discord embed ────────────────────────────────────────────────────
    // Fire-and-forget — don't await so a Discord issue never delays the response
    logInfractionToDiscord({
      caseId,
      userId,
      type,
      reason,
      description,
      moderatorId:   actor.discordId,
      moderatorName: actor.displayName,
    });

    res.json(record.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/infractions/user/:userId/clear ───────────────────────────────
// Must be registered before /:caseId so the path doesn't get swallowed
router.delete("/user/:userId/clear", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const actor = req.session.user;
    await Infraction.deleteMany({ userId: req.params.userId });

    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "infractions_clear",
      target:    req.params.userId,
      details:   {},
    });

    logInfractionsClearedToDiscord({
      userId:        req.params.userId,
      moderatorId:   actor.discordId,
      moderatorName: actor.displayName,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/infractions/:caseId ──────────────────────────────────────────
router.delete("/:caseId", requireAuth, requireLevel("moderator"), apiWriteLimiter, async (req, res) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const actor  = req.session.user;
    const result = await Infraction.deleteOne({ caseId });
    if (!result.deletedCount) return res.status(404).json({ error: "Case not found." });

    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "infraction_remove",
      target:    String(caseId),
      details:   {},
    });

    logInfractionRemovedToDiscord({
      caseId,
      moderatorId:   actor.discordId,
      moderatorName: actor.displayName,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
