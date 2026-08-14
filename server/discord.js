/**
 * discord.js — Posts rich embeds to Discord channels via bot token.
 * Used by the web portal to log infractions, promotions, etc.
 * No bot process required — we call the Discord REST API directly.
 */

const axios = require("axios");

const BASE = "https://discord.com/api/v10";

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * Post an embed to a channel. Silently swallows errors so a
 * Discord outage never breaks the actual save operation.
 */
async function postEmbed(channelId, embed, content = "") {
  if (!channelId || !process.env.DISCORD_BOT_TOKEN) return;
  try {
    await axios.post(
      `${BASE}/channels/${channelId}/messages`,
      { content, embeds: [embed] },
      { headers: botHeaders() }
    );
  } catch (err) {
    console.warn(`[Discord] Failed to post embed to ${channelId}:`, err?.response?.data || err.message);
  }
}

// ── Colour map ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  verbal:  0x95a5a6,
  warn:    0xfee75c,
  strike:  0xe67e22,
  mute:    0x3498db,
  kick:    0x9b59b6,
  ban:     0xed4245,
  // promotion types
  promotion:   0x57f287,
  demotion:    0xed4245,
  transfer:    0x5865f2,
  hire:        0x57f287,
  termination: 0xed4245,
};

const TYPE_EMOJIS = {
  verbal: "💬", warn: "⚠️", strike: "🔴", mute: "🔇", kick: "👟", ban: "🔨",
  promotion: "⬆️", demotion: "⬇️", transfer: "↔️", hire: "✅", termination: "❌",
};

