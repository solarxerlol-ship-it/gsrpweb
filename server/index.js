/**
 * index.js — GSSRP Staff Portal server entry point.
 */

require("dotenv").config();
require("./db"); // connect to MongoDB

const express      = require("express");
const session      = require("express-session");
const MongoStore   = require("connect-mongo");
const helmet       = require("helmet");
const cors         = require("cors");
const path         = require("path");
const { passport } = require("./auth");

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc:     ["'self'", "data:", "cdn.discordapp.com", "avatars.githubusercontent.com"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors({ origin: process.env.BASE_URL, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || "changeme",
  resave:            false,
  saveUninitialized: false,
  store:             MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../public")));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/auth",              require("./routes/authRoutes"));
app.use("/api/infractions",   require("./routes/infractions"));
app.use("/api/promotions",    require("./routes/promotions"));
app.use("/api/erlc",          require("./routes/erlcRoutes"));
app.use("/api/staff",         require("./routes/staffRoutes"));
app.use("/api/announcements", require("./routes/announcementRoutes"));

// ── Page routes (serve HTML) ──────────────────────────────────────────────────
const PUBLIC = path.join(__dirname, "../public");

app.get("/",          (req, res) => res.redirect(req.session?.user ? "/dashboard" : "/login"));
app.get("/login",     (req, res) => res.sendFile(path.join(PUBLIC, "login.html")));
app.get("/dashboard", (req, res) => {
  if (!req.session?.user) return res.redirect("/login");
  res.sendFile(path.join(PUBLIC, "dashboard.html"));
});

// All other pages — protected
const pages = [
  "infractions", "promotions", "erlc", "shifts", "roster",
  "loa", "announcements", "audit", "settings", "statistics",
];
pages.forEach(p => {
  app.get(`/${p}`, (req, res) => {
    if (!req.session?.user) return res.redirect("/login");
    res.sendFile(path.join(PUBLIC, `${p}.html`));
  });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.redirect("/dashboard");
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[WEB] Staff portal running on http://localhost:${PORT}`));
