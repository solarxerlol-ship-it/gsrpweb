/**
 * middleware.js — Auth guards, rank checks, rate limiting.
 */

const rateLimit = require("express-rate-limit");

/** Require any authenticated session */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.redirect("/staff/login");
}

/** Factory — require minimum access level */
const LEVELS = ["staff", "moderator", "admin", "management", "owner"];

function requireLevel(level) {
  return (req, res, next) => {
    const user = req.session?.user;
    if (!user) {
      if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
      return res.redirect("/staff/login");
    }
    const userIdx  = LEVELS.indexOf(user.accessLevel);
    const reqIdx   = LEVELS.indexOf(level);
    if (userIdx >= reqIdx) return next();
    if (req.path.startsWith("/api/")) return res.status(403).json({ error: "Forbidden — insufficient rank" });
    res.redirect("/staff/dashboard?error=forbidden");
  };
}

/** Rate limiter for login endpoints */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

/** Rate limiter for write API endpoints */
const apiWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Rate limit exceeded." },
});

module.exports = { requireAuth, requireLevel, loginLimiter, apiWriteLimiter };
