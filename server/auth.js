/**
 * auth.js — Passport Discord OAuth2 setup + role resolution.
 * Role definitions live in roles.js — edit that file to change access.
 */

const passport = require("passport");
const axios    = require("axios");
const { StaffUser } = require("./db");
const { resolveRole } = require("./roles");

/**
 * Fetch the Discord guild member object for a user.
 * Returns their role ID array, or [] on any failure.
 *
 * @param {string} discordId
 * @returns {Promise<string[]>}
 */
async function getGuildRoles(discordId) {
  const guildId  = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
    console.error("[Auth] DISCORD_GUILD_ID or DISCORD_BOT_TOKEN not set");
    return [];
  }

  try {
    const res = await axios.get(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      { headers: { Authorization: `Bot ${botToken}` }, timeout: 6000 }
    );
    const roles = res.data.roles || [];
    console.log(`[Auth] ${discordId} has ${roles.length} roles: [${roles.join(", ")}]`);
    return roles;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      console.warn(`[Auth] User ${discordId} is not in guild ${guildId}`);
    } else if (status === 401 || status === 403) {
      console.error(`[Auth] Bot token invalid (HTTP ${status}) — check DISCORD_BOT_TOKEN`);
    } else {
      console.error(`[Auth] Guild member fetch failed (HTTP ${status}):`, err.response?.data || err.message);
    }
    return [];
  }
}

// ── Passport Discord Strategy ─────────────────────────────────────────────────

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  const { Strategy: DiscordStrategy } = require("passport-discord");

  passport.use(new DiscordStrategy(
    {
      clientID:     process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL:  process.env.DISCORD_CALLBACK_URL,
      scope:        ["identify"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`[Auth] OAuth callback: ${profile.username} (${profile.id})`);

        const guildRoles = await getGuildRoles(profile.id);
        const resolved   = resolveRole(guildRoles);

        if (!resolved) {
          console.warn(`[Auth] No staff role for ${profile.username} — roles: [${guildRoles.join(", ")}]`);
          return done(null, false, { message: "no_staff_role" });
        }

        console.log(`[Auth] ${profile.username} → level="${resolved.level}" label="${resolved.label}"`);

        const user = await StaffUser.findOneAndUpdate(
          { discordId: profile.id },
          {
            discordId:       profile.id,
            discordUsername: profile.username,
            discordAvatar:   profile.avatar,
            discordRoles:    guildRoles,
            accessLevel:     resolved.level,
            roleLabel:       resolved.label,
            authMethod:      "discord",
            lastLogin:       Date.now(),
          },
          { upsert: true, new: true }
        );

        return done(null, user.toObject());
      } catch (err) {
        console.error("[Auth] Strategy error:", err);
        return done(err);
      }
    }
  ));
} else {
  console.warn("[Auth] DISCORD_CLIENT_ID / SECRET not set — Discord login disabled");
}

passport.serializeUser((user, done) => done(null, user._id?.toString() || user._id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await StaffUser.findById(id).lean();
    done(null, user || null);
  } catch (err) {
    done(err);
  }
});

module.exports = { passport, getGuildRoles, resolveRole };
