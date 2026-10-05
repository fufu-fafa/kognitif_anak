"use strict";
/* Server lokal CogniTrack: menyajikan berkas situs dan API data/video.
   Jalankan: npm start  (lalu buka http://localhost:3000)
   Variabel lingkungan: PORT (3000), HOST (127.0.0.1; pakai 0.0.0.0 agar dapat dibuka dari perangkat lain di jaringan),
   COGNITRACK_DATA (folder data/), MAX_VIDEO_MB (300), ALLOW_REGISTER (1; 0 = orang tua tidak dapat mendaftar sendiri).
   Akun dokter dibuat lewat baris perintah: npm run user -- add-doctor <email/HP> "<nama>" */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const store = require("./db");
const auth = require("./auth");
const { seedDemo } = require("./demo");

const ROOT = path.join(__dirname, "..");
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_JSON = 1 << 20;
const MAX_VIDEO = (+process.env.MAX_VIDEO_MB || 300) * 1024 * 1024;
const ALLOW_REGISTER = process.env.ALLOW_REGISTER !== "0";

/* Formulir KPSP dibaca dari berkas yang sama dengan yang dipakai peramban, supaya validasi tidak menyimpang. */
const { KPSP } = vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", "kpsp.js"), "utf8") + "\n;({ KPSP })");

/* ---------- validasi ---------- */
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLES = ["ortu", "guru", "dokter"];
const STATUS = ["draft", "menunggu", "terverifikasi"];
const isBool = x => typeof x === "boolean";
const isStr = (x, max) => typeof x === "string" && x.length <= max;
const isTime = x => Number.isFinite(x) && x > 0;

function checkChild(c, id) {
  if (!c || typeof c !== "object" || Array.isArray(c)) return "Data anak tidak valid.";
  if (c.id !== id) return "ID anak tidak cocok.";
  if (!/^CT-[A-Z0-9]{4}$/.test(c.code || "")) return "Kode anak tidak valid.";
  if (!isStr(c.name, 40) || !c.name.trim()) return "Nama panggilan wajib diisi (maks. 40 karakter).";
  if (!ISO_DATE.test(c.dob || "") || c.dob > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) return "Tanggal lahir tidak valid.";
  if (!isBool(c.prem)) return "Isian prematur tidak valid.";
  const s = c.consent;
  if (s !== null && s !== undefined) {
    if (typeof s !== "object" || s.data !== true) return "Persetujuan pengolahan data wajib.";
    if (!isStr(s.wali, 60) || !s.wali.trim()) return "Nama orang tua atau wali wajib diisi.";
    if (!isBool(s.video) || !isBool(s.guru)) return "Isian persetujuan tidak valid.";
  }
  return "";
}
function checkSession(s, id) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return "Data sesi tidak valid.";
  if (s.id !== id) return "ID sesi tidak cocok.";
  const items = KPSP[s.form];
  if (!items) return "Formulir KPSP tidak dikenal.";
  if (!STATUS.includes(s.status)) return "Status sesi tidak valid.";
  if (!ROLES.includes(s.by)) return "Pengisi sesi tidak valid.";
  if (!ISO_DATE.test(s.at || "")) return "Tanggal sesi tidak valid.";
  if (!Array.isArray(s.answers) || s.answers.length !== items.length || !s.answers.every(a => a === null || isBool(a))) return "Jawaban tidak valid.";
  if (s.status !== "draft") {
    if (s.answers.some(a => a === null)) return "Semua butir harus dijawab sebelum dikirim.";
    if (!isTime(s.submittedAt)) return "Waktu kirim tidak valid.";
  }
  if (s.status === "terverifikasi") {
    const v = s.verify;
    if (!v || !Array.isArray(v.final) || v.final.length !== items.length || !v.final.every(isBool)) return "Jawaban akhir dokter tidak valid.";
    if (!isStr(v.doctor, 60) || !v.doctor.trim() || !isTime(v.at)) return "Data verifikasi tidak lengkap.";
  } else if (s.verify) return "Sesi belum diverifikasi tetapi memuat hasil verifikasi.";
  return "";
}

