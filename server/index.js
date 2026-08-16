/**
 * index.js — Georgia State Roleplay Staff Portal
 * Compatible with Vercel serverless + local dev.
 */

// Only load .env locally — Vercel injects vars directly
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
}

require("./db"); // connect to MongoDB

const express    = require("express");
const session    = require("express-session");
const MongoStore = require("connect-mongo");
const helmet     = require("helmet");
const cors       = require("cors");
const path       = require("path");

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com"],
      imgSrc:      [
        "'self'", "data:", "blob:",
        "cdn.discordapp.com",
        "thumbnails.roblox.com",
        "www.roblox.com",
        "tr.rbxcdn.com",
        "https:",
      ],
      connectSrc:  [
        "'self'",
        "users.roblox.com",
        "thumbnails.roblox.com",
      ],
    },
  },
  // Don't let helmet's HSTS cause issues on non-HTTPS local dev
  hsts: process.env.NODE_ENV === "production"
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
}));

const allowedOrigin = process.env.BASE_URL || "*";
app.use(cors({ origin: allowedOrigin, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Trust proxy — Render/Vercel sit behind load balancers ────────────────────
// "1" trusts the first proxy hop — sufficient for Render and Vercel
app.set("trust proxy", 1);

// ── Session ───────────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";
app.use(session({
  name:              "gsrp.sid",
  secret:            process.env.SESSION_SECRET || "gsrp-change-me",
  resave:            false,
  saveUninitialized: false,
  store:             MongoStore.create({
    mongoUrl:       process.env.MONGO_URI,
    collectionName: "portal_sessions",
    ttl:            7 * 24 * 60 * 60,
    autoRemove:     "native",
    touchAfter:     24 * 3600,
  }),
  cookie: {
    secure:   isProduction, // only enforce HTTPS in production
    httpOnly: true,
    sameSite: "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  },
}));

// ── Passport Discord OAuth ────────────────────────────────────────────────────
// Lazy-require so Vercel doesn't crash if DISCORD_CLIENT_ID isn't set yet
try {
  const { passport } = require("./auth");
  app.use(passport.initialize());
  app.use(passport.session());
} catch (err) {
  console.error("[Auth] Passport setup failed:", err.message);
}

// ── Force HTTPS in production ─────────────────────────────────────────────────
// Render and Vercel terminate SSL at their edge — req.secure checks the
// x-forwarded-proto header (enabled by trust proxy above).
if (isProduction) {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    // Redirect HTTP → HTTPS
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  });
}

// ── Static files ──────────────────────────────────────────────────────────────
const PUBLIC = path.resolve(__dirname, "../public");
app.use(express.static(PUBLIC));
// Also serve static assets under /staff prefix so relative paths work
app.use("/staff", express.static(PUBLIC));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/auth",              require("./routes/authRoutes"));
app.use("/api/infractions",   require("./routes/infractions"));
app.use("/api/promotions",    require("./routes/promotions"));
app.use("/api/erlc",          require("./routes/erlcRoutes"));
app.use("/api/erlc-punishments", require("./routes/erlcPunishmentRoutes"));
app.use("/api/staff",         require("./routes/staffRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));
app.use("/api/docs",          require("./routes/docsRoutes"));
app.use("/api/applications",  require("./routes/applicationRoutes"));
app.use("/api/reviews",       require("./routes/reviewRoutes"));

// ── Roblox proxy — resolves username → userId and fetches headshot ────────────
app.get("/api/roblox/user", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "username required" });
  try {
    const axios = require("axios");
    const r = await axios.post(
      "https://users.roblox.com/v1/usernames/users",
      { usernames: [username], excludeBannedUsers: false },
      { timeout: 5000 }
    );
    const user = r.data?.data?.[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, name: user.name });
  } catch (err) {
    res.status(502).json({ error: "Roblox API unavailable" });
  }
});

