/**
 * reviewRoutes.js
 * POST /api/reviews          — public submit (no auth)
 * GET  /api/reviews          — public, returns approved only
 * GET  /api/reviews/all      — management+ see all including pending
 * PATCH /api/reviews/:id     — management+ approve/deny
 * DELETE /api/reviews/:id    — management+ delete
 */

const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");
const { requireLevel } = require("../middleware");

const reviewSchema = new mongoose.Schema({
  name:      { type: String, required: true, maxlength: 50 },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  text:      { type: String, required: true, maxlength: 400 },
  status:    { type: String, enum: ["pending","approved","denied"], default: "pending" },
  createdAt: { type: Number, default: () => Date.now() },
});

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

// Rate limit: one submission per IP per hour (in-memory)
const cooldowns = new Map();

// GET /api/reviews — public approved reviews
router.get("/", async (req, res) => {
  try {
    const reviews = await Review.find({ status: "approved" }).sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reviews/all — management+ all reviews
router.get("/all", requireLevel("management"), async (req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).lean();
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reviews — public submit
router.post("/", async (req, res) => {
  const ip  = req.ip;
  const now = Date.now();
  if (cooldowns.has(ip) && now - cooldowns.get(ip) < 60 * 60 * 1000) {
    return res.status(429).json({ error: "You already left a review recently. Try again in an hour." });
  }

  const { name, rating, text } = req.body;
  if (!name || !rating || !text) return res.status(400).json({ error: "All fields required." });
  if (text.trim().length < 10)   return res.status(400).json({ error: "Review is too short." });
  if (rating < 1 || rating > 5)  return res.status(400).json({ error: "Invalid rating." });

  try {
    const review = await Review.create({
      name:   name.trim().slice(0,50),
      rating: parseInt(rating),
      text:   text.trim().slice(0,400),
      status: "approved",
    });
    cooldowns.set(ip, now);
    res.status(201).json({ success: true, id: review._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/reviews/:id — approve or deny
router.patch("/:id", requireLevel("management"), async (req, res) => {
  const { status } = req.body;
  if (!["approved","denied"].includes(status)) return res.status(400).json({ error: "Invalid status." });
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) return res.status(404).json({ error: "Not found." });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reviews/:id
router.delete("/:id", requireLevel("management"), async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
