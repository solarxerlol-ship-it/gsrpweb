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

// ── Page routes ───────────────────────────────────────────────────────────────
const { requireAuth, requireLevel } = require("./middleware");

app.get("/", (req, res) =>
  res.redirect(req.session?.user ? "/dashboard" : "/login")
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(PUBLIC, "login.html"))
);

// Pages accessible by all staff
const STAFF_PAGES = ["dashboard", "erlc", "shifts", "loa", "statistics", "docs"];
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
const MANAGEMENT_PAGES = ["announcements", "audit", "settings", "applications"];
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