app.get("/api/roblox/avatar", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const axios = require("axios");
    const r = await axios.get(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`,
      { timeout: 5000 }
    );
    const url = r.data?.data?.[0]?.imageUrl;
    if (!url) return res.status(404).json({ error: "Avatar not found" });
    res.json({ url });
  } catch (err) {
    res.status(502).json({ error: "Roblox API unavailable" });
  }
});

// ── Health check (used by self-ping keepalive) ────────────────────────────────
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Page routes ───────────────────────────────────────────────────────────────
const { requireAuth, requireLevel } = require("./middleware");

// ── staff.gssrp.xyz → redirect to gssrp.xyz/staff ────────────────────────────
app.use((req, res, next) => {
  const host = req.hostname || '';
  if (host.startsWith('staff.')) {
    // Redirect the whole subdomain to /staff equivalent on main domain
    const mainHost = host.replace(/^staff\./, '');
    // Map bare paths to /staff paths
    const staffPath = req.path === '/' ? '/staff' : `/staff${req.path}`;
    return res.redirect(301, `https://${mainHost}${staffPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`);
  }
  next();
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.redirect(req.session?.user ? "/staff/dashboard" : "/home");
});

// /staff root → login or dashboard
app.get("/staff", (req, res) => {
  res.redirect(req.session?.user ? "/staff/dashboard" : "/staff/login");
});

// ── Public pages (main domain only) ──────────────────────────────────────────
app.get("/home",  (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));
app.get("/map",   (req, res) => res.sendFile(path.join(PUBLIC, "map.html")));
app.get("/shop",  (req, res) => res.sendFile(path.join(PUBLIC, "shop.html")));
app.get("/apply", (req, res) => res.sendFile(path.join(PUBLIC, "apply.html")));
app.get("/index", (req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

// ── Login — both /login and /staff/login ─────────────────────────────────────
app.get(["/login", "/staff/login"], (req, res) =>
  res.sendFile(path.join(PUBLIC, "login.html"))
);

// ── Helper: register a page at both /page and /staff/page ────────────────────
function staffPage(route, middleware, file) {
  const handlers = [...(Array.isArray(middleware) ? middleware : [middleware]),
    (req, res) => res.sendFile(path.join(PUBLIC, file))];
  app.get(`/${route}`,        ...handlers);
  app.get(`/staff/${route}`,  ...handlers);
}

// All staff pages
staffPage("dashboard",    requireAuth,                   "dashboard.html");
staffPage("erlc",         requireAuth,                   "erlc.html");
staffPage("shifts",       requireAuth,                   "shifts.html");
staffPage("loa",          requireAuth,                   "loa.html");
staffPage("statistics",   requireAuth,                   "statistics.html");
staffPage("docs",         requireAuth,                   "docs.html");
staffPage("map",          requireAuth,                   "map.html");

// Moderator+
staffPage("infractions",  requireLevel("moderator"),     "infractions.html");
staffPage("roster",       requireLevel("moderator"),     "roster.html");

// Admin+
staffPage("promotions",   requireLevel("admin"),         "promotions.html");

// Management+
staffPage("announcements",requireLevel("management"),    "announcements.html");
staffPage("audit",        requireLevel("management"),    "audit.html");
staffPage("settings",     requireLevel("management"),    "settings.html");
staffPage("applications", requireLevel("management"),    "applications.html");

// ── 404 / fallback ────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  // Unknown staff panel path → login
  if (req.path.startsWith("/staff/")) {
    return res.redirect("/staff/login");
  }
  res.redirect("/home");
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.message);
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(500).send("Internal server error");
});

// ── Local dev only — Vercel uses module.exports, not listen() ─────────────────
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`[WEB] Running locally at http://localhost:${PORT}`)
  );
} else {
  // ── Render production — keep-alive self-ping every 5 minutes ─────────────────
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[WEB] Running on port ${PORT}`);

    const https = require("https");
    const http  = require("http");

    const URLS = [
      process.env.BASE_URL       || `http://localhost:${PORT}`, // gssrp.xyz
      "https://www.gssrp.xyz",
      "https://gssrp.xyz",
    ];

    function ping(url) {
      const lib = url.startsWith("https") ? https : http;
      const req = lib.get(url + "/health", { rejectUnauthorized: false }, res => {
        console.log(`[Ping] ${new Date().toISOString()} ${url} — ${res.statusCode}`);
      });
      req.on("error", err => {
        console.warn(`[Ping] ${url} failed: ${err.code || err.message}`);
      });
      req.end();
    }

    setInterval(() => URLS.forEach(ping), 5 * 60 * 1000); // every 5 minutes
    // Also ping immediately on startup
    setTimeout(() => URLS.forEach(ping), 10_000);
  });
}

module.exports = app;
