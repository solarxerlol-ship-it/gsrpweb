/**
 * authRoutes.js — Discord OAuth2 + password login/logout routes.
 */

const express  = require("express");
const bcrypt   = require("bcryptjs");
const router   = express.Router();
const { passport } = require("../auth");
const { StaffUser, AuditLog } = require("../db");
const { loginLimiter } = require("../middleware");

// ── Discord OAuth2 ────────────────────────────────────────────────────────────

router.get("/discord", passport.authenticate("discord"));

router.get("/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/login?error=no_role" }),
  (req, res) => {
    // Move passport user into our own session shape
    req.session.user = {
      _id:          req.user._id.toString(),
      discordId:    req.user.discordId,
      displayName:  req.user.discordUsername,
      avatar:       req.user.discordAvatar,
      accessLevel:  req.user.accessLevel,
      authMethod:   "discord",
    };
    req.logout(err => {}); // clear passport session, we manage our own
    res.redirect("/dashboard");
  }
);

// ── Password Login ────────────────────────────────────────────────────────────

router.post("/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required." });
  }

  const user = await StaffUser.findOne({ username: username.toLowerCase() }).lean();
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  req.session.user = {
    _id:         user._id.toString(),
    discordId:   user.discordId || null,
    displayName: user.username,
    avatar:      user.discordAvatar || null,
    accessLevel: user.accessLevel,
    authMethod:  "password",
  };

  await StaffUser.updateOne({ _id: user._id }, { lastLogin: Date.now() });
  res.json({ success: true, redirect: "/dashboard" });
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ── Session Info (for frontend) ───────────────────────────────────────────────

router.get("/me", (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Not authenticated" });
  res.json(req.session.user);
});

module.exports = router;
