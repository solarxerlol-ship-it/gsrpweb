/**
 * auth.js — Passport Discord OAuth2 + session middleware setup.
 */

const passport    = require("passport");
const { Strategy: DiscordStrategy } = require("passport-discord");
const axios       = require("axios");
const { StaffUser } = require("./db");

const ROLE_MAP = {
  owner:      process.env.ROLE_OWNER,
  management: process.env.ROLE_MANAGEMENT,
  admin:      process.env.ROLE_ADMIN,
  moderator:  process.env.ROLE_MODERATOR,
  staff:      process.env.ROLE_STAFF,
};

/** Determine highest access level from a list of Discord role IDs */
function resolveAccessLevel(roleIds) {
  if (roleIds.includes(ROLE_MAP.owner))      return "owner";
  if (roleIds.includes(ROLE_MAP.management)) return "management";
  if (roleIds.includes(ROLE_MAP.admin))      return "admin";
  if (roleIds.includes(ROLE_MAP.moderator))  return "moderator";
  if (roleIds.includes(ROLE_MAP.staff))      return "staff";
  return null; // not staff
}

/** Fetch guild member roles via bot token */
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
          authMethod: "discord",
          lastLogin:  Date.now(),
        },
        { upsert: true, new: true }
      );

      return done(null, user.toObject());
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user._id.toString()));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await StaffUser.findById(id).lean();
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = { passport, resolveAccessLevel, getGuildRoles };
