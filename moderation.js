const db = require("./db");
const { banOrTimeout, deleteMessage } = require("./twitchApi");

const URL_REGEX = /\b((https?:\/\/)|(www\.)|([a-z0-9-]+\.(tv|com|gg|net|org|io|de|co)\b))/i;
const CAPS_MIN_LENGTH = 12;
const CAPS_RATIO = 0.7;

const warnStmt = db.prepare(
  "INSERT INTO warnings (username, count, last_warning) VALUES (?, 1, datetime('now')) " +
    "ON CONFLICT(username) DO UPDATE SET count = count + 1, last_warning = datetime('now')"
);
const getWarnStmt = db.prepare("SELECT count FROM warnings WHERE username = ?");

// Erlaubte Links, z.B. der eigene Discord/Socials. Klein schreiben.
const ALLOWLIST = (process.env.DISCORD_INVITE || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isCapsSpam(message) {
  const letters = message.replace(/[^a-zA-Z]/g, "");
  if (letters.length < CAPS_MIN_LENGTH) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length >= CAPS_RATIO;
}

function containsLink(message) {
  const lower = message.toLowerCase();
  if (ALLOWLIST.some((allowed) => allowed && lower.includes(allowed))) return false;
  return URL_REGEX.test(message);
}

/**
 * Prueft eine Nachricht gegen die Moderationsregeln.
 * Gibt zurueck, ob eingegriffen wurde.
 */
async function moderateMessage({ client, channel, tags, message, ids }) {
  const username = tags.username;
  const isMod = tags.mod || tags.badges?.broadcaster === "1";
  if (isMod) return false; // Mods/Broadcaster nie moderieren

  let violation = null;
  if (containsLink(message)) violation = "Links sind in diesem Chat nicht erlaubt.";
  else if (isCapsSpam(message)) violation = "Bitte nicht so viel CAPS LOCK verwenden.";

  if (!violation) return false;

  const row = getWarnStmt.get(username);
  const priorCount = row ? row.count : 0;
  warnStmt.run(username);

  // Nachricht loeschen, wenn wir eine message-id haben
  if (tags.id && ids?.broadcasterId && ids?.moderatorId) {
    deleteMessage({
      broadcasterId: ids.broadcasterId,
      moderatorId: ids.moderatorId,
      messageId: tags.id,
    }).catch((e) => console.error("[mod] Loeschen fehlgeschlagen:", e.message));
  }

  if (priorCount === 0) {
    client.say(channel, `@${tags["display-name"] || username}, ${violation} (1. Verwarnung)`);
    return true;
  }

  // Ab der 2. Verstoss: Timeout, steigende Dauer
  const timeoutSeconds = Math.min(600, 30 * Math.pow(2, priorCount)); // 60s, 120s, 240s, ... max 10min
  try {
    if (ids?.broadcasterId && ids?.moderatorId) {
      const { getUserId } = require("./twitchApi");
      const userId = tags["user-id"] || (await getUserId(username));
      await banOrTimeout({
        broadcasterId: ids.broadcasterId,
        moderatorId: ids.moderatorId,
        userId,
        durationSeconds: timeoutSeconds,
        reason: violation,
      });
      client.say(
        channel,
        `@${tags["display-name"] || username} wurde fuer ${timeoutSeconds}s getimeoutet: ${violation}`
      );
    }
  } catch (e) {
    console.error("[mod] Timeout fehlgeschlagen:", e.message);
  }
  return true;
}

module.exports = { moderateMessage };
