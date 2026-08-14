/**
 * =============================================
 *   GEORGIA STATE ROLEPLAY — ROLES CONFIG
 * =============================================
 *
 * HOW TO ADD A ROLE:
 *  1. Go to your Discord server
 *  2. Server Settings → Roles → right-click the role → Copy Role ID
 *  3. Add a new entry below using that ID as the key
 *
 * FIELDS:
 *   level        — numeric access tier (higher = more access, see PERMISSIONS below)
 *   displayRank  — controls which title shows on dashboard when someone has multiple roles
 *                  (higher displayRank = preferred label, use -1 to never show)
 *   label        — what shows on the dashboard profile card, e.g. "Senior Moderator"
 *   color        — hex color for the label text
 *   section      — sidebar grouping: 'leadership' | 'staff' | 'trainee'
 *   hideFromDisplay — true = role never appears as the label (used for helper roles)
 *
 * LEVELS EXPLAINED:
 *   100 = Owner / Director         (everything)
 *   90  = Deputy / Asst Director   (everything except owner-only)
 *   80  = Management               (announcements, audit, settings, all below)
 *   60  = Admin / Senior Mod       (promotions, all below)
 *   40  = Moderator                (infractions, roster, all below)
 *   20  = Staff / Junior           (dashboard, shifts, erlc, loa, statistics)
 *
 * You can use ANY number between 0-100. You are not limited to these tiers.
 * Example: level 50 gets everything level 40 gets, but not level 60 things.
 */

const ROLE_MAP = {

  // ── LEADERSHIP ─────────────────────────────────────────────────────────────

  '1530375780075569152': {
    level:       100,
    displayRank: 100,
    label:       'Director',
    color:       '#f59e0b',
    section:     'leadership',
  },

  '1532171392244777072': {
    level:       80,
    displayRank: 80,
    label:       'Management Team',
    color:       '#ef4444',
    section:     'leadership',
  },

  // ── STAFF ──────────────────────────────────────────────────────────────────
  // ⚠️  Replace ROLE_ADMIN_ID below with your actual Administrator role ID
  //    (currently using Director's ID as a placeholder — they must be different)

  [process.env.ROLE_ADMIN || 'REPLACE_WITH_ADMIN_ROLE_ID']: {
    level:       60,
    displayRank: 60,
    label:       'Administrator',
    color:       '#8b5cf6',
    section:     'staff',
  },

  '1532284263196659822': {
    level:       40,
    displayRank: 40,
    label:       'Moderator',
    color:       '#4f6fff',
    section:     'staff',
  },

  '1530375780050272383': {
    level:       20,
    displayRank: 20,
    label:       'Staff Member',
    color:       '#22c55e',
    section:     'staff',
  },

  // ── ADD YOUR OWN ROLES BELOW ───────────────────────────────────────────────
  // Copy one of the blocks above, paste it here, replace the ID and fields.
  // Example:
  //
  // 'PASTE_ROLE_ID_HERE': {
  //   level:       50,
  //   displayRank: 50,
  //   label:       'Senior Moderator',
  //   color:       '#06b6d4',
  //   section:     'staff',
  // },
  //
  // 'PASTE_ROLE_ID_HERE': {
  //   level:       30,
  //   displayRank: 30,
  //   label:       'Trial Moderator',
  //   color:       '#22d3ee',
  //   section:     'trainee',
  // },

};

/**
 * PERMISSIONS
 * ──────────────────────────────────────────────────────────────────────────
 * Maps a minimum level → which portal pages are accessible.
 * A user gets the permissions for the HIGHEST tier their level meets.
 *
 * '*' = access everything
 *
 * Page keys match the route names in server/index.js:
 *   dashboard, shifts, erlc, loa, statistics
 *   infractions, roster
 *   promotions
 *   announcements, audit, settings
 */
const PERMISSIONS = {
  100: ['*'],

  90:  ['dashboard', 'shifts', 'erlc', 'loa', 'statistics',
        'infractions', 'roster',
        'promotions',
        'announcements', 'audit', 'settings'],

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
};

// Minimum numeric level to log in at all
const MIN_LEVEL = 20;

// ── Internal helpers ──────────────────────────────────────────────────────────

const LEVEL_ORDER = ['staff', 'moderator', 'admin', 'management', 'owner'];

function getPermissionsForLevel(level) {
  const tiers = Object.keys(PERMISSIONS).map(Number).sort((a, b) => b - a);
  for (const tier of tiers) {
    if (level >= tier) return PERMISSIONS[tier] || [];
  }
  return [];
}

function hasPermission(level, page) {
  const perms = getPermissionsForLevel(level);
  return perms.includes('*') || perms.includes(page);
}

/**
 * Given a member's array of Discord role IDs, returns their resolved profile:
 * { level, label, color, section, namedLevel }
 *
 * Returns null if they have no matching staff role.
 */
function resolveRoleFromIds(roleIds) {
  const ids = Array.isArray(roleIds) ? roleIds : [];

  const matched = ids
    .map(id => ({ id, ...ROLE_MAP[id] }))
    .filter(r => r.level !== undefined);

  if (!matched.length) return null;

  // Sort by level descending
  matched.sort((a, b) => (b.level || 0) - (a.level || 0));
  const highestLevel = matched[0].level;

  // Pick best display label (highest displayRank, not hidden)
  const displayable = matched.filter(r => !r.hideFromDisplay);
  displayable.sort((a, b) => {
    const sA = typeof a.displayRank === 'number' && a.displayRank >= 0 ? a.displayRank : (a.level || 0);
    const sB = typeof b.displayRank === 'number' && b.displayRank >= 0 ? b.displayRank : (b.level || 0);
    return sB - sA;
  });

  const display = displayable[0] || matched[0];

  return {
    level:        highestLevel,                     // number e.g. 80
    namedLevel:   numberToNamedLevel(highestLevel), // string e.g. "management"
    label:        display.label,                    // "Management Team"
    color:        display.color,                    // "#ef4444"
    section:      display.section,
  };
}

/** Legacy shim used by auth.js */
function resolveRole(roleIds) {
  const r = resolveRoleFromIds(roleIds);
  if (!r) return null;
  return {
    level:        r.namedLevel,   // "management"
    numericLevel: r.level,        // 80
    label:        r.label,
    color:        r.color,
  };
}

function numberToNamedLevel(n) {
  if (n >= 100) return 'owner';
  if (n >= 80)  return 'management';
  if (n >= 60)  return 'admin';
  if (n >= 40)  return 'moderator';
  if (n >= 20)  return 'staff';
  return 'none';
}

function hasLevel(userLevel, requiredLevel) {
  return LEVEL_ORDER.indexOf(userLevel) >= LEVEL_ORDER.indexOf(requiredLevel);
}

module.exports = {
  ROLE_MAP,
  PERMISSIONS,
  MIN_LEVEL,
  resolveRole,
  resolveRoleFromIds,
  hasPermission,
  hasLevel,
  numberToNamedLevel,
  LEVEL_ORDER,
};
// e