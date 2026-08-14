/**
 * docsRoutes.js — Staff documents (SOPs, policies, forms, training).
 * All staff can read. Leadership (management+) can add/edit/delete.
 */

const express = require("express");
const router  = express.Router();
const mongoose = require("mongoose");
const { requireAuth, requireLevel, apiWriteLimiter } = require("../middleware");
const { AuditLog } = require("../db");

// ── Schema (inline — simple enough to not need its own db.js entry) ────────────
const docSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  category:    { type: String, enum: ["policy","sop","training","forms","other"], default: "other" },
  url:         { type: String, default: "" },
  content:     { type: String, default: "" },  // full rich HTML content
  description: { type: String, default: "" },  // auto-generated plaintext excerpt
  authorId:    String,
  authorName:  String,
  createdAt:   { type: Number, default: () => Date.now() },
  updatedAt:   { type: Number, default: () => Date.now() },
});

const Doc = mongoose.models.Doc || mongoose.model("Doc", docSchema);

// ── GET /api/docs — all staff ─────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const query = req.query.category ? { category: req.query.category } : {};
    const docs  = await Doc.find(query).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/docs — management+ ─────────────────────────────────────────────
router.post("/", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const { title, category, url, description } = req.body;
    if (!title) return res.status(400).json({ error: "title is required." });
    const doc = await Doc.create({
      title, category, url,
      content:     req.body.content     || "",
      description: req.body.description || "",
      authorId:   req.session.user.discordId,
      authorName: req.session.user.displayName,
    });
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "doc_add",
      target:    doc._id.toString(),
      details:   { title, category },
    });
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/docs/:id — management+ ────────────────────────────────────────
router.patch("/:id", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const { title, category, url, description } = req.body;
    const doc = await Doc.findByIdAndUpdate(
      req.params.id,
      { title, category, url,
        content:     req.body.content     || "",
        description: req.body.description || "",
        updatedAt: Date.now() },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Document not found." });
    res.json(doc.toObject());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/docs/:id — management+ ───────────────────────────────────────
router.delete("/:id", requireAuth, requireLevel("management"), apiWriteLimiter, async (req, res) => {
  try {
    const doc = await Doc.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document not found." });
    await AuditLog.create({
      actorId:   req.session.user.discordId,
      actorName: req.session.user.displayName,
      action:    "doc_delete",
      target:    req.params.id,
      details:   { title: doc.title },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
