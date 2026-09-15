const db = require("./db");
const points = require("./points");
const { getStreamInfo, formatDuration } = require("./twitchApi");

const getCmdStmt = db.prepare("SELECT * FROM custom_commands WHERE name = ?");
const listCmdStmt = db.prepare("SELECT name FROM custom_commands ORDER BY name");
const upsertCmdStmt = db.prepare(
  "INSERT INTO custom_commands (name, response, created_by) VALUES (?, ?, ?) " +
    "ON CONFLICT(name) DO UPDATE SET response = excluded.response"
);
const deleteCmdStmt = db.prepare("DELETE FROM custom_commands WHERE name = ?");

function isModOrBroadcaster(tags) {
  return tags.mod || tags.badges?.broadcaster === "1";
}

function isAdmin(tags, channel) {
  const extra = (process.env.EXTRA_ADMINS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return isModOrBroadcaster(tags) || extra.includes(tags.username.toLowerCase());
}

/**
 * Verarbeitet eine Chat-Nachricht, die mit "!" beginnt.
 * Gibt true zurueck, wenn ein Befehl ausgefuehrt wurde.
 */
async function handleCommand({ client, channel, tags, message }) {
  const [cmdRaw, ...args] = message.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const channelLogin = channel.replace("#", "");
  const displayName = tags["display-name"] || tags.username;

  switch (cmd) {
    case "!uptime": {
      const stream = await getStreamInfo(channelLogin);
      if (!stream) {
        client.say(channel, `${displayName}, der Kanal ist gerade offline.`);
      } else {
        client.say(channel, `Stream laeuft seit ${formatDuration(stream.started_at)}.`);
      }
      return true;
    }

    case "!discord": {
      const invite = process.env.DISCORD_INVITE || "Kein Discord-Link hinterlegt.";
      client.say(channel, `Unser Discord: ${invite}`);
      return true;
    }

    case "!punkte":
    case "!points": {
      const target = args[0] ? args[0].replace("@", "").toLowerCase() : tags.username;
      const p = points.getPoints(target);
      client.say(channel, `${target} hat ${p} Punkte.`);
      return true;
    }

    case "!top10":
    case "!leaderboard": {
      const top = points.getTop(10);
      if (top.length === 0) {
        client.say(channel, "Noch keine Punkte vergeben.");
      } else {
        const text = top.map((r, i) => `${i + 1}. ${r.username} (${r.points})`).join("  ");
        client.say(channel, `Top 10: ${text}`);
      }
      return true;
    }

    case "!givepoints": {
      if (!isAdmin(tags, channel)) return true;
      const [user, amountStr] = args;
      const amount = parseInt(amountStr, 10);
      if (!user || Number.isNaN(amount)) {
        client.say(channel, "Nutzung: !givepoints <user> <anzahl>");
        return true;
      }
      points.addPoints(user.replace("@", "").toLowerCase(), amount);
      client.say(channel, `${amount} Punkte an ${user} vergeben.`);
      return true;
    }

    case "!command": {
      // !command add <name> <antwort...> | !command del <name> | !command list
      if (!isAdmin(tags, channel)) return true;
      const [action, name, ...rest] = args;

      if (action === "add" && name && rest.length > 0) {
        const cleanName = name.toLowerCase().replace(/^!/, "");
        upsertCmdStmt.run(cleanName, rest.join(" "), tags.username);
        client.say(channel, `Befehl !${cleanName} gespeichert.`);
      } else if (action === "del" && name) {
        const cleanName = name.toLowerCase().replace(/^!/, "");
        deleteCmdStmt.run(cleanName);
        client.say(channel, `Befehl !${cleanName} geloescht.`);
      } else if (action === "list") {
        const all = listCmdStmt.all().map((r) => "!" + r.name);
        client.say(
          channel,
          all.length ? `Custom Befehle: ${all.join(", ")}` : "Keine Custom Befehle vorhanden."
        );
      } else {
        client.say(channel, "Nutzung: !command add <name> <antwort> | !command del <name> | !command list");
      }
      return true;
    }

    default: {
      // Custom Command aus der Datenbank?
      const name = cmd.replace(/^!/, "");
      const row = getCmdStmt.get(name);
      if (row) {
        client.say(channel, row.response);
        return true;
      }
      return false;
    }
  }
}

module.exports = { handleCommand, isAdmin, isModOrBroadcaster };
