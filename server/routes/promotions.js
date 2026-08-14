/**
 * promotions.js — REST API for promotion/demotion records.
 * Saves to MongoDB AND posts a Discord embed via bot token.
 * Rank requirement: admin+ to log promotions.
 */

const express = require("express");
const router  = express.Router();
const { Promotion, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const { logPromotionToDiscord } = require("../discord");

// ── GET /api/promotions (all, paginated) ──────────────────────────────────────
router.get("/", requireAuth, requireLevel("admin"), async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 25;
    const [records, total] = await Promise.all([
      Promotion.find().sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Promotion.countDocuments(),
    ]);
    res.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/promotions/:userId ───────────────────────────────────────────────
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const records = await Promotion.find({ userId: req.params.userId })
      .sort({ timestamp: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/promotions ──────────────────────────────────────────────────────
router.post("/", requireAuth, requireLevel("admin"), apiWriteLimiter, async (req, res) => {
  try {
    const { userId, fromRole, toRole, type, reason, notes, fromDept, toDept } = req.body;
    if (!userId || !toRole || !type) {
      return res.status(400).json({ error: "userId, toRole, and type are required." });
    }

    const actor = req.session.user;

    const record = await Promotion.create({
      userId, fromRole, toRole, type, reason, notes,
      fromDept, toDept,
      executor:   actor.discordId || actor.displayName,
      approvedBy: actor.discordId || actor.displayName,
      source:     "web",
      timestamp:  Date.now(),
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    `promotion_${type}`,
      target:    userId,
      details:   { fromRole, toRole },
    });

    // ── Discord embed ─────────────────────────────────────────────────────────
    logPromotionToDiscord({
      userId, type, fromRole, toRole, reason, notes,
      executorId:   actor.discordId,
      executorName: actor.displayName,
    });

    res.json(record.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