// ── Infraction log ────────────────────────────────────────────────────────────
async function logInfractionToDiscord({ caseId, userId, type, reason, description, moderatorId, moderatorName }) {
  const channelId = process.env.CHANNEL_INFRACTION_LOG;
  if (!channelId) return;

  const embed = {
    title:       `${TYPE_EMOJIS[type] || "🛡️"} Infraction — Case #${caseId}`,
    color:       TYPE_COLORS[type] || 0xfee75c,
    description: `**<@${userId}>** received a **${type.toUpperCase()}**`,
    fields: [
      { name: "User ID",   value: `\`${userId}\``,         inline: true  },
      { name: "Type",      value: type.toUpperCase(),       inline: true  },
      { name: "Case #",    value: `\`#${caseId}\``,         inline: true  },
      { name: "Reason",    value: reason,                   inline: false },
      ...(description ? [{ name: "Notes", value: description, inline: false }] : []),
      { name: "Logged By", value: moderatorId ? `<@${moderatorId}>` : moderatorName, inline: true  },
      { name: "Source",    value: "🌐 Web Portal",          inline: true  },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── Infraction removed log ────────────────────────────────────────────────────
async function logInfractionRemovedToDiscord({ caseId, moderatorId, moderatorName }) {
  const channelId = process.env.CHANNEL_INFRACTION_LOG;
  if (!channelId) return;

  const embed = {
    title:  `🗑️ Infraction Removed — Case #${caseId}`,
    color:  0x95a5a6,
    fields: [
      { name: "Case #",     value: `\`#${caseId}\``,         inline: true },
      { name: "Removed By", value: moderatorId ? `<@${moderatorId}>` : moderatorName, inline: true },
      { name: "Source",     value: "🌐 Web Portal",           inline: true },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── Infractions cleared log ───────────────────────────────────────────────────
async function logInfractionsClearedToDiscord({ userId, moderatorId, moderatorName }) {
  const channelId = process.env.CHANNEL_INFRACTION_LOG;
  if (!channelId) return;

  const embed = {
    title:  `🧹 All Infractions Cleared`,
    color:  0x95a5a6,
    fields: [
      { name: "User",       value: `<@${userId}> (\`${userId}\`)`, inline: true },
      { name: "Cleared By", value: moderatorId ? `<@${moderatorId}>` : moderatorName, inline: true },
      { name: "Source",     value: "🌐 Web Portal", inline: true },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── Promotion log ─────────────────────────────────────────────────────────────
async function logPromotionToDiscord({ userId, type, fromRole, toRole, reason, notes, executorId, executorName }) {
  const channelId = process.env.CHANNEL_PROMOTION_LOG;
  if (!channelId) return;

  const embed = {
    title: `${TYPE_EMOJIS[type] || "📋"} ${capitalize(type)} Logged`,
    color: TYPE_COLORS[type] || 0x57f287,
    description: `**<@${userId}>** — ${type.toUpperCase()}`,
    fields: [
      { name: "User ID",    value: `\`${userId}\``,  inline: true },
      { name: "Type",       value: capitalize(type), inline: true },
      ...(fromRole ? [{ name: "From Role", value: fromRole, inline: true }] : []),
      { name: "To Role",    value: toRole || "—",    inline: true },
      ...(reason ? [{ name: "Reason", value: reason, inline: false }] : []),
      ...(notes  ? [{ name: "Notes",  value: notes,  inline: false }] : []),
      { name: "Logged By",  value: executorId ? `<@${executorId}>` : executorName, inline: true },
      { name: "Source",     value: "🌐 Web Portal", inline: true },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── LOA log ───────────────────────────────────────────────────────────────────
async function logLOAToDiscord({ userId, username, reason, startDate, endDate, status, approvedBy }) {
  const channelId = process.env.CHANNEL_MOD_LOG;
  if (!channelId) return;

  const statusColor = { pending: 0xfee75c, approved: 0x57f287, denied: 0xed4245 };
  const embed = {
    title: `📅 Leave of Absence — ${capitalize(status || "pending")}`,
    color: statusColor[status] || 0xfee75c,
    fields: [
      { name: "Staff",      value: userId ? `<@${userId}>` : username, inline: true },
      { name: "Status",     value: capitalize(status || "pending"),    inline: true },
      { name: "Start",      value: new Date(startDate).toLocaleDateString(), inline: true },
      { name: "End",        value: new Date(endDate).toLocaleDateString(),   inline: true },
      { name: "Reason",     value: reason, inline: false },
      ...(approvedBy ? [{ name: "Reviewed By", value: `<@${approvedBy}>`, inline: true }] : []),
      { name: "Source",     value: "🌐 Web Portal", inline: true },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── Password generated log ────────────────────────────────────────────────────
async function logPasswordGeneratedToDiscord({ username, accessLevel, generatedById }) {
  const channelId = process.env.CHANNEL_AUDIT_LOG || process.env.CHANNEL_MOD_LOG;
  if (!channelId) return;

  const embed = {
    title:  "🔑 Password Login Created",
    color:  0x9b59b6,
    fields: [
      { name: "Username",     value: `\`${username}\``, inline: true },
      { name: "Access Level", value: capitalize(accessLevel), inline: true },
      { name: "Generated By", value: `<@${generatedById}>`, inline: true },
      { name: "Note",         value: "Credentials shared privately — password not logged here", inline: false },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

// ── ERLC command log ──────────────────────────────────────────────────────────
async function logERLCCommandToDiscord({ command, executorId, executorName }) {
  const channelId = process.env.CHANNEL_AUDIT_LOG || process.env.CHANNEL_MOD_LOG;
  if (!channelId) return;

  const embed = {
    title:  "⚡ ERLC Command Executed",
    color:  0x3498db,
    fields: [
      { name: "Command",     value: `\`${command}\``, inline: false },
      { name: "Executed By", value: executorId ? `<@${executorId}>` : executorName, inline: true },
      { name: "Source",      value: "🌐 Web Portal", inline: true },
    ],
    footer:    { text: "Georgia State Roleplay • Staff Portal" },
    timestamp: new Date().toISOString(),
  };

  await postEmbed(channelId, embed);
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

module.exports = {
  logInfractionToDiscord,
  logInfractionRemovedToDiscord,
  logInfractionsClearedToDiscord,
  logPromotionToDiscord,
  logLOAToDiscord,
  logPasswordGeneratedToDiscord,
  logERLCCommandToDiscord,
};
