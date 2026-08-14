/**
 * auth.js — Passport Discord OAuth2 setup + role resolution.
 */

const passport = require("passport");
const axios    = require("axios");
const { StaffUser } = require("./db");

// Role ID → access level map (read fresh from env each call so hot-reload works)
const ROLE_MAP = () => ({
  owner:      process.env.ROLE_OWNER,
  management: process.env.ROLE_MANAGEMENT,
  admin:      process.env.ROLE_ADMIN,
  moderator:  process.env.ROLE_MODERATOR,
  staff:      process.env.ROLE_STAFF,
});

/**
 * Given an array of role ID strings, return the highest access level or null.
 * Checks from highest → lowest so an owner doesn't just get "staff".
 */
function resolveAccessLevel(roleIds) {
  const map = ROLE_MAP();

  // Validate that role IDs are actually configured
  const configured = Object.entries(map).filter(([, id]) => id && id.trim());
  if (!configured.length) {
    console.error("[Auth] No ROLE_* env vars are set — cannot resolve access level");
    return null;
  }

  // Check highest → lowest
  const order = ["owner", "management", "admin", "moderator", "staff"];
  for (const level of order) {
    const roleId = map[level];
    if (roleId && roleIds.includes(roleId)) {
      return level;
    }
  }
  return null;
}

/**
 * Fetch the guild member's role IDs via the bot token.
 * Returns an empty array on failure with a clear console error.
 */
async function getGuildRoles(discordId) {
  const guildId  = process.env.DISCORD_GUILD_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!guildId || !botToken) {
    console.error("[Auth] DISCORD_GUILD_ID or DISCORD_BOT_TOKEN not set — cannot fetch guild roles");
    return [];
  }

  try {
    const res = await axios.get(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${botToken}` },
        timeout: 5000,
      }
    );
    const roles = res.data.roles || [];
    console.log(`[Auth] Fetched ${roles.length} roles for Discord user ${discordId}:`, roles);
    return roles;
  } catch (err) {
    const status = err.response?.status;
    const body   = err.response?.data;
    if (status === 404) {
      // User is not in the guild at all
      console.warn(`[Auth] Discord user ${discordId} is not a member of guild ${guildId}`);
    } else if (status === 401 || status === 403) {
      console.error(`[Auth] Bot token rejected by Discord (${status}) — check DISCORD_BOT_TOKEN`);
    } else {
      console.error(`[Auth] Failed to fetch guild roles for ${discordId}: HTTP ${status}`, body);
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
        console.log(`[Auth] Discord OAuth callback for user: ${profile.username} (${profile.id})`);

        const guildRoles  = await getGuildRoles(profile.id);
        const accessLevel = resolveAccessLevel(guildRoles);

        if (!accessLevel) {
          console.warn(`[Auth] No matching staff role found for ${profile.username} (${profile.id})`);
          console.warn(`[Auth] Their roles: [${guildRoles.join(", ")}]`);
          console.warn(`[Auth] Configured role IDs:`, ROLE_MAP());
          return done(null, false, { message: "no_staff_role" });
        }

        console.log(`[Auth] Granting "${accessLevel}" access to ${profile.username}`);

        const user = await StaffUser.findOneAndUpdate(
          { discordId: profile.id },
          {
            discordId:       profile.id,
            discordUsername: profile.username,
            discordAvatar:   profile.avatar,
            discordRoles:    guildRoles,
            accessLevel,
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

module.exports = { passport, resolveAccessLevel, getGuildRoles };
