/**
 * auth.js — Passport Discord OAuth2 setup.
 * Wrapped defensively so missing env vars don't crash the cold start.
 */

const passport = require("passport");
const axios    = require("axios");
const { StaffUser } = require("./db");

const ROLE_MAP = () => ({
  owner:      process.env.ROLE_OWNER,
  management: process.env.ROLE_MANAGEMENT,
  admin:      process.env.ROLE_ADMIN,
  moderator:  process.env.ROLE_MODERATOR,
  staff:      process.env.ROLE_STAFF,
});

function resolveAccessLevel(roleIds) {
  const map = ROLE_MAP();
  if (map.owner      && roleIds.includes(map.owner))      return "owner";
  if (map.management && roleIds.includes(map.management)) return "management";
  if (map.admin      && roleIds.includes(map.admin))      return "admin";
  if (map.moderator  && roleIds.includes(map.moderator))  return "moderator";
  if (map.staff      && roleIds.includes(map.staff))      return "staff";
  return null;
}

async function getGuildRoles(discordId) {
  try {
    const res = await axios.get(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } }
    );
    return res.data.roles || [];
  } catch {
    return [];
  }
}

// Only register the Discord strategy if credentials are present
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
        const guildRoles  = await getGuildRoles(profile.id);
        const accessLevel = resolveAccessLevel(guildRoles);

        if (!accessLevel) {
          return done(null, false, { message: "no_staff_role" });
        }

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