/* ---------- utilitas HTTP ---------- */
class HttpError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra; } }
function send(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}
function readJSON(req) {
  return new Promise((ok, fail) => {
    let size = 0; const parts = [];
    req.on("data", b => { size += b.length; if (size > MAX_JSON) { fail(new HttpError(413, "Data terlalu besar.")); req.destroy(); } else parts.push(b); });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(parts).toString("utf8") || "null")); } catch (e) { fail(new HttpError(400, "JSON tidak valid.")); } });
    req.on("error", fail);
  });
}
/* Rev dikirim lewat If-Match; tanpa If-Match berarti membuat rekaman baru. */
function revOf(req) {
  const h = req.headers["if-match"];
  if (h === undefined) return null;
  const n = parseInt(String(h).replace(/"/g, ""), 10);
  if (!Number.isInteger(n)) throw new HttpError(400, "If-Match tidak valid.");
  return n;
}
function wrapStore(fn) {
  try { return fn(); }
  catch (e) {
    if (e instanceof store.Conflict) throw new HttpError(409, "Data sudah diubah di perangkat lain.", { current: e.current });
    if (e instanceof store.NotFound) throw new HttpError(404, e.message);
    if (e.message && !e.code) throw new HttpError(422, e.message);
    throw e;
  }
}

/* ---------- hak akses ---------- */
function same(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => same(a[k], b[k]));
}
const without = (o, ...keys) => { const c = { ...o }; keys.forEach(k => delete c[k]); return c; };
const forbid = msg => { throw new HttpError(403, msg); };
/* Orang tua mengisi dan mengirim skrining anaknya sendiri; dokter hanya menetapkan hasil atau meminta rekam ulang. */
function sessionGuard(user, doc) {
  return (child, old) => {
    if (user.role === "ortu") {
      if (child.owner_id !== user.id) throw new HttpError(404, "Anak tidak ditemukan.");
      if (!old || old.status === "draft") {
        if (doc.status === "terverifikasi" || doc.verify || doc.rerecord) forbid("Hanya dokter yang dapat menetapkan hasil.");
        if (doc.by !== "ortu") forbid("Pengisi sesi tidak valid.");
        return;
      }
      /* Setelah dikirim, orang tua hanya dapat menandai bahwa video rekam ulang sudah dikirim. */
      const rr = old.rerecord;
      const okRR = rr && !rr.resubmittedAt && doc.rerecord && Number.isFinite(doc.rerecord.resubmittedAt) && same(without(doc.rerecord, "resubmittedAt"), without(rr, "resubmittedAt"));
      if (old.status === "menunggu" && okRR && same(without(doc, "rerecord"), without(old, "rerecord"))) return;
      if (!same(doc, old)) forbid("Skrining yang sudah dikirim tidak dapat diubah.");
      return;
    }
    if (user.role === "dokter") {
      if (!old || old.status !== "menunggu") forbid("Dokter hanya dapat meninjau skrining yang menunggu verifikasi.");
      if (!same(without(doc, "status", "verify", "rerecord"), without(old, "status", "verify", "rerecord"))) forbid("Dokter tidak dapat mengubah jawaban pengguna.");
      if (old.rerecord && !same(doc.rerecord, old.rerecord)) forbid("Rekam ulang hanya dapat diminta sekali.");
      if (doc.status === "terverifikasi" && doc.verify.doctor !== user.name) forbid("Nama dokter harus sesuai akun.");
      if (!old.rerecord && doc.rerecord && (doc.status !== "menunggu" || doc.rerecord.doctor !== user.name || doc.rerecord.resubmittedAt)) forbid("Permintaan rekam ulang tidak valid.");
      return;
    }
    forbid("Akses ditolak.");
  };
}
/* Sesi beserta anaknya, bila pengguna boleh melihatnya. */
function sessionFor(user, sid) {
  const sess = store.getSession(sid), child = sess && store.getChild(sess.child_id);
  if (!sess || !child || (user.role !== "dokter" && child.owner_id !== user.id)) throw new HttpError(404, "Sesi tidak ditemukan.");
  return { sess, child, doc: JSON.parse(sess.doc) };
}

/* ---------- video ---------- */
function receiveVideo(req, user, sid) {
  if (user.role !== "ortu") forbid("Hanya orang tua yang dapat mengunggah video.");
  const { sess } = sessionFor(user, sid);
  if (sess.status === "terverifikasi") throw new HttpError(409, "Sesi sudah diverifikasi; video tidak dapat ditambahkan.");
  const child = store.getChild(sess.child_id);
  if (!child || !child.consent || !child.consent.video) throw new HttpError(403, "Orang tua belum menyetujui perekaman video.");
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (!/^video\/[\w.+-]+$/.test(mime)) throw new HttpError(415, "Berkas harus berupa video.");
  const len = +req.headers["content-length"];
  if (len > MAX_VIDEO) throw new HttpError(413, `Video melebihi batas ${MAX_VIDEO / 1048576} MB.`);
  let name = "video";
  try { name = decodeURIComponent(req.headers["x-filename"] || "video").replace(/[\\/\r\n]/g, "_").slice(0, 120) || "video"; } catch (e) {}

  const id = "v" + crypto.randomBytes(9).toString("base64url");
  const tmp = store.videoPath(id) + ".part";
  return new Promise((ok, fail) => {
    const out = fs.createWriteStream(tmp);
    let size = 0, aborted = false;
    const abort = err => { if (aborted) return; aborted = true; out.destroy(); fs.rm(tmp, { force: true }, () => {}); fail(err); };
    req.on("data", b => { size += b.length; if (size > MAX_VIDEO) { abort(new HttpError(413, `Video melebihi batas ${MAX_VIDEO / 1048576} MB.`)); req.destroy(); } });
    req.on("aborted", () => abort(new HttpError(400, "Unggahan terputus.")));
    req.on("error", abort);
    out.on("error", abort);
    req.pipe(out);
    out.on("finish", () => {
      if (aborted) return;
      if (!size) { fs.rm(tmp, { force: true }, () => {}); return fail(new HttpError(400, "Video kosong.")); }
      fs.rename(tmp, store.videoPath(id), err => {
        if (err) return abort(err);
        /* Sesi bisa dihapus selama unggahan berjalan. */
        if (!store.getSession(sid)) { fs.rm(store.videoPath(id), { force: true }, () => {}); return fail(new HttpError(404, "Sesi tidak ditemukan.")); }
        ok(store.addVideo(id, sid, name, mime, size));
      });
    });
  });
}
function streamVideo(req, res, user, id) {
  const v = store.getVideo(id);
  if (!v) throw new HttpError(404, "Video tidak ditemukan.");
  sessionFor(user, v.session_id);
  const file = store.videoPath(id);
  let size;
  try { size = fs.statSync(file).size; } catch (e) { throw new HttpError(404, "Berkas video hilang."); }
  const head = { "Content-Type": v.mime, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(v.name)}`, "X-Content-Type-Options": "nosniff" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (m && (m[1] || m[2])) {
    let start = m[1] ? +m[1] : size - +m[2], end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
    if (start < 0) start = 0;
    if (start >= size || start > end) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...head, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, "Content-Length": size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

/* ---------- API ---------- */
const publicUser = u => ({ id: u.id, login: u.login, role: u.role, name: u.name });
function signIn(req, res, user, token, code = 200) {
  res.setHeader("Set-Cookie", auth.setCookie(req, token));
  send(res, code, { user: publicUser(user) });
}
async function api(req, res, parts) {
  const [a, id, b, c] = parts, M = req.method;
  if (a === "health" && M === "GET") return send(res, 200, { ok: true });

  if (a === "auth") {
    if (id === "me" && M === "GET") {
      const u = auth.userOf(req);
      return u ? send(res, 200, { user: publicUser(u), register: ALLOW_REGISTER }) : send(res, 401, { error: "Belum masuk.", register: ALLOW_REGISTER });
    }
    if (id === "login" && M === "POST") {
      const body = await readJSON(req) || {};
      const r = auth.login(req, body.login, body.password);
      if (r.error) throw new HttpError(r.code, r.error);
      return signIn(req, res, r.user, r.token);
    }
    if (id === "register" && M === "POST") {
      if (!ALLOW_REGISTER) throw new HttpError(403, "Pendaftaran akun baru sedang ditutup.");
      const body = await readJSON(req) || {};
      let u;
      try { u = auth.createUser({ login: body.login, name: body.name, password: body.password, role: "ortu" }); }
      catch (e) { throw new HttpError(422, e.message); }
      return signIn(req, res, u, auth.startSession(u.id), 201);
    }
    if (id === "logout" && M === "POST") {
      auth.endSession(req);
      res.setHeader("Set-Cookie", auth.setCookie(req, null));
      return send(res, 200, { ok: true });
    }
    throw new HttpError(404, "Rute API tidak ditemukan.");
  }

  const user = auth.userOf(req);
  if (!user) throw new HttpError(401, "Sesi masuk berakhir. Silakan masuk lagi.");
  const ortu = () => { if (user.role !== "ortu") forbid("Hanya orang tua yang dapat melakukan ini."); };

  if (a === "state" && M === "GET" && !id) return send(res, 200, store.state(user));

  if (a === "demo" && M === "POST" && !id) {
    ortu();
    if (store.countOwned(user.id)) throw new HttpError(409, "Data contoh hanya dapat dibuat bila akun belum memiliki data anak.");
    return send(res, 201, { active: seedDemo(user.id, KPSP) });
  }

  if (a === "children" && id && ID.test(id) && !b) {
    ortu();
    if (M === "PUT") {
      const rev = revOf(req), doc = await readJSON(req);
      const err = checkChild(doc, id); if (err) throw new HttpError(422, err);
      const { sessions, rev: _r, owner_id: _o, ...clean } = doc;
      return send(res, 200, { rev: wrapStore(() => store.putChild(id, clean, rev, user.id)) });
    }
    if (M === "DELETE") {
      const ch = store.getChild(id);
      if (!ch || ch.owner_id !== user.id) throw new HttpError(404, "Anak tidak ditemukan.");
      store.deleteChild(id);
      return send(res, 200, { ok: true });
    }
  }

  if (a === "children" && id && ID.test(id) && b === "sessions" && c && ID.test(c) && parts.length === 4 && M === "PUT") {
    const rev = revOf(req), doc = await readJSON(req);
    const err = checkSession(doc, c); if (err) throw new HttpError(422, err);
    const { rev: _r, ...clean } = doc;
    return send(res, 200, { rev: wrapStore(() => store.putSession(c, id, clean, rev, sessionGuard(user, clean))) });
  }

  if (a === "sessions" && id && ID.test(id)) {
    if (!b && M === "DELETE") {
      ortu();
      const { sess } = sessionFor(user, id);
      if (sess.status !== "draft") forbid("Hanya skrining yang belum dikirim yang dapat dibatalkan.");
      store.deleteSession(id);
      return send(res, 200, { ok: true });
    }
    if (b === "videos" && !c && M === "POST") return send(res, 201, await receiveVideo(req, user, id));
  }

  if (a === "videos" && id && ID.test(id) && !b) {
    if (M === "GET" || M === "HEAD") return streamVideo(req, res, user, id);
    if (M === "DELETE") {
      ortu();
      const v = store.getVideo(id);
      if (!v) throw new HttpError(404, "Video tidak ditemukan.");
      const { doc } = sessionFor(user, v.session_id), rr = doc.rerecord;
      const ok = doc.status === "draft" || (doc.status === "menunggu" && rr && !rr.resubmittedAt && v.created_at > rr.at);
      if (!ok) throw new HttpError(409, "Video yang sudah dikirim ke dokter tidak dapat dihapus.");
      store.deleteVideo(id);
      return send(res, 200, { ok: true });
    }
  }
  throw new HttpError(404, "Rute API tidak ditemukan.");
}

/* ---------- berkas statis: hanya index.html, js/, img/ ---------- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".css": "text/css; charset=utf-8", ".ico": "image/x-icon" };
function serveStatic(req, res, pathname) {
  if (pathname === "/") pathname = "/index.html";
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "");
  const ok = rel === "index.html" || rel.startsWith("js" + path.sep) || rel.startsWith("img" + path.sep);
  const file = path.join(ROOT, rel);
  if (!ok || !file.startsWith(ROOT + path.sep)) return send(res, 404, { error: "Tidak ditemukan." });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: "Tidak ditemukan." });
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname.startsWith("/api/")) {
      /* Tolak permintaan pengubah data dari situs lain (lapisan tambahan selain cookie SameSite=Lax). */
      const origin = req.headers.origin;
      if (!["GET", "HEAD"].includes(req.method) && origin && origin !== "null" && new URL(origin).host !== req.headers.host) throw new HttpError(403, "Asal permintaan tidak diizinkan.");
      return await api(req, res, url.pathname.slice(5).split("/").filter(Boolean));
    }
    if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Metode tidak didukung.");
    serveStatic(req, res, url.pathname);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    if (res.headersSent) return res.destroy();
    send(res, e instanceof HttpError ? e.code : 500, { error: e instanceof HttpError ? e.message : "Kesalahan server.", ...(e.extra || {}) });
  }
});
server.listen(PORT, HOST, () => {
  console.log(`CogniTrack berjalan di http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`Data: ${store.DATA_DIR}`);
});
