/**
 * announcementRoutes.js — Portal announcements. Management+ to post/edit.
 */

const express = require("express");
const router  = express.Router();
const { Announcement } = require("../db");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");

router.get("/", requireAuth, async (req, res) => {
  try {
    const items = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const { title, content, pinned } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title and content required." });
    const a = await Announcement.create({
      title, content,
      pinned:     !!pinned,
      authorId:   req.session.user.discordId,
      authorName: req.session.user.displayName,
    });
    res.json(a.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", requireAuth, requireLevel("management"), async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
