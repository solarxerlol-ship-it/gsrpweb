/**
 * infractions.js — Infraction CRUD API.
 *
 * When adding an infraction via the web portal, we:
 *   1. Save to MongoDB
 *   2. Post a Discord embed directly (discord.js)
 *   3. Notify the bot via its internal webhook so it can run /infraction-add
 *      logic (e.g. DM the user, post in the bot's own format)
 *
 * Access:
 *   GET    /api/infractions          — moderator+
 *   GET    /api/infractions/:userId  — any staff
 *   POST   /api/infractions          — moderator+  (add)
 *   DELETE /api/infractions/:caseId  — moderator+  (remove one)
 *   DELETE /api/infractions/user/:userId/clear — management+ (clear all)
 */

const express = require("express");
const axios   = require("axios");
const router  = express.Router();
const { Infraction, AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const {
  logInfractionToDiscord,
  logInfractionRemovedToDiscord,
  logInfractionsClearedToDiscord,
} = require("../discord");

// ── Notify bot to run /infraction-add equivalent ──────────────────────────────
// The bot exposes a tiny internal HTTP endpoint on PORTAL_BOT_URL.
// Fire-and-forget — a bot being offline never blocks the web portal.
async function notifyBot(payload) {
  const botUrl = process.env.PORTAL_BOT_URL;
  const secret = process.env.PORTAL_INTERNAL_SECRET;
  if (!botUrl || !secret) return; // bot webhook not configured — skip silently

  try {
    await axios.post(`${botUrl}/internal/infraction`, payload, {
      headers: {
        "x-portal-secret": secret,
        "Content-Type": "application/json",
      },
      timeout: 4000,
    });
    console.log(`[Infractions] Bot notified for case #${payload.caseId}`);
  } catch (err) {
    // Bot offline or misconfigured — log and move on
    console.warn(`[Infractions] Bot notify failed (case #${payload.caseId}):`, err.message);
  }
}

// ── GET /api/infractions — paginated list, any authenticated staff ────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const query = {};

    // Filter by source if provided (e.g. source=web for portal-logged only)
    if (req.query.source) {
      query.source = req.query.source;
    }

    if (req.query.search) {
      query.$or = [
        { userId: req.query.search },
        { reason: { $regex: req.query.search, $options: "i" } },
      ];
    }

    const [records, total] = await Promise.all([
      Infraction.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Infraction.countDocuments(query),
    ]);
    res.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/infractions/:userId — any staff can look up a user ───────────────
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const records = await Infraction.find({ userId: req.params.userId })
      .sort({ timestamp: -1 }).lean();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/infractions — add infraction, moderator+ ────────────────────────
router.post("/", requireAuth, requireLevel("moderator"), apiWriteLimiter, async (req, res) => {
  try {
    const { userId, type, reason, description } = req.body;
    if (!userId || !type || !reason)
      return res.status(400).json({ error: "userId, type, and reason are required." });

    const actor  = req.session.user;
    const caseId = (await Infraction.countDocuments()) + 1;

    const record = await Infraction.create({
      userId,
      robloxUserId:    req.body.robloxUserId || null,
      robloxAvatarUrl: req.body.robloxAvatarUrl || null,
      type:        type.toUpperCase(),
      reason,
      description: description || "",
      moderator:   actor.discordId || actor.displayName,
      caseId,
      source:      "web",
      timestamp:   Date.now(),
    });

    // ── Audit log ─────────────────────────────────────────────────────────────
    await AuditLog.create({
      actorId:   actor.discordId,
      actorName: actor.displayName,
      action:    "infraction_add",
      target:    userId,
      details:   { type, reason, caseId },
    });

    const botPayload = {
      caseId,
      userId,
      type:          type.toUpperCase(),
      reason,
      description:   description || "",
      moderatorId:   actor.discordId,
      moderatorName: actor.displayName,
    };

    // ── Always log to Discord. For web portal infractions, post the embed
    // directly. Also notify the bot (for DMs etc.) if it's configured.
    logInfractionToDiscord(botPayload);
    if (process.env.PORTAL_BOT_URL && process.env.PORTAL_INTERNAL_SECRET) {
      notifyBot(botPayload);
    }

    res.json(record.toObject());
  } catch (err) {
    console.error("[Infractions] POST error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/infractions/user/:userId/clear — management+ ─────────────────
// Must be registered BEFORE /:caseId so the path isn't swallowed
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

// ── DELETE /api/infractions/:caseId — moderator+ ─────────────────────────────
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
