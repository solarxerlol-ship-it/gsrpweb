/**
 * erlcRoutes.js — Proxies ERLC API calls to the frontend.
 * All routes require auth. Running commands requires management+.
 */

const express = require("express");
const router  = express.Router();
const erlc    = require("../erlc");
const { AuditLog } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const { logERLCCommandToDiscord } = require("../discord");

router.get("/server",    requireAuth, async (req, res) => {
  try { res.json(await erlc.getServer(req.query)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Public server status — no auth, used by the public homepage
router.get("/server-public", async (req, res) => {
  try {
    const data = await erlc.getServer({ Players: true });
    // Only expose safe public fields
    res.json({
      CurrentPlayers: data.CurrentPlayers,
      MaxPlayers:     data.MaxPlayers,
      Name:           data.Name,
      Queue:          Array.isArray(data.Queue) ? data.Queue.length : (data.Queue ?? 0),
      JoinKey:        data.JoinKey ? true : false,
      Players:        Array.isArray(data.Players)
        ? data.Players.map(p => ({ Team: p.Team, Callsign: p.Callsign, Player: p.Player?.split(':')[0] }))
        : [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/players",   requireAuth, async (req, res) => {
  try { res.json(await erlc.getPlayers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/queue",     requireAuth, async (req, res) => {
  try { res.json(await erlc.getQueue()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/staff",     requireAuth, async (req, res) => {
  try { res.json(await erlc.getStaff()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/kill-logs", requireAuth, async (req, res) => {
  try { res.json(await erlc.getKillLogs()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/command-logs", requireAuth, async (req, res) => {
  try { res.json(await erlc.getCommandLogs()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/join-logs", requireAuth, async (req, res) => {
  try { res.json(await erlc.getJoinLogs()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/vehicles",  requireAuth, async (req, res) => {
  try { res.json(await erlc.getVehicles()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/mod-calls", requireAuth, async (req, res) => {
  try { res.json(await erlc.getModCalls()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/emergency-calls", requireAuth, async (req, res) => {
  try { res.json(await erlc.getEmergencyCalls()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Running commands — management+ only
router.post("/command", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "Command is required." });
    const result = await erlc.runCommand(command);
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "erlc_command",
      target:    "server",
      details:   { command },
    });

    logERLCCommandToDiscord({
      command,
      executorId:   req.session.user.discordId,
      executorName: req.session.user.displayName,
    });

    res.json(result);
  } catch (e) {
    const status = e.statusCode || 500;
    res.status(status).json({ error: e.message });
  }
});

module.exports = router;
