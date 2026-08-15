/**
 * app.js — Shared utilities for all portal pages.
 */

const GSRP_LOGO = "https://cdn.discordapp.com/icons/1530375780012658918/a1de3f778cee54317a36cbe02e0169de.webp?size=1024";

/* ── Access level hierarchy ──────────────────────────────────────────────────*/
const LEVELS = ["staff", "moderator", "admin", "management", "owner"];

function hasLevel(userLevel, required) {
  return LEVELS.indexOf(userLevel) >= LEVELS.indexOf(required);
}

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

/* ── Nav definition ──────────────────────────────────────────────────────────
 *
 * minLevel: minimum access level required to see this item.
 * Hierarchy (low→high): staff < moderator < admin < management < owner
 *
 *  staff      — Overview, Shifts, ERLC, LOA, Statistics
 *  moderator  — + Infractions, Roster
 *  admin      — + Promotions
 *  management — + Applications, Audit Log, Settings
 *  owner      — everything
 *
 * ─────────────────────────────────────────────────────────────────────────── */
const NAV = [
  // ── All staff ──────────────────────────────────────────────────────────────
  { label: "Overview",         icon: "grid",      href: "/dashboard"                       },
  { label: "Shifts",           icon: "clock",     href: "/shifts"                          },
  { label: "ERLC",             icon: "zap",       href: "/erlc"                            },
  { label: "Leave of Absence", icon: "calendar",  href: "/loa"                             },
  { label: "Statistics",       icon: "bar-chart", href: "/statistics"                      },
  { label: "Docs",             icon: "book",      href: "/docs"                            },
  // ── Moderator+ ─────────────────────────────────────────────────────────────
  { label: "Infractions",      icon: "shield",    href: "/infractions", minLevel: "moderator"  },
  { label: "Roster",           icon: "users",     href: "/roster",      minLevel: "moderator"  },
  // ── Admin+ ─────────────────────────────────────────────────────────────────
  { label: "Promotions",       icon: "arrow-up",  href: "/promotions",  minLevel: "admin"      },
  // ── Management+ ────────────────────────────────────────────────────────────
  { label: "Applications",     icon: "clipboard", href: "/applications",   minLevel: "management" },
  { label: "Audit Log",        icon: "file-text", href: "/audit",         minLevel: "management" },
  { label: "Settings",         icon: "settings",  href: "/settings",      minLevel: "management" },
];

/* ── Icon SVGs ───────────────────────────────────────────────────────────────*/
const ICONS = {
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  "alert-circle": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  "arrow-up": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  zap: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  "bar-chart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  award: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>`,
  megaphone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
  "file-text": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  "book-open": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};

function svgIcon(name) {
  return ICONS[name] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

/* ── Role color map ──────────────────────────────────────────────────────────*/
const RANK_COLORS = {
  owner:      "#f59e0b",
  management: "#ef4444",
  admin:      "#8b5cf6",
  moderator:  "#4f6fff",
  staff:      "#22c55e",
};

/* ── Sidebar render ──────────────────────────────────────────────────────────*/
async function renderSidebar() {
  const user = await getUser();
  if (!user) return;

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  // Filter nav to what this role can see, then split into two sections:
  // "General" (all staff) and "Management" (moderator+)
  const general    = [];
  const management = [];

  NAV.forEach(item => {
    if (item.minLevel && !hasLevel(user.accessLevel, item.minLevel)) return;
    if (item.minLevel) {
      management.push(item);
    } else {
      general.push(item);
    }
  });

  function renderItems(items) {
    return items.map(item => {
      const active = window.location.pathname === item.href ? " active" : "";
      return `<a class="nav-item${active}" href="${item.href}">
        ${svgIcon(item.icon)}
        <span>${item.label}</span>
      </a>`;
    }).join("");
  }

  let navHtml = renderItems(general);
  if (management.length) {
    navHtml += `<div class="nav-section-label">Management</div>`;
    navHtml += renderItems(management);
  }

  const sidebarEl = document.getElementById("sidebar");
  if (!sidebarEl) return;

  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <img
        src="${GSRP_LOGO}"
        alt="GSRP"
        class="sidebar-logo-img"
        crossorigin="anonymous"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      >
      <div class="sidebar-logo" style="display:none;">GA</div>
      <div>
        <div class="sidebar-title">Georgia State</div>
        <div class="sidebar-subtitle">Staff Portal</div>
      </div>
    </div>

    <div class="sidebar-user">
      <img
        class="sidebar-user-avatar"
        src="${avatarUrl}"
        alt=""
        onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'"
      >
      <div class="sidebar-user-info">
        <div class="sidebar-user-name truncate">${user.displayName}</div>
        <div class="sidebar-user-rank" style="color:${user.roleColor || RANK_COLORS[user.accessLevel] || '#4f6fff'}">${user.roleLabel || capitalize(user.accessLevel)}</div>
      </div>
    </div>

    <nav class="sidebar-nav">${navHtml}</nav>

    <div class="sidebar-footer">
      <a class="sign-out" href="/auth/logout">
        ${svgIcon("logout")}
        <span>Sign Out</span>
      </a>
    </div>
  `;
}

/* ── Helpers ─────────────────────────────────────────────────────────────────*/
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

/* ── Avatar helper — Discord headshot or initial fallback ────────────────────*/
function discordAvatar(discordId, avatarHash, size = 32) {
  if (discordId && avatarHash) {
    return `<img src="https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=${size}"
      style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:1.5px solid var(--border-md);flex-shrink:0;"
      onerror="this.replaceWith(avatarInitial('${discordId}','${size}'))" alt="">`;
  }
  return avatarInitial(discordId, size);
}
function avatarInitial(name, size = 32) {
  const el = document.createElement('div');
  const initial = String(name || '?')[0].toUpperCase();
  const hue = [...String(name||'')].reduce((a,c)=>a+c.charCodeAt(0),0) % 360;
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.42)}px;font-weight:700;background:hsl(${hue},55%,20%);color:hsl(${hue},80%,70%);border:1.5px solid var(--border-md);`;
  el.textContent = initial;
  return el.outerHTML;
}

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
  const dot = type === "error" ? "#ff4d6d" : "#43e97b";
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    background:var(--bg-card); border:1px solid var(--border-md);
    border-radius:var(--radius-sm); padding:12px 18px;
    font-size:12.5px; color:var(--text-primary);
    box-shadow:var(--shadow); animation: fadeIn 0.2s ease;
    display:flex; align-items:center; gap:8px; max-width:320px;
    font-family:'Inter',sans-serif;
  `;
  el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;display:inline-block;box-shadow:0 0 6px ${dot};"></span>${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

// Expose to window so inline onclick="..." attributes in dynamic HTML can reach them
window.openModal  = openModal;
window.closeModal = closeModal;
window.showToast  = showToast;
window.capitalize = capitalize;
window.timeAgo    = timeAgo;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.formatDuration = formatDuration;

// Close modals on overlay click, .modal-close button, or [data-close-modal] attribute
document.addEventListener("click", e => {
  // Click on overlay backdrop
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
    return;
  }
  // .modal-close X button
  const closeBtn = e.target.closest(".modal-close");
  if (closeBtn) {
    closeBtn.closest(".modal-overlay")?.classList.remove("open");
    return;
  }
  // [data-close-modal="id"] attribute
  const dataClose = e.target.closest("[data-close-modal]");
  if (dataClose) {
    closeModal(dataClose.dataset.closeModal);
    return;
  }
});
