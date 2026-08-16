/**
 * applicationRoutes.js
 * POST /api/applications       — public submit (no auth required)
 * GET  /api/applications       — management+ view all
 * PATCH /api/applications/:id  — management+ accept/deny (triggers bot DM)
 */

const express = require("express");
const router  = express.Router();
const { Application } = require("../db");
const { requireAuth, requireLevel } = require("../middleware");

// ── Rate limit public submissions (simple in-memory per IP) ──────────────────
const submissionCooldown = new Map();
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 day per IP

// ── POST /api/applications — public form submit ───────────────────────────────
router.post("/", async (req, res) => {
  try {
    const ip = req.ip;
    const now = Date.now();
    if (submissionCooldown.has(ip) && now - submissionCooldown.get(ip) < COOLDOWN_MS) {
      return res.status(429).json({ error: "You already submitted an application recently. Please wait 24 hours." });
    }

    const { robloxUsername, discordUsername, discordId, age, department, experience, whyJoin, scenario1, scenario2, scenario3, mcAnswers, rpMeaning, extra } = req.body;

    if (!robloxUsername || !discordUsername || !discordId || !age || !department || !experience) {
      return res.status(400).json({ error: "Please fill in all required fields." });
    }
    if (!/^\d{17,19}$/.test(discordId)) {
      return res.status(400).json({ error: "Discord User ID must be a 17–19 digit number." });
    }

    // Check for duplicate pending application from same Discord ID
    const existing = await Application.findOne({ discordId, status: "pending" });
    if (existing) {
      return res.status(409).json({ error: "You already have a pending application." });
    }

    const app = await Application.create({
      robloxUsername:  robloxUsername.trim(),
      discordUsername: discordUsername.trim(),
      discordId:       discordId.trim(),
      age,
      department:      req.body.department || 'Staff',
      experience:      req.body.experience || '',
      timezone:        req.body.timezone   || '',
      mcAnswers:       req.body.mcAnswers  || {},
      scenario1:  (req.body.scenario1  || '').trim(),
      scenario2:  (req.body.scenario2  || '').trim(),
      scenario3:  (req.body.scenario3  || '').trim(),
      scenario4:  (req.body.scenario4  || '').trim(),
      scenario5:  (req.body.scenario5  || '').trim(),
      whyJoin:    (req.body.whyJoin    || '').trim(),
      strength:   (req.body.strength   || '').trim(),
      weakness:   (req.body.weakness   || '').trim(),
      availability:(req.body.availability||'').trim(),
      prevStaff:  (req.body.prevStaff  || '').trim(),
      bans:       (req.body.bans       || '').trim(),
      extra:      (req.body.extra      || '').trim(),
      rpMeaning:  (req.body.rpMeaning  || '').trim(),
    });

    submissionCooldown.set(ip, now);

    res.status(201).json({ success: true, id: app._id });
  } catch (err) {
    console.error("[Applications] POST error:", err.message);
    res.status(500).json({ error: "Failed to submit application." });
  }
});

// ── GET /api/applications — management+ ──────────────────────────────────────
router.get("/", requireAuth, requireLevel("management"), async (req, res) => {
  try {
    const apps = await Application.find().sort({ createdAt: -1 }).lean();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch applications." });
  }
});

// ── PATCH /api/applications/:id — accept or deny ─────────────────────────────
router.patch("/:id", requireAuth, requireLevel("management"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "denied"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'accepted' or 'denied'." });
    }

    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found." });
    if (app.status !== "pending") return res.status(409).json({ error: "Application already reviewed." });

    app.status     = status;
    app.reviewedBy = req.session?.user?.discordId || "staff";
    app.reviewedAt = Date.now();
    await app.save();

    // Notify the bot to DM the applicant and assign roles if accepted
    if (process.env.BOT_API_URL && process.env.BOT_API_KEY) {
      try {
        const fetch = require("node-fetch");
        await fetch(`${process.env.BOT_API_URL}/api/application-decision`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.BOT_API_KEY}`,
          },
          body: JSON.stringify({
            discordId:      app.discordId,
            robloxUsername: app.robloxUsername,
            department:     app.department,
            status,
          }),
        });
      } catch (botErr) {
        console.error("[Applications] Bot notify error:", botErr.message);
        // Non-fatal — continue even if bot call fails
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    console.error("[Applications] PATCH error:", err.message);
    res.status(500).json({ error: "Failed to review application." });
  }
});

module.exports = router;
