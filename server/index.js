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
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "cdn.discordapp.com", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

const allowedOrigin = process.env.BASE_URL || "*";
app.use(cors({ origin: allowedOrigin, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Trust Vercel's proxy so secure cookies work ───────────────────────────────
app.set("trust proxy", 1);

// ── Session ───────────────────────────────────────────────────────────────────
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
    secure:   true,    // always — Vercel is always HTTPS
    httpOnly: true,
    sameSite: "lax",   // lax works for OAuth redirect flows
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

// ── Static files ──────────────────────────────────────────────────────────────
const PUBLIC = path.resolve(__dirname, "../public");
app.use(express.static(PUBLIC));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/auth",              require("./routes/authRoutes"));
app.use("/api/infractions",   require("./routes/infractions"));
app.use("/api/promotions",    require("./routes/promotions"));
app.use("/api/erlc",          require("./routes/erlcRoutes"));
app.use("/api/staff",         require("./routes/staffRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));

// ── Page routes ───────────────────────────────────────────────────────────────
const { requireAuth, requireLevel } = require("./middleware");

app.get("/", (req, res) =>
  res.redirect(req.session?.user ? "/dashboard" : "/login")
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(PUBLIC, "login.html"))
);

// Pages accessible by all staff
const STAFF_PAGES = ["dashboard", "erlc", "shifts", "loa", "statistics"];
STAFF_PAGES.forEach(p => {
  app.get(`/${p}`, requireAuth, (req, res) =>
    res.sendFile(path.join(PUBLIC, `${p}.html`))
  );
});

// Pages accessible by moderator+
const MODERATOR_PAGES = ["infractions", "roster"];
MODERATOR_PAGES.forEach(p => {
  app.get(`/${p}`, requireLevel("moderator"), (req, res) =>
    res.sendFile(path.join(PUBLIC, `${p}.html`))
  );
});

// Pages accessible by admin+
const ADMIN_PAGES = ["promotions"];
ADMIN_PAGES.forEach(p => {
  app.get(`/${p}`, requireLevel("admin"), (req, res) =>
    res.sendFile(path.join(PUBLIC, `${p}.html`))
  );
});

// Pages accessible by management+
const MANAGEMENT_PAGES = ["announcements", "audit", "settings"];
MANAGEMENT_PAGES.forEach(p => {
  app.get(`/${p}`, requireLevel("management"), (req, res) =>
    res.sendFile(path.join(PUBLIC, `${p}.html`))
  );
});

// ── 404 / fallback ────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.redirect("/login");
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
}

module.exports = app;
