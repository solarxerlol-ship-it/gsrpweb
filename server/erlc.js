/**
 * erlc.js — ERLC API v2 integration for the staff portal.
 * Base: https://api.erlc.gg/v2
 */

const axios = require("axios");

const BASE = "https://api.erlc.gg/v2";

function headers() {
  return { "server-key": process.env.ERLC_SERVER_KEY };
}

async function getServer(opts = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v) params.set(k, "true");
  }
  const query = params.toString() ? `?${params}` : "";
  const res = await axios.get(`${BASE}/server${query}`, { headers: headers() });
  return res.data;
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
  const res = await axios.post(
    `${BASE}/server/command`,
    { command },
    { headers: { ...headers(), "Content-Type": "application/json" } }
  );
  return res.data;
}

module.exports = {
  getServer, getPlayers, getQueue, getCommandLogs,
  getKillLogs, getJoinLogs, getVehicles, getStaff,
  getModCalls, getEmergencyCalls, runCommand,
};
