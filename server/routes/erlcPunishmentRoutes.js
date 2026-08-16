/**
 * erlcPunishmentRoutes.js — ERLC in-game punishment log.
 * Completely separate from the bot infractions system.
 *
 * GET  /api/erlc-punishments        — any authenticated staff (read the feed)
 * POST /api/erlc-punishments        — moderator+ (log a punishment)
 * DELETE /api/erlc-punishments/:id  — moderator+ (remove a record)
 */

const express = require("express");
const router  = express.Router();
const { ErlcPunishment, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const { logInfractionToDiscord } = require("../discord");

// ── GET — all staff can read ──────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const page  = Math.max(1, parseInt(req.query.page)   || 1);
    const query = {};
    if (req.query.userId) query.userId = req.query.userId;
    const [records, total] = await Promise.all([
      ErlcPunishment.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ErlcPunishment.countDocuments(query),
    ]);
    res.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST — any authenticated staff ───────────────────────────────────────────
router.post("/", requireAuth, apiWriteLimiter, async (req, res) => {
  try {
    const { userId, robloxUserId, robloxAvatarUrl, type, reason, description } = req.body;
    if (!userId || !type || !reason)
      return res.status(400).json({ error: "userId, type, and reason are required." });

    const actor = req.session.user;

    const record = await ErlcPunishment.create({
      userId,
      robloxUserId:    robloxUserId   || null,
      robloxAvatarUrl: robloxAvatarUrl || null,
      type:            type.toLowerCase(),
      reason,
      description:     description || "",
      moderator:       actor.displayName,
      moderatorId:     actor.discordId || null,
      timestamp:       Date.now(),
    });

    // Audit trail
    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "erlc_punishment_add",
      target:    userId,
      details:   { type, reason },
    });

    // Post Discord embed to infraction log channel
    logInfractionToDiscord({
      caseId:        record._id.toString().slice(-6).toUpperCase(),
      userId,
      type,
      reason,
      description:   description || "",
      moderatorId:   actor.discordId,
      moderatorName: actor.displayName,
    });

    res.json(record.toObject());
  } catch (err) {
    console.error("[ErlcPunishments] POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE — any authenticated staff ─────────────────────────────────────────
router.delete("/:id", requireAuth, apiWriteLimiter, async (req, res) => {
  try {
    const actor  = req.session.user;
    const result = await ErlcPunishment.deleteOne({ _id: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ error: "Record not found." });

    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "erlc_punishment_remove",
      target:    req.params.id,
      details:   {},
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
