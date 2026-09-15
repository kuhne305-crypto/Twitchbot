const path = require("path");
const Database = require("better-sqlite3");

// Auf Railway ohne Volume ist das Dateisystem fluechtig (setzt sich bei jedem
// Deploy zurueck). Fuer dauerhafte Punktestaende: in den Railway-Settings ein
// Volume anlegen und z.B. unter /data mounten, dann DB_PATH=/data/bot.db setzen.
const dbPath = process.env.DB_PATH || path.join(__dirname, "..", "bot.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS points (
    username TEXT PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 0,
    watch_minutes INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS custom_commands (
    name TEXT PRIMARY KEY,
    response TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS warnings (
    username TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    last_warning TEXT
  );
`);

module.exports = db;
