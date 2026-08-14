/**
 * erlc.js — ERLC API v2 integration for the staff portal.
 * Base: https://api.erlc.gg/v2
 */

const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

const BASE = "https://api.erlc.gg/v2";

function headers() {
  return { "server-key": process.env.ERLC_SERVER_KEY };
}

// Routes outbound requests through Fixie's static IP when on Vercel
function proxyAgent() {
  return process.env.FIXIE_URL ? new HttpsProxyAgent(process.env.FIXIE_URL) : undefined;
}

/**
 * Wraps an axios error so the real ERLC response body is surfaced.
 * Attaches a `statusCode` property so callers can forward the right HTTP status.
 */
function wrapErlcError(err) {
  if (err.response) {
    // ERLC returned a response with an error status
    const body    = err.response.data;
    const message = (body && (body.message || body.error)) || `ERLC API error (${err.response.status})`;
    const wrapped = new Error(message);
    wrapped.statusCode = err.response.status;
    wrapped.erlcBody   = body;
    return wrapped;
  }
  // Network-level error (no response at all)
  const wrapped = new Error(err.message || "Failed to reach ERLC API");
  wrapped.statusCode = 502;
  return wrapped;
}

async function getServer(opts = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v) params.set(k, "true");
  }
  const query = params.toString() ? `?${params}` : "";

  const attempt = async (useProxy) => {
    return axios.get(`${BASE}/server${query}`, {
      headers: headers(),
      ...(useProxy && proxyAgent() ? { httpsAgent: proxyAgent() } : {}),
    });
  };

  try {
    const res = await attempt(true);
    return res.data;
  } catch (err) {
    // 407 = proxy auth failed — retry without proxy
    if (err.response?.status === 407 || err.message?.includes('407')) {
      try {
        const res = await attempt(false);
        return res.data;
      } catch (err2) {
        throw wrapErlcError(err2);
      }
    }
    throw wrapErlcError(err);
  }
}

async function getPlayers() {
  return getServer({ Players: true }).then(d => d.Players || []);
}

async function getQueue() {
  return getServer({ Queue: true }).then(d => d.Queue || []);
}

async function getCommandLogs() {
  return getServer({ CommandLogs: true }).then(d => d.CommandLogs || []);
}

async function getKillLogs() {
  return getServer({ KillLogs: true }).then(d => d.KillLogs || []);
}

async function getJoinLogs() {
  return getServer({ JoinLogs: true }).then(d => d.JoinLogs || []);
}

async function getVehicles() {
  return getServer({ Vehicles: true }).then(d => d.Vehicles || []);
}

async function getStaff() {
  return getServer({ Staff: true }).then(d => d.Staff || {});
}

async function getModCalls() {
  return getServer({ ModCalls: true }).then(d => d.ModCalls || []);
}

async function getEmergencyCalls() {
  return getServer({ EmergencyCalls: true }).then(d => d.EmergencyCalls || []);
}

async function runCommand(command) {
  const attempt = async (useProxy) => {
    return axios.post(
      `${BASE}/server/command`,
      { command },
      {
        headers: { ...headers(), "Content-Type": "application/json" },
        ...(useProxy && proxyAgent() ? { httpsAgent: proxyAgent() } : {}),
      }
    );
  };
  try {
    const res = await attempt(true);
    return res.data;
  } catch (err) {
    if (err.response?.status === 407 || err.message?.includes('407')) {
      try {
        const res = await attempt(false);
        return res.data;
      } catch (err2) {
        throw wrapErlcError(err2);
      }
    }
    throw wrapErlcError(err);
  }
}

module.exports = {
  getServer, getPlayers, getQueue, getCommandLogs,
  getKillLogs, getJoinLogs, getVehicles, getStaff,
  getModCalls, getEmergencyCalls, runCommand,
};
