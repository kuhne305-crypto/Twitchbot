require("dotenv").config();
const tmi = require("tmi.js");
const cron = require("node-cron");

const { handleCommand } = require("./commands");
const { moderateMessage } = require("./moderation");
const points = require("./points");

const required = ["BOT_USERNAME", "BOT_OAUTH_TOKEN", "CHANNEL_NAME"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[config] Fehlende Umgebungsvariable: ${key}`);
    process.exit(1);
  }
}

const ids = {
  broadcasterId: process.env.BROADCASTER_USER_ID || null,
  moderatorId: process.env.MOD_USER_ID || null,
};

const client = new tmi.Client({
  options: { debug: false, skipMembership: true },
  connection: { reconnect: true, secure: true },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.BOT_OAUTH_TOKEN,
  },
  channels: [process.env.CHANNEL_NAME],
});

client.connect().catch((err) => console.error("[connect] Fehler:", err));

client.on("connected", (addr, port) => {
  console.log(`[connect] Verbunden mit ${addr}:${port}, Kanal #${process.env.CHANNEL_NAME}`);
});

// Wer aktiv chattet, sammelt passiv Punkte fuer Anwesenheit
const activeChatters = new Set();

client.on("message", async (channel, tags, message, self) => {
  if (self) return;

  activeChatters.add(tags.username);

  const trimmed = message.trim();

  if (trimmed.startsWith("!")) {
    try {
      await handleCommand({ client, channel, tags, message: trimmed });
    } catch (err) {
      console.error("[command] Fehler:", err);
    }
    return; // Befehle nicht zusaetzlich durch den Moderationsfilter jagen
  }

  try {
    await moderateMessage({ client, channel, tags, message: trimmed, ids });
  } catch (err) {
    console.error("[moderation] Fehler:", err);
  }
});

// Alle 5 Minuten: aktive Chatter bekommen Anwesenheits-Punkte
const POINTS_PER_INTERVAL = 5;
cron.schedule("*/5 * * * *", () => {
  if (activeChatters.size === 0) return;
  for (const username of activeChatters) {
    points.addPoints(username, POINTS_PER_INTERVAL);
    points.addWatchMinutes(username, 5);
  }
  console.log(`[points] ${POINTS_PER_INTERVAL} Punkte an ${activeChatters.size} aktive Chatter vergeben.`);
  activeChatters.clear();
});

process.on("SIGTERM", () => {
  console.log("[shutdown] SIGTERM erhalten, beende Bot...");
  client.disconnect().finally(() => process.exit(0));
});
