/**
 * app.js — Shared utilities for all portal pages.
 */

/* ── Session / user ──────────────────────────────────────────────────────────*/
let _currentUser = null;

async function getUser() {
  if (_currentUser) return _currentUser;
  try {
    const res = await fetch("/auth/me");
    if (!res.ok) { window.location.href = "/login"; return null; }
    _currentUser = await res.json();
    return _currentUser;
  } catch {
    window.location.href = "/login";
    return null;
  }
}

/* ── Sidebar render ──────────────────────────────────────────────────────────*/
const NAV = [
  { label: "Overview", icon: "grid",       href: "/dashboard",     section: "main" },
  { label: "Shifts",   icon: "clock",      href: "/shifts",        section: "main" },
  { label: "Infractions", icon: "shield",  href: "/infractions",   section: "main" },
  { label: "Promotions",  icon: "arrow-up",href: "/promotions",    section: "main" },
  { label: "LOA",      icon: "calendar",   href: "/loa",           section: "main" },
  { label: "Sessions", icon: "zap",        href: "/erlc",          section: "erlc", label2: "ERLC" },
  { label: "Roster",   icon: "users",      href: "/roster",        section: "staff" },
  { label: "Statistics",icon: "bar-chart", href: "/statistics",    section: "staff" },
  { label: "Announcements", icon: "megaphone", href: "/announcements", section: "staff" },
  { label: "Audit Log",icon: "file-text",  href: "/audit",         section: "management", minLevel: "management" },
  { label: "Settings", icon: "settings",   href: "/settings",      section: "management", minLevel: "management" },
];

const LEVELS = ["staff", "moderator", "admin", "management", "owner"];
function hasLevel(userLevel, required) {
  return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(required);
}

const ICONS = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  "arrow-up": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  "bar-chart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
  "file-text": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
};

function svgIcon(name) {
  return ICONS[name] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

const RANK_COLORS = {
  owner:      "#ffd166",
  management: "#ff4d6d",
  admin:      "#8b5cf6",
  moderator:  "#4f6fff",
  staff:      "#43e97b",
};

async function renderSidebar(activePage) {
  const user = await getUser();
  if (!user) return;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  let sections = { main: [], erlc: [], staff: [], management: [] };
  NAV.forEach(item => {
    if (item.minLevel && !hasLevel(user.accessLevel, item.minLevel)) return;
    sections[item.section] = sections[item.section] || [];
    sections[item.section].push(item);
  });

  const sectionLabels = { main: "Main", erlc: "ERLC", staff: "Staff", management: "Management" };

  let navHtml = "";
  for (const [key, items] of Object.entries(sections)) {
    if (!items.length) continue;
    navHtml += `<div class="nav-section-label">${sectionLabels[key]}</div>`;
    items.forEach(item => {
      const active = window.location.pathname === item.href ? " active" : "";
      navHtml += `
        <a class="nav-item${active}" href="${item.href}">
          ${svgIcon(item.icon)}
          <span>${item.label}</span>
        </a>`;
    });
  }

  const sidebarEl = document.getElementById("sidebar");
  if (!sidebarEl) return;

  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <img src="/img/logo.png" alt="GSRP" class="sidebar-logo-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" style="width:34px;height:34px;border-radius:6px;object-fit:cover;flex-shrink:0;">
      <div class="sidebar-logo" style="display:none;">GA</div>
      <div>
        <div class="sidebar-title">Georgia State</div>
        <div class="sidebar-subtitle">Roleplay Portal</div>
      </div>
    </div>
    <div class="sidebar-user">
      <img class="sidebar-user-avatar" src="${avatarUrl}" alt="Avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="sidebar-user-info">
        <div class="sidebar-user-name truncate">${user.displayName}</div>
        <div class="sidebar-user-rank" style="color:${RANK_COLORS[user.accessLevel] || '#5865f2'}">${capitalize(user.accessLevel)}</div>
      </div>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-footer">
      <a class="sign-out" href="/auth/logout">
        ${svgIcon("logout")}
        Sign Out
      </a>
    </div>
  `;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────*/
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function formatDuration(ms) {
  if (!ms) return "0h 0m";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:var(--bg-card); border:1px solid var(--border-md);
    border-radius:var(--radius-sm); padding:12px 18px;
    font-size:13px; color:var(--text-primary);
    box-shadow:var(--shadow); animation: fadeIn 0.2s ease;
    display:flex; align-items:center; gap:8px;
  `;
  const dot = type === "error" ? "#ed4245" : "#57f287";
  el.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0;display:inline-block;"></span>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(id) { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

// Close modals on overlay click
document.addEventListener("click", e => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
});
