const { request } = require("undici");

let appTokenCache = { token: null, expiresAt: 0 };

/**
 * App Access Token via Client-Credentials-Flow.
 * Wird fuer "oeffentliche" Helix-Endpunkte gebraucht (Get Streams, Get Users, Get Follows).
 */
async function getAppAccessToken() {
  if (appTokenCache.token && Date.now() < appTokenCache.expiresAt) {
    return appTokenCache.token;
  }

  const res = await request("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    }).toString(),
  });

  const data = await res.body.json();
  if (!data.access_token) {
    throw new Error("App Access Token konnte nicht geholt werden: " + JSON.stringify(data));
  }

  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return appTokenCache.token;
}

/**
 * Moderator User Access Token. Wird fuer Timeouts/Bans/Message-Delete gebraucht.
 * Haelt den Token im Speicher und erneuert ihn automatisch ueber den Refresh Token,
 * wenn er abgelaufen ist (Twitch User Tokens laufen typischerweise nach ein paar
 * Stunden ab).
 */
let modTokenCache = {
  token: process.env.MOD_ACCESS_TOKEN,
  refreshToken: process.env.MOD_REFRESH_TOKEN,
};

async function refreshModeratorToken() {
  const res = await request("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: modTokenCache.refreshToken,
    }).toString(),
  });

  const data = await res.body.json();
  if (!data.access_token) {
    throw new Error(
      "Moderator-Token konnte nicht erneuert werden - bitte MOD_ACCESS_TOKEN/MOD_REFRESH_TOKEN in Railway neu setzen: " +
        JSON.stringify(data)
    );
  }

  modTokenCache.token = data.access_token;
  modTokenCache.refreshToken = data.refresh_token || modTokenCache.refreshToken;
  console.log("[auth] Moderator-Token erneuert.");
  return modTokenCache.token;
}

function getModeratorToken() {
  return modTokenCache.token;
}

module.exports = {
  getAppAccessToken,
  getModeratorToken,
  refreshModeratorToken,
};
