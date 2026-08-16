/**
 * authRoutes.js — Discord OAuth2 + password login/logout + periodic role refresh.
 */

const express  = require("express");
const bcrypt   = require("bcryptjs");
const router   = express.Router();
const { passport, getGuildRoles } = require("../auth");
const { resolveRole }             = require("../roles");
const { StaffUser }               = require("../db");
const { loginLimiter }            = require("../middleware");

// Re-verify Discord roles every 5 minutes
const ROLE_REFRESH_MS = 5 * 60 * 1000;

// ── Discord OAuth2 ────────────────────────────────────────────────────────────

router.get("/discord", passport.authenticate("discord"));

router.get("/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/login?error=no_role",
    session: false,   // don't let passport touch the session — we manage it manually
  }),
  (req, res) => {
    const user = req.user;
    if (!user) return res.redirect("/login?error=no_role");

    const userData = {
      _id:            user._id.toString(),
      discordId:      user.discordId,
      displayName:    user.discordUsername,
      avatar:         user.discordAvatar,
      accessLevel:    user.accessLevel,
      numericLevel:   user.numericLevel,
      roleLabel:      user.roleLabel,
      roleColor:      user.roleColor,
      authMethod:     "discord",
      rolesCheckedAt: Date.now(),
    };

    // Regenerate session to prevent fixation, then save before redirecting.
    // On Vercel serverless each invocation is stateless — must fully persist
    // the session to MongoDB before the 302 so the next request can read it.
    req.session.regenerate(regenErr => {
      if (regenErr) {
        console.error("[Auth] Session regenerate error:", regenErr);
        return res.redirect("/login?error=session");
      }
      req.session.user = userData;
      req.session.save(saveErr => {
        if (saveErr) {
          console.error("[Auth] Session save error:", saveErr);
          return res.redirect("/login?error=session");
        }
        res.redirect("/dashboard");
      });
    });
  }
);

// ── Password Login ────────────────────────────────────────────────────────────

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required." });

    const user = await StaffUser.findOne({ username: username.toLowerCase() }).lean();
    if (!user || !user.passwordHash)
      return res.status(401).json({ error: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials." });

    req.session.user = {
      _id:            user._id.toString(),
      discordId:      user.discordId || null,
      displayName:    user.username,
      avatar:         user.discordAvatar || null,
      accessLevel:    user.accessLevel,
      roleLabel:      user.roleLabel || capitalize(user.accessLevel),
      authMethod:     "password",
      rolesCheckedAt: Date.now(),
    };

    await StaffUser.updateOne({ _id: user._id }, { lastLogin: Date.now() });
    res.json({ success: true, redirect: "/dashboard" });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
// Returns the current session user.
// For Discord users, re-checks guild roles every ROLE_REFRESH_MS ms:
//   - Role removed → session destroyed, 401 returned → frontend → /login
//   - Role changed  → session + DB updated in place, no re-login needed

router.get("/me", async (req, res) => {
  const u = req.session?.user;
  if (!u) return res.status(401).json({ error: "Not authenticated" });

  if (u.authMethod === "discord" && u.discordId) {
    const stale = Date.now() - (u.rolesCheckedAt || 0) > ROLE_REFRESH_MS;
    if (stale) {
      try {
        const guildRoles = await getGuildRoles(u.discordId);
        const resolved   = resolveRole(guildRoles);

        if (!resolved) {
          console.log(`[Auth] Role removed for ${u.displayName} — revoking session`);
          req.session.destroy(() => {});
          return res.status(401).json({ error: "Your staff role has been removed." });
        }

        // Patch session in place then save
        req.session.user.accessLevel    = resolved.level;
        req.session.user.numericLevel   = resolved.numericLevel;
        req.session.user.roleLabel      = resolved.label;
        req.session.user.roleColor      = resolved.color;
        req.session.user.rolesCheckedAt = Date.now();
        await new Promise((resolve, reject) =>
          req.session.save(e => e ? reject(e) : resolve())
        );

        // Keep DB in sync
        await StaffUser.updateOne(
          { discordId: u.discordId },
          {
            accessLevel:  resolved.level,
            numericLevel: resolved.numericLevel,
            roleLabel:    resolved.label,
            roleColor:    resolved.color,
            discordRoles: guildRoles,
          }
        );

        if (resolved.level !== u.accessLevel || resolved.label !== u.roleLabel) {
          console.log(`[Auth] Role updated for ${u.displayName}: "${u.roleLabel}" → "${resolved.label}"`);
        }
      } catch (err) {
        // Don't kick users on transient Discord API errors
        console.error("[Auth] Role refresh error (keeping session):", err.message);
      }
    }
  }

  res.json(req.session.user);
});

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

module.exports = router;
