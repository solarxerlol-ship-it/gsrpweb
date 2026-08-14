/**
 * =============================================
 * GEORGIA STATE ROLEPLAY — ROLES CONFIGURATION
 * =============================================
 *
 * Keys are Discord role IDs.
 * level        — numeric access level (higher = more access)
 * displayRank  — controls which label shows on the dashboard
 *                (use -1 + hideFromDisplay:true to hide from UI)
 * label        — shown on the dashboard profile card & sidebar
 * color        — hex color for the label
 * section      — grouping for display purposes
 *
 * To add a role: grab the Discord role ID from
 * Server Settings → Roles → right-click → Copy Role ID
 * and add it below.
 */

const ROLE_CONFIG = {

  roleMap: {

    // ── Owner ──────────────────────────────────────────────────────────────
    [process.env.ROLE_OWNER]: {
      level:       100,
      displayRank: 100,
      label:       'Director',
      color:       '#f59e0b',
      section:     'leadership',
    },

    // ── Management ─────────────────────────────────────────────────────────
    [process.env.ROLE_MANAGEMENT]: {
      level:       80,
      displayRank: 80,
      label:       'Management Team',
      color:       '#ef4444',
      section:     'leadership',
    },

    // ── Admin ──────────────────────────────────────────────────────────────
    [process.env.ROLE_ADMIN]: {
      level:       60,
      displayRank: 60,
      label:       'Administrator',
      color:       '#8b5cf6',
      section:     'staff',
    },

    // ── Moderator ──────────────────────────────────────────────────────────
    [process.env.ROLE_MODERATOR]: {
      level:       40,
      displayRank: 40,
      label:       'Moderator',
      color:       '#4f6fff',
      section:     'staff',
    },

    // ── Staff ──────────────────────────────────────────────────────────────
    [process.env.ROLE_STAFF]: {
      level:       20,
      displayRank: 20,
      label:       'Staff Member',
      color:       '#22c55e',
      section:     'staff',
    },

  },

  /**
   * Permission map: numeric level → array of page keys they can access.
   * '*' means everything.
   * Pages not in the array are hidden from the sidebar AND blocked on the server.
   */
  permissions: {
    100: ['*'],
    80:  ['dashboard', 'shifts', 'erlc', 'loa', 'statistics',
          'infractions', 'roster',
          'promotions',
          'announcements', 'audit', 'settings'],
    60:  ['dashboard', 'shifts', 'erlc', 'loa', 'statistics',
          'infractions', 'roster',
          'promotions'],
    40:  ['dashboard', 'shifts', 'erlc', 'loa', 'statistics',
          'infractions', 'roster'],
    20:  ['dashboard', 'shifts', 'erlc', 'loa', 'statistics'],
    0:   [],
  },

  /** Minimum level required to access the portal at all */
  minDashboardLevel: 20,

};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Get the permission array for a given numeric level.
 * Walks down from the highest defined tier that the level meets.
 */
function getPermissionsForLevel(level) {
  const tiers = Object.keys(ROLE_CONFIG.permissions)
    .map(Number)
    .sort((a, b) => b - a);

  for (const tier of tiers) {
    if (level >= tier) return ROLE_CONFIG.permissions[tier] || [];
  }
  return ROLE_CONFIG.permissions[0] || [];
}

/**
 * Check if a user with `level` can access `page`.
 */
function hasPermission(level, page) {
  const perms = getPermissionsForLevel(level);
  return perms.includes('*') || perms.includes(page);
}

/**
 * Given the array of Discord role IDs a member has,
 * return their resolved { level, label, color, section }.
 *
 * - Access level  = highest level among all matched roles
 * - Display label = role with highest displayRank that isn't hidden
 *
 * Returns null if no matching staff role is found.
 */
function resolveRoleFromIds(roleIds) {
  const ids = Array.isArray(roleIds) ? roleIds : [];

  const matched = ids
    .map(id => ({ id, ...ROLE_CONFIG.roleMap[id] }))
    .filter(r => r.level !== undefined);

  if (!matched.length) return null;

  // Highest level first
  matched.sort((a, b) => (b.level || 0) - (a.level || 0));

  const highestLevel = matched[0].level;

  // Best display label = highest displayRank non-hidden role
  const displayable = matched.filter(r => !r.hideFromDisplay);
  displayable.sort((a, b) => {
    const scoreA = typeof a.displayRank === 'number' && a.displayRank >= 0 ? a.displayRank : a.level || 0;
    const scoreB = typeof b.displayRank === 'number' && b.displayRank >= 0 ? b.displayRank : b.level || 0;
    return scoreB - scoreA;
  });

  const display = displayable[0] || matched[0];

  return {
    level:   highestLevel,
    label:   display.label,
    color:   display.color,
    section: display.section,
  };
}

/**
 * Named level string → numeric level.
 * Used by middleware for backward-compat with the old string-based system.
 */
const LEVEL_NAMES = {
  owner:      100,
  management:  80,
  admin:       60,
  moderator:   40,
  staff:       20,
};

function namedLevelToNumber(name) {
  return LEVEL_NAMES[name] ?? 0;
}

function numberToNamedLevel(num) {
  if (num >= 100) return 'owner';
  if (num >= 80)  return 'management';
  if (num >= 60)  return 'admin';
  if (num >= 40)  return 'moderator';
  if (num >= 20)  return 'staff';
  return 'none';
}

// Attach helpers to the config object (mirrors the CCRP pattern)
ROLE_CONFIG.getPermissionsForLevel = getPermissionsForLevel;
ROLE_CONFIG.hasPermission           = hasPermission;
ROLE_CONFIG.resolveRoleFromIds      = resolveRoleFromIds;
ROLE_CONFIG.namedLevelToNumber      = namedLevelToNumber;
ROLE_CONFIG.numberToNamedLevel      = numberToNamedLevel;

// Legacy shim — old code used resolveRole(ids) → { level (string), label }
function resolveRole(roleIds) {
  const result = resolveRoleFromIds(roleIds);
  if (!result) return null;
  return {
    level: numberToNamedLevel(result.level), // string e.g. "management"
    numericLevel: result.level,
    label: result.label,
    color: result.color,
  };
}

// Numeric hierarchy for middleware hasLevel checks
const LEVEL_ORDER = ['staff', 'moderator', 'admin', 'management', 'owner'];

function hasLevel(userLevel, requiredLevel) {
  return LEVEL_ORDER.indexOf(userLevel) >= LEVEL_ORDER.indexOf(requiredLevel);
}

module.exports = {
  ROLE_CONFIG,
  resolveRole,
  resolveRoleFromIds,
  hasPermission,
  hasLevel,
  namedLevelToNumber,
  numberToNamedLevel,
  LEVEL_ORDER,
};
