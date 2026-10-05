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
`);

const q = {
  children: db.prepare("SELECT id, doc, rev FROM children ORDER BY created_at"),
  sessions: db.prepare("SELECT id, child_id, doc, rev FROM sessions ORDER BY created_at"),
  videos: db.prepare("SELECT id, session_id, name, mime, size, created_at FROM videos ORDER BY created_at"),
  child: db.prepare("SELECT id, doc, rev FROM children WHERE id = ?"),
  insChild: db.prepare("INSERT INTO children (id, doc, rev, created_at, updated_at) VALUES (?, ?, 1, ?, ?)"),
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
  delVideo: db.prepare("DELETE FROM videos WHERE id = ?")
};

function tx(fn) {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}

const videoPath = id => path.join(VIDEO_DIR, id);
function unlinkVideos(ids) { ids.forEach(id => fs.rm(videoPath(id), { force: true }, () => {})); }

/* Seluruh data dalam bentuk yang dipakai app.js: anak beserta sesinya, plus daftar video per sesi. */
function state() {
  const kids = q.children.all().map(r => ({ ...JSON.parse(r.doc), rev: r.rev, sessions: [] }));
  const byId = new Map(kids.map(c => [c.id, c]));
  q.sessions.all().forEach(r => { const c = byId.get(r.child_id); if (c) c.sessions.push({ ...JSON.parse(r.doc), rev: r.rev }); });
  const videos = {};
  q.videos.all().forEach(v => (videos[v.session_id] = videos[v.session_id] || []).push(publicVideo(v)));
  return { children: kids, videos };
}
const publicVideo = v => ({ id: v.id, name: v.name, mime: v.mime, size: v.size, at: v.created_at });

class Conflict extends Error { constructor(cur) { super("conflict"); this.current = cur; } }
class NotFound extends Error { constructor(what) { super(what + " tidak ditemukan"); } }

/* rev = null berarti rekaman baru; selain itu harus sama dengan rev di server. */
function putChild(id, doc, rev) {
  return tx(() => {
    const cur = q.child.get(id), now = Date.now();
    if (!cur) {
      if (rev != null) throw new NotFound("Anak");
      q.insChild.run(id, JSON.stringify(doc), now, now);
      return 1;
    }
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

function putSession(id, childId, doc, rev) {
  return tx(() => {
    const cur = q.session.get(id), now = Date.now();
    if (!q.child.get(childId)) throw new NotFound("Anak");
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
function getChild(id) { const r = q.child.get(id); return r ? JSON.parse(r.doc) : null; }
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

module.exports = { DATA_DIR, VIDEO_DIR, videoPath, state, getChild, putChild, deleteChild, putSession, deleteSession, getSession, getVideo, addVideo, deleteVideo, Conflict, NotFound };
