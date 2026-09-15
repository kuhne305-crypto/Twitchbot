const { request } = require("undici");
const { getAppAccessToken, getModeratorToken, refreshModeratorToken } = require("./twitchAuth");

const HELIX = "https://api.twitch.tv/helix";

async function helixGet(pathAndQuery) {
  const token = await getAppAccessToken();
  const res = await request(HELIX + pathAndQuery, {
    headers: {
      "Client-Id": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`,
    },
  });
  return res.body.json();
}

async function getStreamInfo(channelLogin) {
  const data = await helixGet(`/streams?user_login=${encodeURIComponent(channelLogin)}`);
  return data.data && data.data[0] ? data.data[0] : null;
}

async function getUserId(login) {
  const data = await helixGet(`/users?login=${encodeURIComponent(login)}`);
  return data.data && data.data[0] ? data.data[0].id : null;
}

function formatDuration(startedAt) {
  const ms = Date.now() - new Date(startedAt).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Timeout/Ban ueber Helix (moderator:manage:banned_users noetig).
 * duration in Sekunden weglassen = permanenter Ban.
 */
async function banOrTimeout({ broadcasterId, moderatorId, userId, durationSeconds, reason }) {
  const body = JSON.stringify({
    data: {
      user_id: userId,
      duration: durationSeconds || undefined,
      reason: reason ? reason.slice(0, 500) : undefined,
    },
  });

  const doCall = async (token) =>
    request(
      `${HELIX}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}`,
      {
        method: "POST",
        headers: {
          "Client-Id": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      }
    );

  let token = getModeratorToken();
  let res = await doCall(token);

  if (res.statusCode === 401) {
    token = await refreshModeratorToken();
    res = await doCall(token);
  }

  if (res.statusCode >= 300) {
    const err = await res.body.json().catch(() => ({}));
    throw new Error(`Helix Ban/Timeout fehlgeschlagen (${res.statusCode}): ${JSON.stringify(err)}`);
  }
  return true;
}

/** Chat-Nachricht ueber Helix loeschen (moderator:manage:chat_messages noetig). */
async function deleteMessage({ broadcasterId, moderatorId, messageId }) {
  const doCall = async (token) =>
    request(
      `${HELIX}/moderation/chat?broadcaster_id=${broadcasterId}&moderator_id=${moderatorId}&message_id=${messageId}`,
      {
        method: "DELETE",
        headers: {
          "Client-Id": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${getModeratorToken()}`,
        },
      }
    );

  let res = await doCall();
  if (res.statusCode === 401) {
    await refreshModeratorToken();
    res = await doCall();
  }
  return res.statusCode < 300;
}

module.exports = {
  getStreamInfo,
  getUserId,
  formatDuration,
  banOrTimeout,
  deleteMessage,
};
