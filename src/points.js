const db = require("./db");

const getStmt = db.prepare("SELECT * FROM points WHERE username = ?");
const insertStmt = db.prepare(
  "INSERT INTO points (username, points, watch_minutes) VALUES (?, 0, 0)"
);
const addPointsStmt = db.prepare(
  "UPDATE points SET points = points + ? WHERE username = ?"
);
const addWatchStmt = db.prepare(
  "UPDATE points SET watch_minutes = watch_minutes + ? WHERE username = ?"
);
const topStmt = db.prepare(
  "SELECT username, points FROM points ORDER BY points DESC LIMIT ?"
);

function ensureUser(username) {
  const row = getStmt.get(username);
  if (!row) {
    insertStmt.run(username);
    return getStmt.get(username);
  }
  return row;
}

function getPoints(username) {
  return ensureUser(username).points;
}

function addPoints(username, amount) {
  ensureUser(username);
  addPointsStmt.run(amount, username);
}

function removePoints(username, amount) {
  ensureUser(username);
  addPointsStmt.run(-Math.abs(amount), username);
}

function addWatchMinutes(username, minutes) {
  ensureUser(username);
  addWatchStmt.run(minutes, username);
}

function getTop(n = 10) {
  return topStmt.all(n);
}

module.exports = {
  ensureUser,
  getPoints,
  addPoints,
  removePoints,
  addWatchMinutes,
  getTop,
};
