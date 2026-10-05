"use strict";
/* Penyimpanan CogniTrack: SQLite bawaan Node (node:sqlite), tanpa dependensi npm.
   Anak dan sesi disimpan sebagai dokumen JSON yang sama bentuknya dengan objek di app.js,
   ditambah `rev` untuk mencegah perangkat lain menimpa perubahan yang lebih baru. */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = process.env.COGNITRACK_DATA || path.join(__dirname, "..", "data");
const VIDEO_DIR = path.join(DATA_DIR, "videos");
fs.mkdirSync(VIDEO_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "cognitrack.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS children (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL,
    rev INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    doc TEXT NOT NULL,
    rev INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_child ON sessions(child_id);
  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS videos_session ON videos(session_id);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('ortu', 'guru', 'dokter')),
    name TEXT NOT NULL,
    pass TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);
/* Pemilik anak (akun orang tua). Kolom ditambahkan untuk database yang dibuat sebelum ada login. */
if (!db.prepare("PRAGMA table_info(children)").all().some(c => c.name === "owner_id")) {
  db.exec("ALTER TABLE children ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE CASCADE");
}
db.exec("CREATE INDEX IF NOT EXISTS children_owner ON children(owner_id)");
/* Database lama hanya mengizinkan peran ortu/dokter; bangun ulang tabel users agar peran guru diterima. */
if (!/'guru'/.test(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'users'").get().sql)) {
  db.exec(`PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE users_new (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('ortu', 'guru', 'dokter')), name TEXT NOT NULL, pass TEXT NOT NULL, created_at INTEGER NOT NULL);
    INSERT INTO users_new SELECT id, login, role, name, pass, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    COMMIT;
    PRAGMA foreign_keys = ON;`);
}
/* Murid guru PAUD: guru menambahkan anak dengan kode anak; akses berlaku selama orang tua mengizinkan guru. */
db.exec(`CREATE TABLE IF NOT EXISTS guru_students (
    guru_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (guru_id, child_id)
  )`);

const q = {
  children: db.prepare("SELECT id, doc, rev, owner_id FROM children ORDER BY created_at"),
  sessions: db.prepare("SELECT id, child_id, doc, rev FROM sessions ORDER BY created_at"),
  videos: db.prepare("SELECT id, session_id, name, mime, size, created_at FROM videos ORDER BY created_at"),
  child: db.prepare("SELECT id, doc, rev, owner_id FROM children WHERE id = ?"),
  insChild: db.prepare("INSERT INTO children (id, doc, rev, owner_id, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?)"),
  updChild: db.prepare("UPDATE children SET doc = ?, rev = rev + 1, updated_at = ? WHERE id = ?"),
  delChild: db.prepare("DELETE FROM children WHERE id = ?"),
  session: db.prepare("SELECT id, child_id, status, doc, rev FROM sessions WHERE id = ?"),
  insSession: db.prepare("INSERT INTO sessions (id, child_id, status, doc, rev, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)"),
  updSession: db.prepare("UPDATE sessions SET status = ?, doc = ?, rev = rev + 1, updated_at = ? WHERE id = ?"),
  delSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
  video: db.prepare("SELECT id, session_id, name, mime, size, created_at FROM videos WHERE id = ?"),
  videosOfSession: db.prepare("SELECT id FROM videos WHERE session_id = ?"),
  videosOfChild: db.prepare("SELECT v.id FROM videos v JOIN sessions s ON s.id = v.session_id WHERE s.child_id = ?"),
  insVideo: db.prepare("INSERT INTO videos (id, session_id, name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
  delVideo: db.prepare("DELETE FROM videos WHERE id = ?"),
  userByLogin: db.prepare("SELECT id, login, role, name, pass FROM users WHERE login = ?"),
  insUser: db.prepare("INSERT INTO users (id, login, role, name, pass, created_at) VALUES (?, ?, ?, ?, ?, ?)"),
  setPass: db.prepare("UPDATE users SET pass = ? WHERE id = ?"),
  insAuth: db.prepare("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
  authUser: db.prepare("SELECT u.id, u.login, u.role, u.name FROM auth_sessions a JOIN users u ON u.id = a.user_id WHERE a.token_hash = ? AND a.expires_at > ?"),
  delAuth: db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?"),
  delAuthOfUser: db.prepare("DELETE FROM auth_sessions WHERE user_id = ?"),
  purgeAuth: db.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?"),
  childByCode: db.prepare("SELECT id, doc, owner_id FROM children WHERE json_extract(doc, '$.code') = ?"),
  studentsOf: db.prepare("SELECT child_id FROM guru_students WHERE guru_id = ?"),
  isStudent: db.prepare("SELECT 1 AS ok FROM guru_students WHERE guru_id = ? AND child_id = ?"),
  addStudent: db.prepare("INSERT OR IGNORE INTO guru_students (guru_id, child_id, created_at) VALUES (?, ?, ?)"),
  delStudent: db.prepare("DELETE FROM guru_students WHERE guru_id = ? AND child_id = ?")
};

/* Transaksi boleh bersarang; hanya yang terluar yang membuka dan menutup transaksi SQLite. */
let depth = 0;
function tx(fn) {
  if (depth) { depth++; try { return fn(); } finally { depth--; } }
  db.exec("BEGIN IMMEDIATE"); depth = 1;
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } finally { depth = 0; }
}

const videoPath = id => path.join(VIDEO_DIR, id);
function unlinkVideos(ids) { ids.forEach(id => fs.rm(videoPath(id), { force: true }, () => {})); }

/* Apakah pengguna boleh melihat anak ini. Guru hanya selama anak ada di daftar muridnya dan orang tua mengizinkan guru. */
function canSee(user, row, doc) {
  if (user.role === "dokter") return true;
  if (user.role === "ortu") return row.owner_id === user.id;
  if (user.role === "guru") return !!(doc.consent && doc.consent.guru && q.isStudent.get(user.id, row.id));
  return false;
}
/* Data dalam bentuk yang dipakai app.js: anak beserta sesinya, plus daftar video per sesi.
   Orang tua menerima anaknya sendiri; guru menerima muridnya tanpa nama wali;
   dokter menerima semua anak tanpa nama anak dan nama wali. */
function state(user) {
  const kids = q.children.all().filter(r => canSee(user, r, JSON.parse(r.doc))).map(r => {
    const doc = JSON.parse(r.doc);
    if (user.role === "dokter") doc.name = "";
    if (user.role !== "ortu" && doc.consent) doc.consent = { ...doc.consent, wali: "" };
    return { ...doc, rev: r.rev, sessions: [] };
  });
  const byId = new Map(kids.map(c => [c.id, c]));
  q.sessions.all().forEach(r => { const c = byId.get(r.child_id); if (c) c.sessions.push({ ...JSON.parse(r.doc), rev: r.rev }); });
  const videos = {};
  const sids = new Set(kids.flatMap(c => c.sessions.map(s => s.id)));
  q.videos.all().forEach(v => sids.has(v.session_id) && (videos[v.session_id] = videos[v.session_id] || []).push(publicVideo(v)));
  return { children: kids, videos };
}
const publicVideo = v => ({ id: v.id, name: v.name, mime: v.mime, size: v.size, at: v.created_at });

class Conflict extends Error { constructor(cur) { super("conflict"); this.current = cur; } }
class NotFound extends Error { constructor(what) { super(what + " tidak ditemukan"); } }
class CodeTaken extends Error { constructor() { super("Kode anak sudah dipakai."); } }

/* rev = null berarti rekaman baru; selain itu harus sama dengan rev di server. */
function putChild(id, doc, rev, ownerId) {
  return tx(() => {
    const cur = q.child.get(id), now = Date.now();
    if (!cur) {
      if (rev != null) throw new NotFound("Anak");
      if (q.childByCode.get(doc.code)) throw new CodeTaken();
      q.insChild.run(id, JSON.stringify(doc), ownerId, now, now);
      return 1;
    }
    if (cur.owner_id !== ownerId) throw new NotFound("Anak");
    if (JSON.parse(cur.doc).code !== doc.code) throw new Error("Kode anak tidak dapat diubah.");
    if (rev !== cur.rev) throw new Conflict({ ...JSON.parse(cur.doc), rev: cur.rev });
    q.updChild.run(JSON.stringify(doc), now, id);
    return cur.rev + 1;
  });
}
function deleteChild(id) {
  const vids = q.videosOfChild.all(id).map(r => r.id);
  const n = q.delChild.run(id).changes;
  unlinkVideos(vids);
  return n > 0;
}

/* allow(lama, baru) memeriksa hak pengguna atas perubahan; lama = null untuk sesi baru. */
function putSession(id, childId, doc, rev, allow) {
  return tx(() => {
    const cur = q.session.get(id), now = Date.now(), child = q.child.get(childId);
    if (!child) throw new NotFound("Anak");
    allow(child, cur ? JSON.parse(cur.doc) : null);
    if (!cur) {
      if (rev != null) throw new NotFound("Sesi");
      q.insSession.run(id, childId, doc.status, JSON.stringify(doc), now, now);
      return 1;
    }
    if (cur.child_id !== childId) throw new NotFound("Sesi");
    if (rev !== cur.rev) throw new Conflict({ ...JSON.parse(cur.doc), rev: cur.rev });
    /* Hasil yang sudah diverifikasi dokter tidak dapat dibuka kembali. */
    if (cur.status === "terverifikasi" && doc.status !== "terverifikasi") throw new Error("Sesi yang sudah diverifikasi tidak dapat diubah statusnya.");
    q.updSession.run(doc.status, JSON.stringify(doc), now, id);
    return cur.rev + 1;
  });
}
function deleteSession(id) {
  const vids = q.videosOfSession.all(id).map(r => r.id);
  const n = q.delSession.run(id).changes;
  unlinkVideos(vids);
  return n > 0;
}

const getSession = id => q.session.get(id);
function getChild(id) { const r = q.child.get(id); return r ? { ...JSON.parse(r.doc), owner_id: r.owner_id } : null; }
const countOwned = ownerId => q.children.all().filter(r => r.owner_id === ownerId).length;
function childRow(id) { const r = q.child.get(id); return r ? { row: r, doc: JSON.parse(r.doc) } : null; }
function canSeeChild(user, id) { const c = childRow(id); return !!c && canSee(user, c.row, c.doc); }
const childByCode = code => { const r = q.childByCode.get(code); return r ? { id: r.id, doc: JSON.parse(r.doc) } : null; };
const codeTaken = code => !!q.childByCode.get(code);
const addStudent = (guruId, childId) => q.addStudent.run(guruId, childId, Date.now()).changes > 0;
const removeStudent = (guruId, childId) => q.delStudent.run(guruId, childId).changes > 0;

/* ---------- akun dan sesi masuk ---------- */
const userByLogin = login => q.userByLogin.get(login);
function addUser(id, login, role, name, pass) { q.insUser.run(id, login, role, name, pass, Date.now()); }
function setPassword(id, pass) { q.setPass.run(pass, id); q.delAuthOfUser.run(id); }
function addAuth(hash, userId, expires) { q.purgeAuth.run(Date.now()); q.insAuth.run(hash, userId, expires); }
const authUser = hash => q.authUser.get(hash, Date.now());
const delAuth = hash => q.delAuth.run(hash);
const getVideo = id => q.video.get(id);
function addVideo(id, sessionId, name, mime, size) {
  const now = Date.now();
  q.insVideo.run(id, sessionId, name, mime, size, now);
  return publicVideo({ id, name, mime, size, created_at: now });
}
function deleteVideo(id) {
  const n = q.delVideo.run(id).changes;
  unlinkVideos([id]);
  return n > 0;
}

module.exports = { db, tx, DATA_DIR, VIDEO_DIR, videoPath, state, getChild, countOwned, canSeeChild, childByCode, codeTaken, addStudent, removeStudent, CodeTaken, userByLogin, addUser, setPassword, addAuth, authUser, delAuth, putChild, deleteChild, putSession, deleteSession, getSession, getVideo, addVideo, deleteVideo, Conflict, NotFound };
