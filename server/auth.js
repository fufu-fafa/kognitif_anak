"use strict";
/* Akun dan sesi masuk: kata sandi di-hash dengan scrypt, token sesi acak disimpan sebagai hash SHA-256
   dan dikirim ke peramban sebagai cookie HttpOnly. */
const crypto = require("node:crypto");
const store = require("./db");

const COOKIE = "ct_sess";
const TTL = 30 * 864e5;
const MIN_PASS = 8;

const normLogin = s => String(s || "").trim().toLowerCase().replace(/\s+/g, "");
/* Login berupa email atau nomor HP (angka, boleh diawali +). */
const validLogin = s => /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(s) || /^\+?[0-9]{8,15}$/.test(s);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
function checkPassword(pw, stored) {
  const [alg, salt, key] = String(stored).split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const want = Buffer.from(key, "base64");
  const got = crypto.scryptSync(pw, Buffer.from(salt, "base64"), want.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(want, got);
}
/* Dipakai saat login tidak dikenal, supaya waktu respons tidak membocorkan apakah akun ada. */
const DUMMY = hashPassword(crypto.randomBytes(12).toString("hex"));

function passwordError(pw) {
  if (typeof pw !== "string" || pw.length < MIN_PASS) return `Kata sandi minimal ${MIN_PASS} karakter.`;
  if (pw.length > 200) return "Kata sandi terlalu panjang.";
  return "";
}

function createUser({ login, role, name, password }) {
  login = normLogin(login); name = String(name || "").trim();
  if (!validLogin(login)) throw new Error("Isi email atau nomor HP yang valid.");
  if (!name || name.length > 60) throw new Error("Isi nama (maks. 60 karakter).");
  const pe = passwordError(password); if (pe) throw new Error(pe);
  if (store.userByLogin(login)) throw new Error("Email atau nomor HP ini sudah terdaftar.");
  const id = "u" + crypto.randomBytes(9).toString("base64url");
  store.addUser(id, login, role, name, hashPassword(password));
  return { id, login, role, name };
}

const sha = t => crypto.createHash("sha256").update(t).digest("hex");
function startSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  store.addAuth(sha(token), userId, Date.now() + TTL);
  return token;
}
function cookieOf(req) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || "");
  return m ? m[1] : null;
}
function userOf(req) { const t = cookieOf(req); return t ? store.authUser(sha(t)) || null : null; }
function endSession(req) { const t = cookieOf(req); if (t) store.delAuth(sha(t)); }
function setCookie(req, token) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return token ? `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL / 1000}${secure}`
    : `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

/* Batasi percobaan masuk yang gagal: 10 kali per 15 menit per alamat IP dan per akun. */
const fails = new Map(), WINDOW = 15 * 60e3, MAX_FAIL = 10;
function limited(keys) {
  const now = Date.now();
  return keys.some(k => { const f = fails.get(k); return f && now - f.at < WINDOW && f.n >= MAX_FAIL; });
}
function noteFail(keys) {
  const now = Date.now();
  keys.forEach(k => { const f = fails.get(k); fails.set(k, f && now - f.at < WINDOW ? { n: f.n + 1, at: f.at } : { n: 1, at: now }); });
  if (fails.size > 10000) for (const [k, f] of fails) if (now - f.at >= WINDOW) fails.delete(k);
}
function login(req, loginName, password) {
  const ln = normLogin(loginName), keys = ["ip:" + req.socket.remoteAddress, "u:" + ln];
  if (limited(keys)) return { error: "Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.", code: 429 };
  const u = store.userByLogin(ln);
  const ok = checkPassword(String(password || ""), u ? u.pass : DUMMY) && !!u;
  if (!ok) { noteFail(keys); return { error: "Email/nomor HP atau kata sandi salah.", code: 401 }; }
  keys.forEach(k => fails.delete(k));
  return { user: { id: u.id, login: u.login, role: u.role, name: u.name }, token: startSession(u.id) };
}

module.exports = { normLogin, validLogin, hashPassword, passwordError, createUser, startSession, userOf, endSession, setCookie, login };
