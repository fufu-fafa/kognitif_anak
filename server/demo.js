"use strict";
/* Data contoh (dummy) untuk akun orang tua: tiga anak dengan sesi terverifikasi, menunggu, dan rekam ulang yang lewat batas.
   Dibuat di server karena orang tua tidak boleh menulis hasil verifikasi dokter sendiri. Padanan loadDemo() lama di app.js. */
const crypto = require("node:crypto");
const store = require("./db");

const DAY = 864e5;
const pad = n => String(n).padStart(2, "0");
const isoOf = t => t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
const D = iso => new Date(iso + "T00:00:00");
function isoAgo(months, days) { const t = new Date(); t.setMonth(t.getMonth() - months); t.setDate(t.getDate() - days); return isoOf(t); }
/* Sama dengan ageParts() di app.js: sisa hari > 16 dibulatkan menjadi 1 bulan. */
function ageParts(dob, at) {
  const b = D(dob), n = D(at);
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const months = y * 12 + m;
  return { y, m, d, months, rounded: months + (d > 16 ? 1 : 0) };
}
const uid = p => p + Date.now().toString(36) + crypto.randomBytes(4).toString("hex");
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 4; i++) s += A[crypto.randomInt(A.length)];
  return "CT-" + s;
}

function seedDemo(owner, KPSP) {
  const ages = Object.keys(KPSP).map(Number).sort((a, b) => a - b);
  const formFor = r => ages.filter(f => f <= r).pop();
  const now = Date.now(), today = isoOf(new Date());
  const consent = { wali: "Orang tua contoh", rel: "Ibu", at: today, data: true, video: true, guru: true };
  const freeCode = () => { let c; do c = newCode(); while (store.codeTaken(c)); return c; };
  const mk = (name, dob) => ({ id: uid("c"), code: freeCode(), name, dob, prem: false, consent: { ...consent }, demo: true });
  const a = mk("Contoh Rara", isoAgo(26, 5)), b = mk("Contoh Bima", isoAgo(10, 20)), d = mk("Contoh Sinta", isoAgo(19, 5));

  const sa = { id: uid("s"), at: isoAgo(0, 3), form: 24, age: ageParts(a.dob, isoAgo(0, 3)), by: "ortu", step: "video", video: true,
    answers: [true, true, false, false, true, true, true, true, true, false], status: "terverifikasi", submittedAt: now - 3 * DAY,
    follow: { 4: "celana dan kaos", 5: 0, 6: 0, 7: 1 } };
  sa.verify = { final: [true, true, false, false, true, true, true, false, true, false], note: "Latih kosakata dan kemampuan menunjuk bagian tubuh setiap hari.", videoOk: true, doctor: "dr. Contoh, Sp.A", at: now - 2 * DAY };
  const f = formFor(ageParts(b.dob, today).rounded);
  const sb = { id: uid("s"), at: today, form: f, age: ageParts(b.dob, today), by: "guru", step: "video", video: true,
    answers: KPSP[f].map((_, i) => i !== 3), status: "menunggu", submittedAt: now - 36e5, verify: null,
    follow: { 4: 0, 5: "ma-ma", 6: 0, 7: 0 } };
  /* Sinta: rekam ulang diminta 9 hari lalu dan tidak dikirim sampai batas waktu. */
  const fd = formFor(ageParts(d.dob, today).rounded), ad = KPSP[fd].map((_, i) => i !== 8);
  const sd = { id: uid("s"), at: isoAgo(0, 10), form: fd, age: ageParts(d.dob, isoAgo(0, 10)), by: "ortu", step: "video", video: true,
    answers: ad, status: "menunggu", submittedAt: now - 10 * DAY, verify: null,
    follow: { 1: [{ w: "mamam", a: "makan" }, { w: "cucu", a: "susu" }, { w: "bola", a: "bola" }], 2: 3, 3: 0, 4: "menyapu dengan sapu kecil" },
    rerecord: { items: [7], note: "Rekam anak berjalan di sepanjang ruangan dengan seluruh tubuh terlihat.", doctor: "dr. Contoh, Sp.A", at: now - 9 * DAY, due: now - 2 * DAY, resubmittedAt: null, final: ad.slice() } };

  const any = () => {};
  store.tx(() => {
    [[a, sa], [b, sb], [d, sd]].forEach(([c, s]) => {
      store.putChild(c.id, c, null, owner);
      store.putSession(s.id, c.id, s, null, any);
    });
  });
  return a.id;
}

module.exports = { seedDemo };
