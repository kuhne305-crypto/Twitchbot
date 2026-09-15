# atlaxx Twitch Bot

Chat-Bot fuer twitch.tv/atlaxx_tv mit:
- Befehlen (`!uptime`, `!discord`, `!punkte`, `!top10`, ...)
- Punkte-/Loyalty-System (Anwesenheitspunkte alle 5 Minuten)
- Custom Commands, die direkt aus dem Chat verwaltet werden koennen
- Moderation (Link-Filter, CAPS-Filter mit Verwarnung -> Timeout via Helix API)

## 1. Twitch-App anlegen

1. Auf https://dev.twitch.tv/console/apps -> "Register Your Application"
2. OAuth Redirect URL: `http://localhost:3000` reicht (wird nur fuer den Token-Flow gebraucht)
3. Category: "Chat Bot"
4. Client ID + Client Secret notieren -> `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET`

## 2. Bot-Account-Token holen (zum Chatten)

1. Mit dem **Bot-Account** (nicht deinem Haupt-Account) einloggen
2. Auf https://twitchtokengenerator.com Scopes `chat:read` + `chat:edit` waehlen und Token generieren
3. Ergibt `BOT_USERNAME` (der Login-Name des Bot-Accounts) und `BOT_OAUTH_TOKEN` (inkl. `oauth:`-Prefix)
4. Den Bot-Account in deinem Kanal als Moderator setzen: `/mod deinbotname` im Chat

## 3. Moderator-Token holen (fuer Timeouts/Bans via API)

Braucht einen User Access Token mit Scopes `moderator:manage:banned_users` und
`moderator:manage:chat_messages`, ausgestellt fuer einen Account, der im Kanal
Moderator ist (der Bot-Account selbst funktioniert dafuer auch).

Am einfachsten wieder ueber https://twitchtokengenerator.com mit genau diesen
zwei Scopes -> liefert Access Token **und** Refresh Token:
- `MOD_ACCESS_TOKEN`
- `MOD_REFRESH_TOKEN`

User-IDs holst du dir z.B. ueber https://streamscharts.com/tools/convert-username
oder jede "twitch username to id"-Seite:
- `BROADCASTER_USER_ID` = User-ID von atlaxx_tv
- `MOD_USER_ID` = User-ID des Bot-/Mod-Accounts

## 4. Lokal testen

```bash
npm install
cp .env.example .env
# .env mit deinen Werten ausfuellen
npm start
```

## 5. Auf GitHub pushen

```bash
git init
git add .
git commit -m "Initial commit: Twitch Bot fuer atlaxx_tv"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/DEIN-REPO.git
git push -u origin main
```

`.env` wird durch `.gitignore` **nicht** mitgepusht - das ist Absicht, die
Tokens gehoeren niemals in ein Repo.

## 6. Auf Railway deployen

1. https://railway.app -> "New Project" -> "Deploy from GitHub repo"
2. Dein Repo auswaehlen (Railway erkennt Node.js automatisch via `package.json`,
   die `railway.json` legt zusaetzlich den Start-Befehl fest)
3. Unter "Variables" alle Werte aus `.env.example` eintragen (echte Werte, nicht
   die Platzhalter)
4. Deploy abwarten - danach in den Logs pruefen, ob `[connect] Verbunden mit ...`
   erscheint

### Punktestand dauerhaft speichern

Ohne extra Konfiguration liegt die SQLite-Datei (`bot.db`) im fluechtigen
Container-Dateisystem und geht bei jedem neuen Deploy verloren. Fuer dauerhafte
Punktestaende in Railway unter "Volumes" ein Volume anlegen, z.B. gemountet auf
`/data`, und die Variable `DB_PATH=/data/bot.db` setzen.

## Befehle im Chat

| Befehl | Wer | Beschreibung |
|---|---|---|
| `!uptime` | alle | Zeigt, wie lange der Stream schon laeuft |
| `!discord` | alle | Postet den Discord-Invite |
| `!punkte` / `!punkte <user>` | alle | Zeigt Punktestand |
| `!top10` | alle | Punkte-Bestenliste |
| `!givepoints <user> <anzahl>` | Mod/Broadcaster | Vergibt Punkte manuell |
| `!command add <name> <antwort>` | Mod/Broadcaster | Legt Custom Command an/ueberschreibt ihn |
| `!command del <name>` | Mod/Broadcaster | Loescht Custom Command |
| `!command list` | Mod/Broadcaster | Listet alle Custom Commands |

## Moderation

- Nachrichten mit Links (ausser dem eigenen Discord-Invite aus `DISCORD_INVITE`)
  und exzessivem CAPSLOCK werden erkannt.
- 1. Verstoss: Verwarnung im Chat.
- Ab dem 2. Verstoss: automatischer Timeout (Dauer verdoppelt sich pro weiterem
  Verstoss, gedeckelt bei 10 Minuten) ueber die Twitch Helix API.
- Mods und der Broadcaster selbst werden nie moderiert.

Die Filterregeln (Link-Erkennung, CAPS-Schwellenwert, Timeout-Dauern) stehen in
`src/moderation.js` und lassen sich dort direkt anpassen.
