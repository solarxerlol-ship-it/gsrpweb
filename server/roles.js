/**
 * roles.js — Single source of truth for Discord role IDs → access levels.
 *
 * Add or edit roles here. The portal reads this file on every auth check.
 *
 * Structure:
 *   roleId    — Discord role ID (string)
 *   level     — internal access level used for permission gates
 *               hierarchy (lowest → highest):
 *               staff < moderator < admin < management < owner
 *   label     — human-readable name shown on the dashboard (e.g. "Director")
 *
 * Rules:
 *  - A user is granted the HIGHEST matching level they have.
 *  - Multiple roles can share the same level (e.g. two admin roles).
 *  - Order within the same level doesn't matter.
 *  - Keep this list sorted highest → lowest so it's easy to read.
 */

const ROLE_DEFINITIONS = [
  // ── Owner ──────────────────────────────────────────────────────────────────
  {
    roleId: process.env.ROLE_OWNER,
    level:  "owner",
    label:  "Director",
  },

  // ── Management ─────────────────────────────────────────────────────────────
  {
    roleId: process.env.ROLE_MANAGEMENT,
    level:  "management",
    label:  "Management Team",
  },

  // ── Admin ──────────────────────────────────────────────────────────────────
  {
    roleId: process.env.ROLE_ADMIN,
    level:  "admin",
    label:  "Administrator",
  },

  // ── Moderator ──────────────────────────────────────────────────────────────
  {
    roleId: process.env.ROLE_MODERATOR,
    level:  "moderator",
    label:  "Moderator",
  },

  // ── Staff ──────────────────────────────────────────────────────────────────
  {
    roleId: process.env.ROLE_STAFF,
    level:  "staff",
    label:  "Staff Member",
  },
];

/**
 * Level hierarchy — used to compare levels numerically.
 * Higher index = higher access.
 */
const LEVEL_ORDER = ["staff", "moderator", "admin", "management", "owner"];

/**
 * Given an array of Discord role ID strings the member has,
 * returns { level, label } for their HIGHEST matching role,
 * or null if they have no matching staff role.
 *
 * @param {string[]} memberRoleIds
 * @returns {{ level: string, label: string } | null}
 */
function resolveRole(memberRoleIds) {
  // Filter roles.js entries to ones the user actually has
  const matches = ROLE_DEFINITIONS.filter(
    def => def.roleId && memberRoleIds.includes(def.roleId)
  );

  if (!matches.length) return null;

  // Pick the one with the highest level
  matches.sort(
    (a, b) => LEVEL_ORDER.indexOf(b.level) - LEVEL_ORDER.indexOf(a.level)
  );

  return { level: matches[0].level, label: matches[0].label };
}

/**
 * Check if `userLevel` meets or exceeds `requiredLevel`.
 *
 * @param {string} userLevel
 * @param {string} requiredLevel
 * @returns {boolean}
 */
function hasLevel(userLevel, requiredLevel) {
  return LEVEL_ORDER.indexOf(userLevel) >= LEVEL_ORDER.indexOf(requiredLevel);
}

module.exports = { ROLE_DEFINITIONS, LEVEL_ORDER, resolveRole, hasLevel };
