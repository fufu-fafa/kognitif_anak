"use strict";
/* ---------- konstanta ---------- */
const KEY = "cognitrack:v2", OLD_KEY = "cognitrack:v1";
const DOMS = {
  GK: { k: "Gerak kasar", c: "var(--d0)" },
  GH: { k: "Gerak halus", c: "var(--d1)" },
  BB: { k: "Bicara dan bahasa", c: "var(--d2)" },
  SK: { k: "Sosialisasi dan kemandirian", c: "var(--d3)" }
};
const DOM_ORDER = ["GK", "GH", "BB", "SK"];
const ROLES = { ortu: "Orang tua", guru: "Guru PAUD", dokter: "Dokter" };
const TABS = {
  ortu: [["beranda", "Beranda"], ["skrining", "Skrining"], ["stimulasi", "Stimulasi"], ["riwayat", "Riwayat"]],
  guru: [["beranda", "Beranda"], ["skrining", "Skrining"], ["stimulasi", "Stimulasi"], ["riwayat", "Riwayat"]],
  dokter: [["antrean", "Dasbor"], ["selesai", "Sudah diverifikasi"], ["indikator", "Indikator"]]
};
const CATS = {
  S: { k: "Sesuai", cls: "ok" },
  M: { k: "Meragukan", cls: "warn" },
  P: { k: "Kemungkinan penyimpangan", cls: "bad" }
};
const FS = [0.9, 1, 1.15, 1.3];
const RULE_ANSWER = "Jawab Ya bila anak bisa, pernah, sering, atau kadang-kadang melakukannya. Jawab Tidak bila anak belum pernah atau tidak pernah melakukannya, atau Anda tidak tahu.";

/* Petunjuk pengamatan dan perekaman per domain (adaptasi CogniTrack, menunggu telaah ahli). */
const GUIDE = {
  GK: { amati: "Siapkan tempat yang lapang dan aman. Pancing anak melakukannya, misalnya dengan mainan, dan beri kesempatan sampai 3 kali.",
        rekam: "Rekam seluruh tubuh anak dari samping atau depan selama 10–30 detik, dengan cahaya yang cukup." },
  GH: { amati: "Dudukkan anak di depan meja atau alas datar. Boleh dicontohkan dulu, lalu biarkan anak mencoba sendiri.",
        rekam: "Rekam dari dekat supaya tangan anak dan bendanya terlihat jelas." },
  BB: { amati: "Pilih waktu anak tenang, tidak lapar, dan tidak mengantuk. Jangan membisikkan atau menuntun jawabannya.",
        rekam: "Rekam wajah anak di ruangan yang tenang supaya suaranya terdengar jelas." },
  SK: { amati: "Jawab berdasarkan kebiasaan anak sehari-hari, bukan kejadian sekali kebetulan.",
        rekam: "Rekam saat kegiatan itu terjadi dalam rutinitas, misalnya saat makan atau berpakaian." }
};

/* ---------- penyimpanan data ---------- */
function newCode() {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)];
  return "CT-" + s;
}
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/* Data lama yang dulu hanya tersimpan di peramban; diimpor sekali ke server bila server masih kosong. */
function loadLocal() {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {}
  try {
    const o = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
    if (o && o.children && o.children.length) {
      return { v: 2, role: "ortu", fs: 1, doctorName: "", active: o.active,
        children: o.children.map(c => ({ id: c.id, code: newCode(), name: c.name, dob: c.dob, prem: false, consent: null, legacy: true, sessions: [] })) };
    }
  } catch (e) {}
  return null;
}
/* Ukuran teks dan anak aktif adalah pilihan per perangkat; peran berasal dari akun, data anak ada di server. */
const PREF_KEY = "cognitrack:prefs";
function loadPrefs() {
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || "null"); if (p) return { fs: p.fs ?? 1, active: p.active || null }; } catch (e) {}
  const l = loadLocal() || {};
  return { fs: l.fs ?? 1, active: l.active || null };
}
const data = { v: 2, role: "ortu", ...loadPrefs(), children: [] };
let vids = {};
/* Akun yang sedang masuk ({ id, login, role, name }); null = tampilkan halaman masuk. */
let me = null, canRegister = true;
function savePrefs() {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ fs: data.fs, active: data.active })); } catch (e) {}
}

/* ---------- sinkronisasi dengan server ----------
   save() menandai perubahan; flush() mengirim hanya anak/sesi yang berubah dibanding salinan terakhir dari server.
   Setiap rekaman membawa rev; bila perangkat lain sudah mengubahnya (409), data dimuat ulang dari server. */
const net = { synced: new Map(), revs: new Map(), timer: null, busy: false, again: false, err: "", offline: false };
function records() {
  const m = new Map();
  data.children.forEach(c => {
    const { sessions, ...doc } = c;
    m.set("c:" + c.id, { body: JSON.stringify(doc), url: `/api/children/${enc(c.id)}` });
    sessions.forEach(s => m.set("s:" + s.id, { body: JSON.stringify(s), url: `/api/children/${enc(c.id)}/sessions/${enc(s.id)}`, parent: "c:" + c.id }));
  });
  return m;
}
const enc = encodeURIComponent;
const delUrl = k => (k[0] === "c" ? "/api/children/" : "/api/sessions/") + enc(k.slice(2));
const dirty = () => { const cur = records(); if (cur.size !== net.synced.size) return true; for (const [k, r] of cur) { const o = net.synced.get(k); if (!o || o.body !== r.body) return true; } return false; };

async function req(method, url, body, rev) {
  const h = {};
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (rev != null) h["If-Match"] = String(rev);
  let r;
  try { r = await fetch(url, { method, headers: h, body }); }
  catch (e) { const x = new Error("Server tidak dapat dihubungi."); x.offline = true; throw x; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && me && !url.startsWith("/api/auth/")) loggedOut("Sesi masuk berakhir. Silakan masuk lagi.");
  if (!r.ok) { const x = new Error(j.error || "Gagal menyimpan (" + r.status + ")."); x.status = r.status; x.body = j; throw x; }
  return j;
}
function adopt(st) {
  net.synced.clear(); net.revs.clear();
  data.children = st.children.map(c => {
    const { rev, sessions, ...doc } = c;
    net.revs.set("c:" + c.id, rev);
    return { ...doc, sessions: sessions.map(s => { const { rev: sr, ...sd } = s; net.revs.set("s:" + s.id, sr); return sd; }) };
  });
  vids = st.videos || {};
  records().forEach((r, k) => net.synced.set(k, r));
}
async function pull() { adopt(await req("GET", "/api/state")); }

function save() { savePrefs(); clearTimeout(net.timer); net.timer = setTimeout(flush, 300); }
async function flush() {
  clearTimeout(net.timer);
  if (!me) return;
  if (net.busy) { net.again = true; return; }
  net.busy = true;
  const before = net.err;
  try {
    const cur = records(), gone = [...net.synced.keys()].filter(k => !cur.has(k));
    /* Menghapus anak ikut menghapus sesi dan videonya di server. */
    for (const k of gone.filter(k => k[0] === "c")) { await req("DELETE", delUrl(k)).catch(e => { if (e.status !== 404) throw e; }); net.synced.delete(k); net.revs.delete(k); }
    for (const k of gone.filter(k => k[0] === "s")) {
      if (net.synced.get(k).parent && cur.has(net.synced.get(k).parent)) await req("DELETE", delUrl(k)).catch(e => { if (e.status !== 404) throw e; });
      net.synced.delete(k); net.revs.delete(k); delete vids[k.slice(2)];
    }
    for (const kind of ["c", "s"]) for (const [k, r] of cur) {
      if (k[0] !== kind) continue;
      const o = net.synced.get(k); if (o && o.body === r.body) continue;
      const j = await req("PUT", r.url, r.body, net.revs.get(k));
      net.revs.set(k, j.rev); net.synced.set(k, r);
    }
    net.err = ""; net.offline = false;
  } catch (e) {
    net.offline = !!e.offline;
    if (e.offline) { net.err = "Server tidak dapat dihubungi. Perubahan akan dikirim ulang otomatis."; net.timer = setTimeout(flush, 5000); }
    else {
      net.err = e.status === 409 ? "Data ini baru saja diubah di perangkat lain. Tampilan dimuat ulang; periksa lagi perubahan terakhir Anda." : "Perubahan tidak tersimpan: " + e.message;
      try { await pull(); } catch (x) {}
    }
  }
  net.busy = false;
  if (net.again) { net.again = false; return flush(); }
  if (net.err || before) render();
}
/* Ambil data terbaru saat kembali ke aplikasi, misalnya agar dokter melihat kiriman baru. */
async function refresh() {
  if (!me || net.busy || dirty() || upload) return;
  let st;
  try { st = await req("GET", "/api/state"); } catch (e) { return; }
  /* Jangan menimpa perubahan yang dibuat selama data diambil. */
  if (!me || net.busy || dirty() || upload) return;
  const was = JSON.stringify([data.children, vids]);
  adopt(st);
  if (JSON.stringify([data.children, vids]) !== was) render();
}
async function ensureSynced() { await flush(); if (net.err) throw new Error(net.err); }

const ui = { tab: null, adding: false, draft: null, err: "", confirm: null, editConsent: false,
  report: null, vd: null, vview: null, copied: false, showText: false };

/* ---------- helper ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const isoOf = t => t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate());
const todayISO = () => isoOf(new Date());
const D = iso => new Date(iso + "T00:00:00");
function fmtDate(iso) { try { return D(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } }
function fmtTime(ms) { return new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return m + " menit";
  if (m < 48 * 60) return Math.floor(m / 60) + " jam" + (m % 60 ? " " + (m % 60) + " menit" : "");
  return Math.round(m / 1440) + " hari";
}
const pct = (a, b) => b ? Math.round((a / b) * 100) + "%" : "–";
const dec = (x, n = 2) => x.toFixed(n).replace(".", ",");
function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }

/* Hitung umur menurut pedoman SDIDTK: sisa hari > 16 dibulatkan menjadi 1 bulan. */
function ageParts(dob, at) {
  const b = D(dob), n = D(at);
  let y = n.getFullYear() - b.getFullYear(), m = n.getMonth() - b.getMonth(), d = n.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(n.getFullYear(), n.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const months = y * 12 + m;
  return { y, m, d, months, rounded: months + (d > 16 ? 1 : 0) };
}
/* Bila umur tidak tepat pada kelompok umur KPSP, pakai formulir kelompok umur yang lebih muda. */
function formFor(rounded) {
  if (rounded < 3 || rounded > 72) return null;
  return FORM_AGES.filter(f => f <= rounded).pop();
}
function ageText(a) { return (a.y ? a.y + " tahun " : "") + a.m + " bulan " + a.d + " hari"; }
function stimGroup(form) { return STIMULASI.filter(g => g.min <= form).pop() || STIMULASI[0]; }

const yesCount = arr => arr.filter(x => x === true).length;
/* Ambang pedoman: Ya 9–10 sesuai, 7–8 meragukan, 6 atau kurang kemungkinan penyimpangan. */
const category = yes => yes >= 9 ? "S" : yes >= 7 ? "M" : "P";
const nobsOf = s => (s.verify && s.verify.notObserved) || [];
const corrections = s => s.verify ? s.verify.final.filter((v, i) => v !== s.answers[i]).length : 0;

function visibleKids() {
  return data.children.filter(c => data.role === "ortu" || (c.consent && c.consent.guru));
}
function child() {
  const kids = visibleKids();
  return kids.find(c => c.id === data.active) || kids[0] || null;
}
const draftOf = c => c.sessions.find(s => s.status === "draft");
const pendingOf = c => c.sessions.find(s => s.status === "menunggu");
const lastVerified = c => [...c.sessions].reverse().find(s => s.status === "terverifikasi");
function allSessions() {
  const out = [];
  data.children.forEach(c => c.sessions.forEach(s => out.push({ c, s })));
  return out;
}
function findSession(sid) { for (const x of allSessions()) if (x.s.id === sid) return x; return null; }

function advice(s) {
  const cat = category(yesCount(s.verify.final));
  const next = FORM_AGES.find(f => f > s.form);
  if (cat === "S") return [
    "Perkembangan anak sesuai dengan umurnya.",
    "Beri pujian kepada anak dan lanjutkan stimulasi sesuai umur setiap hari.",
    next ? `Lakukan skrining lagi saat anak berumur ${next} bulan.` : "Formulir KPSP berakhir pada umur 72 bulan.",
    "Tetap ikuti pemantauan rutin di Posyandu atau Puskesmas."
  ];
  if (cat === "M") return [
    "Ada beberapa kemampuan yang belum terlihat. Ini belum tentu berarti ada gangguan.",
    "Lakukan stimulasi lebih sering, terutama pada bidang yang tampil paling atas di menu Stimulasi.",
    "Ulangi skrining 2 minggu lagi dengan formulir yang sama.",
    "Bila hasilnya tetap meragukan, periksakan anak ke dokter atau Puskesmas."
  ];
  return [
    "Hasil skrining menunjukkan kemungkinan keterlambatan pada beberapa kemampuan.",
    "Segera periksakan anak ke dokter, Puskesmas, atau klinik tumbuh kembang untuk pemeriksaan langsung.",
    "Bawa laporan ringkas dari menu Riwayat saat berkonsultasi.",
    "Sambil menunggu, tetap lakukan stimulasi dari menu Stimulasi setiap hari."
  ];
}
const NOT_DIAGNOSIS = "Hasil ini adalah skrining, bukan diagnosis. Hasil “sesuai” tidak menggantikan pemantauan rutin di fasilitas kesehatan, dan hasil “meragukan” atau “kemungkinan penyimpangan” perlu ditindaklanjuti dengan pemeriksaan langsung oleh tenaga kesehatan.";
const draftBanner = () => KPSP_DRAFT ? `<div class="note warn small"><b>Prototype.</b> Teks butir KPSP di aplikasi ini masih draf dan harus diganti dengan teks resmi Buku Bagan SDIDTK (Kemenkes RI, 2022) sebelum uji ahli.</div>` : "";

/* ---------- tampilan umum ---------- */
function header() {
  const r = data.role, kids = visibleKids(), c = child();
  const kidSel = r !== "dokter" && kids.length > 1
    ? `<select class="sel" data-act="switch" aria-label="Pilih anak">${kids.map(x => `<option value="${x.id}" ${c && x.id === c.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : "";
  const add = r === "ortu" && kids.length && !ui.adding ? `<button class="btn sm" data-act="showadd">Tambah anak</button>` : "";
  return `<header class="top noprint">
    <div class="brand">
      <svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="var(--d0)" stroke-width="3"/><circle cx="17" cy="17" r="9.5" fill="none" stroke="var(--d1)" stroke-width="3" stroke-dasharray="40 100" stroke-linecap="round"/><circle cx="17" cy="17" r="4" fill="var(--d2)"/></svg>
      <b>CogniTrack</b>
    </div>
    ${kidSel}${add}
    <div class="fs" role="group" aria-label="Ukuran teks"><button class="btn sm" data-act="fs" data-d="-1" aria-label="Perkecil teks">A−</button><button class="btn sm" data-act="fs" data-d="1" aria-label="Perbesar teks">A+</button></div>
    <span class="who small"><b>${esc(me.name)}</b><span class="muted">${ROLES[me.role]}</span></span>
    <button class="btn sm" data-act="logout">Keluar</button>
  </header>`;
}
function tabs() {
  return `<nav class="tabs noprint" aria-label="Menu utama">${TABS[data.role].map(t => `<button data-act="tab" data-t="${t[0]}" ${ui.tab === t[0] ? 'aria-current="page"' : ""}>${t[1]}</button>`).join("")}</nav>`;
}
function domTag(d) { return `<span class="tag" style="--c:${DOMS[d].c}"><i></i>${DOMS[d].k}</span>`; }

/* ---------- profil dan persetujuan ---------- */
function blankDraft() { return { name: "", dob: "", prem: false, wali: "", rel: "Ibu", cData: false, cVideo: false, cGuru: false }; }
function consentFields(d) {
  const rels = ["Ibu", "Ayah", "Wali"];
  return `<h2 class="h3">Persetujuan orang tua atau wali</h2>
    <div class="note info small"><ul class="list">
      <li>Data yang dikumpulkan hanya nama panggilan, tanggal lahir, jawaban skrining, dan video bila Anda setujui.</li>
      <li>Dokter hanya melihat kode anak, bukan namanya. Aplikasi tidak memuat iklan.</li>
      <li>Video hanya dapat dibuka dokter pemverifikasi dan dihapus setelah periode penelitian berakhir. Video disimpan di server CogniTrack, bukan di galeri perangkat.</li>
      <li>Anda dapat mengubah persetujuan atau menghapus semua data anak kapan saja.</li>
    </ul></div>
    <div class="field"><label for="wali">Nama orang tua atau wali</label><input id="wali" type="text" maxlength="60" value="${esc(d.wali)}" data-in="wali" autocomplete="off"></div>
    <div class="field"><label for="rel">Hubungan dengan anak</label><select id="rel" class="f" data-in="rel">${rels.map(x => `<option ${x === d.rel ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    <label class="chk"><input type="checkbox" data-in="cData" ${d.cData ? "checked" : ""}><span><b>Wajib.</b> Saya orang tua atau wali anak ini dan menyetujui data anak disimpan dan diolah untuk skrining perkembangan.</span></label>
    <label class="chk"><input type="checkbox" data-in="cVideo" ${d.cVideo ? "checked" : ""}><span><b>Opsional.</b> Saya menyetujui perekaman video anak dan peninjauan video oleh dokter pemverifikasi. Tanpa video, dokter menelaah dari jawaban Anda.</span></label>
    <label class="chk"><input type="checkbox" data-in="cGuru" ${d.cGuru ? "checked" : ""}><span><b>Opsional.</b> Saya mengizinkan guru PAUD anak saya mengisi checklist KPSP untuk anak ini.</span></label>`;
}
function consentErr(d) {
  if (!d.wali.trim()) return "Isi nama orang tua atau wali.";
  if (!d.cData) return "Persetujuan pengolahan data wajib dicentang untuk memakai CogniTrack.";
  return "";
}
function consentOf(d) { return { wali: d.wali.trim(), rel: d.rel, at: todayISO(), data: true, video: d.cVideo, guru: d.cGuru }; }

function viewAdd() {
  const first = data.children.length === 0, d = ui.draft;
  return `<section class="card narrow">
    <h1 class="title">${first ? "Selamat datang di CogniTrack" : "Tambah anak"}</h1>
    <p class="muted" style="margin-bottom:14px">Skrining perkembangan anak umur 3–72 bulan dengan KPSP sesuai pedoman SDIDTK, diverifikasi dokter, lalu stimulasi yang disesuaikan dengan hasilnya. Satu akun dapat menyimpan lebih dari satu anak.</p>
    ${ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : ""}
    <h2 class="h3">Data anak</h2>
    <div class="field"><label for="nm">Nama panggilan</label><input id="nm" type="text" maxlength="40" value="${esc(d.name)}" data-in="name" autocomplete="off"><p class="small muted">Hanya tampil di perangkat Anda. Dokter melihat kode anak.</p></div>
    <div class="field"><label for="dob">Tanggal lahir</label><input id="dob" type="date" max="${todayISO()}" value="${esc(d.dob)}" data-in="dob"></div>
    <label class="chk"><input type="checkbox" data-in="prem" ${d.prem ? "checked" : ""}><span>Anak lahir prematur (sebelum 37 minggu)</span></label>
    ${consentFields(d)}
    <div class="row">
      <button class="btn pri" data-act="addchild">Simpan profil</button>
      ${first ? "" : `<button class="btn" data-act="canceladd">Batal</button>`}
    </div>
    ${first ? `<p class="small muted" style="margin-top:16px">Ingin melihat alurnya dulu? <button class="linkbtn" data-act="demo">Isi data contoh (dummy)</button></p>` : ""}
  </section>`;
}
function viewConsent(c) {
  const d = ui.draft;
  return `<section class="card narrow">
    <h1 class="title">${c.consent ? "Ubah persetujuan" : "Lengkapi persetujuan"}</h1>
    <p class="muted" style="margin-bottom:14px">${c.legacy && !c.consent ? `Profil ${esc(c.name)} berasal dari versi sebelumnya. CogniTrack kini memakai KPSP, jadi checklist lama tidak dipakai lagi. ` : ""}Persetujuan diperlukan sebelum skrining.</p>
    ${ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : ""}
    ${consentFields(d)}
    <div class="row"><button class="btn pri" data-act="saveconsent">Simpan persetujuan</button>${c.consent ? `<button class="btn" data-act="cancelconsent">Batal</button>` : ""}</div>
  </section>`;
}

/* ---------- beranda ---------- */
function ageCard(c) {
  const a = ageParts(c.dob, todayISO()), f = formFor(a.rounded);
  let form;
  if (a.rounded < 3) form = "Belum ada. KPSP dimulai pada umur 3 bulan.";
  else if (a.rounded > 72) form = "Di luar cakupan. CogniTrack Tahap 1 untuk umur 3–72 bulan.";
  else form = `KPSP ${f} bulan${f !== a.rounded ? " (umur tidak tepat pada kelompok formulir, jadi dipakai formulir kelompok umur yang lebih muda)" : ""}`;
  return `<div class="card"><h2 class="h2">Hitung umur otomatis</h2>
    <dl class="kv">
      <dt>Umur hari ini</dt><dd>${ageText(a)}</dd>
      <dt>Umur dalam bulan</dt><dd><b>${a.rounded} bulan</b> ${a.d > 16 ? `(sisa ${a.d} hari dibulatkan ke atas)` : a.d ? `(sisa ${a.d} hari tidak dibulatkan)` : ""}</dd>
      <dt>Formulir</dt><dd>${form}</dd>
    </dl>
    <p class="small muted" style="margin-top:10px">Aturan pedoman SDIDTK: sisa umur lebih dari 16 hari dibulatkan menjadi 1 bulan. Bila umur tidak sama dengan kelompok umur KPSP, dipakai formulir kelompok umur yang lebih muda.</p>
  </div>`;
}
function premNote(c) {
  return c.prem ? `<div class="note warn small">Koreksi umur untuk anak prematur belum didukung prototype ini. Umur di aplikasi dihitung dari tanggal lahir. Konsultasikan dengan tenaga kesehatan mengenai umur yang sebaiknya dipakai.</div>` : "";
}
function resultBlock(s, withBtns) {
  const y = yesCount(s.verify.final), cat = CATS[category(y)], corr = corrections(s);
  return `<section class="card result ${cat.cls}">
    <p class="small muted">KPSP ${s.form} bulan · diisi ${fmtDate(s.at)} · diverifikasi ${fmtTime(s.verify.at)}</p>
    <h2 class="cat">${cat.k}</h2>
    <p>${y} dari ${s.verify.final.length} jawaban “Ya” setelah verifikasi dokter.${corr ? ` Dokter mengoreksi ${corr} jawaban.` : ""}${nobsOf(s).length ? ` ${nobsOf(s).length} butir tetap tidak teramati setelah rekam ulang sehingga dinilai “Tidak”.` : ""}</p>
    <ul class="list" style="margin-top:10px">${advice(s).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    ${s.verify.note ? `<p class="small" style="margin-top:10px"><b>Catatan dokter:</b> ${esc(s.verify.note)}</p>` : ""}
    <p class="note info small" style="margin-top:12px">${NOT_DIAGNOSIS}</p>
    ${withBtns ? `<div class="row"><button class="btn pri sm" data-act="tab" data-t="stimulasi">Lihat stimulasi</button><button class="btn sm" data-act="report" data-s="${s.id}">Laporan ringkas</button></div>` : ""}
  </section>`;
}
/* ---------- rekam ulang: status proses, bukan jawaban ---------- */
const DAY = 864e5, RR_DAYS = 7;
const rrWaiting = s => !!(s.rerecord && !s.rerecord.resubmittedAt && Date.now() < s.rerecord.due);
const rrOverdue = s => !!(s.rerecord && !s.rerecord.resubmittedAt && Date.now() >= s.rerecord.due);
/* ---------- unggah video ---------- */
let upload = null;
function uploader(s, canDelete) {
  const list = vidsOf(s), up = upload && upload.sid === s.id ? upload : null;
  return `<label class="btn ${list.length ? "" : "pri"}${up ? " disabled" : ""}">${list.length ? "Tambah video" : "Rekam atau pilih video"}<input type="file" accept="video/*" multiple data-upload="${s.id}" ${up ? "disabled" : ""}></label>
    ${up ? `<p class="small" role="status">Mengunggah video ${up.idx + 1} dari ${up.total} · ${up.pct}%</p>` : ""}
    ${uploadErr && uploadErr.sid === s.id ? `<p class="err" role="alert">${esc(uploadErr.msg)}</p>` : ""}
    ${list.length ? `<ul class="vlist">${list.map(v => `<li><span class="vn">${esc(v.name)} <span class="small muted">· ${fmtSize(v.size)}</span></span>${canDelete || (s.rerecord && v.at > s.rerecord.at && !s.rerecord.resubmittedAt) ? `<button class="btn sm danger" data-act="vdel" data-s="${s.id}" data-v="${v.id}">Hapus</button>` : `<span class="small muted">terkirim</span>`}</li>`).join("")}</ul>` : ""}`;
}
let uploadErr = null;
function putVideo(sid, f, onProgress) {
  return new Promise((ok, fail) => {
    const x = new XMLHttpRequest();
    x.open("POST", `/api/sessions/${enc(sid)}/videos`);
    x.setRequestHeader("Content-Type", f.type || "video/mp4");
    x.setRequestHeader("X-Filename", enc(f.name));
    x.upload.onprogress = e => e.lengthComputable && onProgress(Math.round(e.loaded / e.total * 100));
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} x.status < 300 ? ok(j) : fail(new Error(j.error || "Unggahan gagal (" + x.status + ").")); };
    x.onerror = () => fail(new Error("Server tidak dapat dihubungi."));
    x.send(f);
  });
}
async function uploadVideos(sid, files) {
  if (!files.length || upload) return;
  uploadErr = null;
  try { await ensureSynced(); } catch (e) { uploadErr = { sid, msg: e.message }; return render(); }
  upload = { sid, total: files.length, idx: 0, pct: 0 }; render();
  for (const f of files) {
    try {
      const v = await putVideo(sid, f, p => { upload.pct = p; const st = app.querySelector("[role=status]"); if (st) st.textContent = `Mengunggah video ${upload.idx + 1} dari ${upload.total} · ${p}%`; });
      (vids[sid] = vids[sid] || []).push(v);
    } catch (e) { uploadErr = { sid, msg: `${f.name}: ${e.message}` }; break; }
    upload.idx++; upload.pct = 0;
  }
  upload = null; render();
}
function rerecordBlock(s) {
  const rr = s.rerecord; if (!rr) return "";
  if (rr.resubmittedAt) return `<p class="note ok small">Video rekam ulang terkirim ${fmtTime(rr.resubmittedAt)}. Dokter akan menetapkan hasil akhir.</p>`;
  if (rrOverdue(s)) return `<p class="note warn small"><b>Batas rekam ulang (${fmtTime(rr.due)}) sudah lewat.</b> Dokter akan menetapkan hasil akhir. Butir yang tetap tidak teramati dinilai “Tidak”. Bila hasilnya “Meragukan”, anak diperiksa ulang 2 minggu lagi sesuai Buku Bagan SDIDTK.</p>`;
  const items = KPSP[s.form];
  return `<div class="rr">
    <h3 class="h3" style="margin-top:2px">Dokter meminta rekam ulang</h3>
    <p class="small">Butir berikut belum teramati jelas di video. Rekam ulang sebelum <b>${fmtTime(rr.due)}</b>. Permintaan ini hanya diberikan sekali.</p>
    <ol class="list plain small">${rr.items.map(i => `<li><b>${i + 1}.</b> ${esc(itemShort(items[i]))}</li>`).join("")}</ol>
    ${rr.note ? `<p class="small"><b>Catatan dokter:</b> ${esc(rr.note)}</p>` : ""}
    ${uploader(s, false)}
    <div class="row"><button class="btn pri sm" data-act="resubmit" data-s="${s.id}" ${vidsOf(s).some(v => v.at > rr.at) && !(upload && upload.sid === s.id) ? "" : "disabled"}>Kirim ulang video ke dokter</button></div>
  </div>`;
}
function pendingBlock(s) {
  return `<section class="card result wait">
    <p class="small muted">KPSP ${s.form} bulan · dikirim ${fmtTime(s.submittedAt)}</p>
    <h2 class="cat">Menunggu verifikasi</h2>
    <p>Dokter sedang meninjau ${hasVideo(s) ? "video dan " : ""}jawaban checklist. Kategori hasil akan tampil setelah dokter menetapkan jawaban akhir.</p>
    ${rerecordBlock(s)}
    <div class="row"><button class="btn sm" data-act="tab" data-t="stimulasi">Lihat stimulasi umum sesuai umur</button></div>
  </section>`;
}
function viewBeranda(c) {
  const a = ageParts(c.dob, todayISO()), dr = draftOf(c), pe = pendingOf(c), lv = lastVerified(c), isOrtu = data.role === "ortu";
  let status;
  if (dr) status = `<div class="note info"><b>Skrining KPSP ${dr.form} bulan belum selesai</b> (${yesCount(dr.answers.map(x => x !== null))}/${dr.answers.length} butir dijawab). <button class="btn sm" style="margin-left:6px" data-act="tab" data-t="skrining">Lanjutkan</button></div>`;
  else if (!pe && !lv) status = `<div class="note info"><b>Belum ada skrining.</b> <button class="btn sm pri" style="margin-left:6px" data-act="tab" data-t="skrining">Mulai skrining</button></div>`;
  else status = "";
  const cs = c.consent;
  return `<div class="stack">
    <div><h1 class="title">${esc(c.name)}</h1><p class="muted">Kode ${esc(c.code)} · ${ageText(a)} (${a.rounded} bulan) · lahir ${fmtDate(c.dob)}</p></div>
    ${premNote(c)}
    ${status}
    ${pe ? pendingBlock(pe) : ""}
    ${lv ? (pe ? `<h2 class="h2" style="margin:6px 0 -6px">Hasil terverifikasi sebelumnya</h2>` : "") + resultBlock(lv, true) : ""}
    ${isOrtu ? `<section class="card"><h2 class="h2">Profil dan persetujuan</h2>
      <dl class="kv">
        <dt>Orang tua/wali</dt><dd>${esc(cs.wali)} (${esc(cs.rel)}) · disetujui ${fmtDate(cs.at)}</dd>
        <dt>Perekaman video</dt><dd>${cs.video ? "Disetujui" : "Tidak disetujui"}</dd>
        <dt>Pengisian oleh guru</dt><dd>${cs.guru ? "Diizinkan" : "Tidak diizinkan"}</dd>
      </dl>
      <div class="row">
        <button class="btn sm" data-act="editconsent">Ubah persetujuan</button>
        ${ui.confirm === "delchild"
          ? `<span class="small">Hapus semua data dan video ${esc(c.name)}?</span><button class="btn sm danger" data-act="delyes">Ya, hapus</button><button class="btn sm" data-act="nope">Batal</button>`
          : `<button class="btn sm danger" data-act="delask">Hapus data anak</button>`}
      </div></section>` : ""}
    <p class="foot">CogniTrack adalah alat skrining dan edukasi, bukan alat diagnosis, dan tidak menggantikan Buku KIA maupun pemantauan di Posyandu atau Puskesmas.</p>
  </div>`;
}

/* ---------- skrining ---------- */
function itemGuide(it) {
  const g = GUIDE[it[0]], noRec = it[3].includes("n");
  return `<details class="guide"><summary>Petunjuk pengamatan</summary><dl class="kv small">
    <dt>Alat dan bahan</dt><dd>${it[4] ? esc(it[4]) : "Tidak perlu alat khusus."}</dd>
    <dt>Cara mengamati</dt><dd>${esc(g.amati)}</dd>
    <dt>Cara merekam</dt><dd>${noRec ? "Tidak perlu direkam. Dokter menelaah berdasarkan jawaban Anda dan dapat mengonfirmasinya saat kunjungan." : esc(g.rekam)}</dd>
  </dl></details>`;
}
function itemHead(it, i) {
  return `<div class="item-h"><span class="num">${i + 1}</span>${domTag(it[0])}${it[3].includes("k") ? `<span class="tag ghost">terkait kognitif</span>` : ""}${it[3].includes("n") ? `<span class="tag ghost">ditanyakan, tidak direkam</span>` : ""}</div>`;
}
/* Ringkasan butir untuk daftar (judul butir bila ada + kalimat pertanyaan). Teks lengkap tetap tampil di checklist. */
function itemShort(it) {
  const t = it[1], lines = t.split("\n"), flat = t.replace(/\n/g, " ");
  const head = lines.length > 1 && !/[?:.]$/.test(lines[0]) && lines[0].length < 70 ? lines[0] : "";
  const qs = t.match(/[^.?!\n]*\?/g);
  let q = qs ? qs[qs.length - 1].replace(/^[\s”"’]+/, "").trim() : lines[0];
  if (qs && !head && q.length < 40) {
    const before = (flat.slice(0, flat.lastIndexOf(q)).match(/[^.?!]+[.?!]\s*$/) || [""])[0].trim();
    if (before) q = before + " " + q;
  }
  return head ? head + ": " + q : q;
}
function itemFig(it) {
  return it[5] ? `<figure class="kfig"><img src="img/kpsp/${it[5]}.png" alt="Gambar butir dari ${esc(KPSP_SOURCE)}" loading="lazy">${it[6] ? `<figcaption class="small muted">${esc(it[6])}</figcaption>` : ""}</figure>` : "";
}
/* ---------- pertanyaan lanjutan (butir yang ditanyakan kepada orang tua) ---------- */
function followSpec(it) {
  if (!it[3].includes("n")) return null;
  const r = FOLLOWUP_RULES.find(r => r[0].test(it[1]));
  return r ? r[1] : FOLLOWUP_DEFAULT;
}
function followDone(sp, v) {
  if (sp.t === "choice") return Number.isInteger(v);
  if (sp.t === "words") return Array.isArray(v) && v.length >= sp.n && v.slice(0, sp.n).every(r => r && r.w.trim() && r.a.trim());
  return typeof v === "string" && v.trim().length >= 2;
}
const followConflict = (sp, v) => sp.t === "choice" && Number.isInteger(v) && sp.bad.includes(v);
const followOf = (s, i) => (s.follow || {})[i];
/* Butir berjawaban "Ya" yang pertanyaan lanjutannya belum lengkap. */
function followMissing(s) {
  return KPSP[s.form].map((it, i) => i).filter(i => { const sp = followSpec(KPSP[s.form][i]); return sp && s.answers[i] === true && !followDone(sp, followOf(s, i)); });
}
function followText(sp, v) {
  if (sp.t === "choice") return sp.opts[v];
  if (sp.t === "words") return v.slice(0, sp.n).map(r => `“${r.w.trim()}” (${r.a.trim()})`).join(", ");
  return v.trim();
}
function followForm(s, i) {
  const sp = followSpec(KPSP[s.form][i]);
  if (!sp || s.answers[i] !== true) return "";
  const v = followOf(s, i);
  let body;
  if (sp.t === "words") body = Array.from({ length: sp.n }, (_, r) => {
    const x = (v && v[r]) || { w: "", a: "" };
    return `<div class="wrow"><span class="small muted">${r + 1}.</span><input type="text" maxlength="40" placeholder="Kata yang diucapkan" aria-label="Kata ${r + 1}" value="${esc(x.w)}" data-fw="${i}:${r}:w"><input type="text" maxlength="60" placeholder="Artinya" aria-label="Arti kata ${r + 1}" value="${esc(x.a)}" data-fw="${i}:${r}:a"></div>`;
  }).join("");
  else if (sp.t === "text") body = `<textarea rows="2" maxlength="300" placeholder="${esc(sp.ph || "")}" aria-label="${esc(sp.q)}" data-ft="${i}">${esc(v || "")}</textarea>`;
  else body = `<div class="opts" role="radiogroup" aria-label="${esc(sp.q)}">${sp.opts.map((o, k) => `<button class="chipopt" role="radio" aria-checked="${v === k}" data-act="fchoice" data-i="${i}" data-o="${k}">${esc(o)}</button>`).join("")}</div>`;
  return `<div class="follow"><p class="small"><b>Pertanyaan lanjutan.</b> ${esc(sp.q)}</p>${body}
    <p class="small muted">Dokter menilai isi jawaban ini, bukan hanya kata “Ya”.</p></div>`;
}
/* Tanda "tidak konsisten" hanya untuk dokter, agar orang tua dan guru tidak terdorong mengubah jawaban. */
function followView(s, i) {
  const sp = followSpec(KPSP[s.form][i]);
  if (!sp || s.answers[i] !== true) return "";
  const v = followOf(s, i);
  return `<div class="follow ro"><p class="small muted">Lanjutan: ${esc(sp.q)}</p><p>${followDone(sp, v) ? esc(followText(sp, v)) : `<span class="muted">Tidak diisi</span>`}${data.role === "dokter" && followConflict(sp, v) ? ` <span class="pill warn">tidak konsisten dengan “Ya”</span>` : ""}</p></div>`;
}
const canNext = dr => dr.answers.every(x => x !== null) && !followMissing(dr).length;
function nextHint(dr) {
  const left = dr.answers.filter(x => x === null).length, miss = followMissing(dr).length;
  if (left) return `Jawab semua ${dr.answers.length} butir untuk melanjutkan.`;
  if (miss) return `Lengkapi pertanyaan lanjutan pada butir ${followMissing(dr).map(i => i + 1).join(", ")}.`;
  return "";
}
function refreshNext(dr) {
  const b = app.querySelector('[data-act="tovideo"]'), h = app.querySelector("#nexthint");
  if (b) b.disabled = !canNext(dr);
  if (h) h.textContent = nextHint(dr);
}

function viewSkrining(c) {
  const pe = pendingOf(c), dr = draftOf(c);
  if (pe) return `<div class="stack"><h1 class="title">Skrining</h1>${pendingBlock(pe)}<p class="muted">Skrining baru dapat dimulai setelah skrining ini diverifikasi.</p></div>`;
  if (!dr) {
    const a = ageParts(c.dob, todayISO()), f = formFor(a.rounded);
    return `<div class="stack">
      <div><h1 class="title">Skrining KPSP</h1><p class="muted">Kuesioner Pra Skrining Perkembangan untuk ${esc(c.name)}, empat bidang: gerak kasar, gerak halus, bicara dan bahasa, serta sosialisasi dan kemandirian.</p></div>
      ${premNote(c)}
      ${ageCard(c)}
      ${f ? `<div class="row"><button class="btn pri" data-act="start">Mulai skrining KPSP ${f} bulan</button></div>
        <p class="small muted">Siapkan sekitar 15 menit saat anak sehat dan tidak mengantuk. Setelah checklist selesai, ${c.consent.video ? "Anda akan melihat panduan merekam video untuk ditinjau dokter" : "jawaban dikirim ke dokter untuk ditinjau"}.</p>` : ""}
    </div>`;
  }
  const items = KPSP[dr.form];
  if (dr.step === "video") return viewVideo(c, dr, items);
  const answered = dr.answers.filter(x => x !== null).length, ok = canNext(dr);
  const list = items.map((it, i) => `<article class="card item">
      ${itemHead(it, i)}
      <p class="q">${esc(it[1])}</p>
      ${itemFig(it)}
      ${itemGuide(it)}
      <div class="seg" role="group" aria-label="Jawaban butir ${i + 1}">
        <button data-act="ans" data-i="${i}" data-v="y" aria-pressed="${dr.answers[i] === true}">Ya</button><button data-act="ans" data-i="${i}" data-v="n" aria-pressed="${dr.answers[i] === false}">Tidak</button>
      </div>
      ${followForm(dr, i)}
    </article>`).join("");
  return `<div class="stack">
    <div><h1 class="title">KPSP ${dr.form} bulan</h1>
    <p class="muted">${esc(c.name)} · umur ${ageText(dr.age)} (${dr.age.rounded} bulan) · diisi oleh ${ROLES[dr.by]} · ${answered}/${items.length} dijawab</p></div>
    ${draftBanner()}
    <div class="note info small">${RULE_ANSWER} Buka “Petunjuk pengamatan” pada setiap butir untuk alat, cara mengamati, dan cara merekam.${KPSP_DRAFT ? "" : `<br><span class="muted">Teks butir dan gambar sesuai ${esc(KPSP_SOURCE)}.</span>`}</div>
    ${list}
    <div class="row">
      <button class="btn pri" data-act="tovideo" ${ok ? "" : "disabled"}>${c.consent.video ? "Lanjut ke unggah video" : "Lanjut ke pengiriman"}</button>
      ${ui.confirm === "canceldraft"
        ? `<span class="small">Buang jawaban skrining ini?</span><button class="btn sm danger" data-act="canceldraftyes">Ya, batalkan</button><button class="btn sm" data-act="nope">Tidak</button>`
        : `<button class="btn" data-act="canceldraft">Batalkan skrining</button>`}
    </div>
    <p class="small muted" id="nexthint">${nextHint(dr)}</p>
  </div>`;
}
function viewVideo(c, dr, items) {
  const rec = items.map((it, i) => ({ it, i })).filter(x => !x.it[3].includes("n"));
  const habit = items.map((it, i) => ({ it, i })).filter(x => x.it[3].includes("n"));
  const li = x => `<li><b>${x.i + 1}.</b> ${esc(itemShort(x.it))}</li>`;
  const body = c.consent.video ? `
    <p class="muted">Rekam ${esc(c.name)} saat melakukan tugas pada butir yang dapat diperagakan. Video hanya dapat dibuka oleh dokter pemverifikasi.</p>
    <div class="card"><h2 class="h2">Butir yang sebaiknya direkam</h2><ol class="list plain">${rec.map(li).join("")}</ol>
      ${habit.length ? `<h3 class="h3">Tidak perlu direkam</h3><p class="small muted" style="margin-bottom:6px">Butir ini ditanyakan kepada orang tua atau pengasuh, jadi ditelaah dokter dari jawaban Anda dan dapat dikonfirmasi saat kunjungan.</p><ol class="list plain">${habit.map(li).join("")}</ol>` : ""}</div>
    <div class="note info small"><ul class="list">
      <li>Video pendek 10–60 detik per tugas. Satu video boleh berisi beberapa tugas.</li>
      <li>Sebutkan nomor butir di awal rekaman, misalnya “butir 3”.</li>
      <li>Pastikan cahaya cukup, anak terlihat jelas, dan hindari merekam orang lain yang tidak perlu.</li>
    </ul></div>
    <div class="card dropzone">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 10.5 21 7.5v9l-5.5-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      <h2 class="h2">Unggah video</h2>
      ${uploader(dr, true)}
    </div>`
    : `<div class="note info">Anda tidak menyetujui perekaman video. Dokter akan menelaah berdasarkan jawaban checklist, dan dapat mengonfirmasi saat kunjungan. Persetujuan dapat diubah di Beranda.</div>`;
  return `<div class="stack">
    <div><h1 class="title">${c.consent.video ? "Unggah video" : "Kirim untuk verifikasi"}</h1><p class="muted small">KPSP ${dr.form} bulan · checklist selesai diisi</p></div>
    ${body}
    <div class="row">
      <button class="btn" data-act="toisi">Kembali ke checklist</button>
      <button class="btn pri" data-act="submit" ${upload && upload.sid === dr.id ? "disabled" : ""}>Kirim ke dokter untuk verifikasi${c.consent.video && !realVid(dr) ? " tanpa video" : ""}</button>
    </div>
  </div>`;
}

/* ---------- stimulasi ---------- */
function stimPlan(c) {
  const subm = c.sessions.filter(s => s.status !== "draft"), last = subm[subm.length - 1];
  if (last && last.status === "terverifikasi") {
    const items = KPSP[last.form], counts = {}, linked = {};
    DOM_ORDER.forEach(d => { counts[d] = 0; linked[d] = {}; });
    items.forEach((it, i) => {
      if (last.verify.final[i] === false) { counts[it[0]]++; (linked[it[0]][it[2]] = linked[it[0]][it[2]] || []).push(i); }
    });
    /* Domain dengan butir "Tidak" terbanyak lebih dahulu; bila sama, ikuti urutan pedoman. */
    const order = DOM_ORDER.slice().sort((a, b) => counts[b] - counts[a] || DOM_ORDER.indexOf(a) - DOM_ORDER.indexOf(b));
    const g = stimGroup(last.form);
    const secs = order.map(d => {
      const acts = g[d].map((a, ai) => ({ a, ai, items: linked[d][ai] || [] }));
      /* Di dalam domain: aktivitas yang terkait langsung dengan butir "Tidak" lebih dahulu. */
      acts.sort((x, y) => (y.items.length ? 1 : 0) - (x.items.length ? 1 : 0) || (x.items[0] ?? 99) - (y.items[0] ?? 99) || x.ai - y.ai);
      return { d, n: counts[d], acts };
    });
    return { mode: "personal", s: last, g, secs, items, noTidak: order.every(d => !counts[d]) };
  }
  let form = last ? last.form : formFor(ageParts(c.dob, todayISO()).rounded);
  if (!form) form = ageParts(c.dob, todayISO()).rounded < 3 ? 3 : 72;
  const g = stimGroup(form);
  return { mode: last ? "pending" : "none", g, secs: DOM_ORDER.map(d => ({ d, n: null, acts: g[d].map((a, ai) => ({ a, ai, items: [] })) })) };
}
function viewStimulasi(c) {
  const p = stimPlan(c);
  let intro, notes = "";
  if (p.mode === "personal") {
    const cat = category(yesCount(p.s.verify.final));
    intro = `Aktivitas untuk umur ${p.g.label}, diurutkan mulai dari bidang dengan jawaban “Tidak” terbanyak pada skrining terverifikasi ${fmtDate(p.s.at)} (KPSP ${p.s.form} bulan).`;
    if (p.noTidak) notes += `<div class="note ok small">Semua jawaban terverifikasi “Ya”, jadi semua bidang ditampilkan dalam urutan baku. Lanjutkan stimulasi untuk menguatkan kemampuan ${esc(c.name)}.</div>`;
    if (cat !== "S") notes += `<div class="note ${cat === "P" ? "bad" : "warn"} small"><b>Hasil skrining: ${CATS[cat].k}.</b> ${cat === "P" ? "Stimulasi di rumah tidak menggantikan pemeriksaan. Segera periksakan anak ke dokter, Puskesmas, atau klinik tumbuh kembang." : "Lakukan stimulasi lebih sering dan ulangi skrining 2 minggu lagi. Bila tetap meragukan, konsultasikan ke tenaga kesehatan."}</div>`;
  } else {
    intro = `Stimulasi umum untuk umur ${p.g.label}, dalam urutan baku bidang perkembangan.`;
    notes = p.mode === "pending"
      ? `<div class="note info small">Skrining masih menunggu verifikasi dokter. Sementara itu, lakukan stimulasi umum ini. Urutan khusus untuk ${esc(c.name)} muncul setelah hasil diverifikasi.</div>`
      : `<div class="note info small">Setelah skrining diverifikasi dokter, stimulasi akan diurutkan sesuai kebutuhan ${esc(c.name)}. <button class="btn sm" style="margin-left:6px" data-act="tab" data-t="skrining">Mulai skrining</button></div>`;
  }
  const safety = p.g.min < 36 ? `<div class="note warn small">Dampingi anak selama bermain. Jauhkan benda kecil seperti kancing, baterai, atau manik-manik yang bisa tertelan.</div>` : "";
  const secs = p.secs.map(sec => `<section class="dom">
      <div class="dom-h"><span class="dot" style="background:${DOMS[sec.d].c}"></span><h2 class="h2" style="margin:0">${DOMS[sec.d].k}</h2>${sec.n !== null ? `<span class="stt">${sec.n} butir “Tidak”</span>` : ""}</div>
      <div class="tips">${sec.acts.map(x => `<article class="tip" style="border-left-color:${DOMS[sec.d].c}">
        <h3>${esc(x.a[0])}</h3><p>${esc(x.a[1])}</p>
        ${x.items.length ? `<p class="small for"><b>Terkait butir “Tidak”:</b> ${x.items.map(i => `no. ${i + 1}, ${esc(p.items[i][1])}`).join("; ")}</p>` : ""}
      </article>`).join("")}</div>
    </section>`).join("");
  return `<div class="stack">
    <div><h1 class="title">Stimulasi</h1><p class="muted">${intro}</p></div>
    ${notes}${safety}
    <div class="card"><h2 class="h2">Prinsip dasar</h2><ul class="list small">${STIM_RULES.map(r => `<li>${esc(r)}</li>`).join("")}</ul></div>
    ${secs}
    <p class="foot">Sumber: ${esc(STIM_META.sumber)} · Peninjau: ${esc(STIM_META.peninjau)} · Tanggal tinjau: ${esc(STIM_META.tanggal)}. Bila anak kehilangan kemampuan yang sebelumnya sudah ada, segera konsultasikan dengan dokter.</p>
  </div>`;
}

/* ---------- riwayat dan laporan ---------- */
function statusLabel(s) {
  if (s.status === "draft") return "Draf";
  if (s.status === "menunggu") return "Menunggu verifikasi";
  return CATS[category(yesCount(s.verify.final))].k;
}
function viewRiwayat(c) {
  if (ui.report) { const x = findSession(ui.report); if (x) return viewReport(x.c, x.s); ui.report = null; }
  const rows = [...c.sessions].reverse().map(s => `<tr>
      <td>${fmtDate(s.at)}</td><td>KPSP ${s.form} bl</td><td>${ROLES[s.by]}</td>
      <td class="st"><span class="pill ${s.status === "terverifikasi" ? CATS[category(yesCount(s.verify.final))].cls : ""}">${statusLabel(s)}</span></td>
      <td>${s.status === "draft" ? `<button class="btn sm" data-act="tab" data-t="skrining">Lanjutkan</button>` : `<button class="btn sm" data-act="report" data-s="${s.id}">Laporan</button>`}</td></tr>`).join("");
  return `<div class="stack">
    <div><h1 class="title">Riwayat skrining</h1><p class="muted">Semua skrining ${esc(c.name)}. Laporan ringkas dapat dicetak atau dibawa saat konsultasi.</p></div>
    ${rows ? `<div class="card scroll"><table class="rt"><thead><tr><th>Tanggal</th><th>Formulir</th><th>Diisi oleh</th><th>Hasil</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="card empty"><p class="muted">Belum ada skrining.</p><button class="btn pri" style="margin-top:10px" data-act="tab" data-t="skrining">Mulai skrining</button></div>`}
    ${data.role === "ortu" ? `<div class="row"><button class="btn sm" data-act="export">Unduh data anak (JSON)</button></div><p class="small muted">Data ekspor memakai kode anak tanpa nama, dengan struktur yang disiapkan untuk dipetakan ke format SATUSEHAT.</p>` : ""}
  </div>`;
}
function reportText(c, s) {
  const items = KPSP[s.form];
  let t = `LAPORAN RINGKAS SKRINING PERKEMBANGAN (CogniTrack)\nKode anak: ${c.code}\nTanggal lahir: ${fmtDate(c.dob)}\nTanggal skrining: ${fmtDate(s.at)}\nUmur saat skrining: ${ageText(s.age)} (${s.age.rounded} bulan)\nFormulir: KPSP ${s.form} bulan\nDiisi oleh: ${ROLES[s.by]}\nStatus: ${statusLabel(s)}\n`;
  if (s.verify) t += `Diverifikasi: ${s.verify.doctor}, ${fmtTime(s.verify.at)}\nJumlah Ya: ${yesCount(s.verify.final)}/${items.length}\nKategori: ${CATS[category(yesCount(s.verify.final))].k}\n`;
  t += "\nButir (jawaban pengguna → jawaban akhir):\n";
  items.forEach((it, i) => { t += `${i + 1}. [${DOMS[it[0]].k}] ${it[1]}\n   ${s.answers[i] ? "Ya" : "Tidak"} → ${s.verify ? (s.verify.final[i] ? "Ya" : "Tidak") + (nobsOf(s).includes(i) ? " (tidak teramati)" : "") : "belum diverifikasi"}\n`; const sp = followSpec(it); if (sp && s.answers[i] === true && followDone(sp, followOf(s, i))) t += `   Lanjutan: ${followText(sp, followOf(s, i))}${data.role === "dokter" && followConflict(sp, followOf(s, i)) ? " [tidak konsisten dengan Ya]" : ""}\n`; });
  if (s.verify && s.verify.note) t += `\nCatatan dokter: ${s.verify.note}\n`;
  if (s.verify) t += "\nSaran:\n" + advice(s).map(x => "- " + x).join("\n") + "\n";
  return t + "\n" + NOT_DIAGNOSIS;
}
function viewReport(c, s) {
  const items = KPSP[s.form], v = s.verify;
  const perDom = DOM_ORDER.map(d => {
    const idx = items.map((it, i) => it[0] === d ? i : -1).filter(i => i >= 0);
    const src = v ? v.final : s.answers;
    return `<tr><td>${DOMS[d].k}</td><td>${idx.filter(i => src[i] === true).length}</td><td>${idx.filter(i => src[i] === false).length}</td></tr>`;
  }).join("");
  const rows = items.map((it, i) => {
    const corr = v && v.final[i] !== s.answers[i];
    return `<tr class="${corr ? "corr" : ""}"><td>${i + 1}</td><td class="pre">${esc(it[1])}<div class="small muted">${DOMS[it[0]].k}</div>${followView(s, i)}</td><td>${s.answers[i] ? "Ya" : "Tidak"}</td><td>${v ? (v.final[i] ? "Ya" : "Tidak") + (nobsOf(s).includes(i) ? " (tidak teramati)" : "") + (corr ? " *" : "") : "–"}</td></tr>`;
  }).join("");
  return `<div class="stack">
    <div class="noprint row" style="margin-top:0"><button class="btn sm" data-act="closereport">← Kembali ke riwayat</button></div>
    <div class="card">
      <h1 style="font-size:1.4rem;margin-bottom:10px">Laporan ringkas skrining perkembangan</h1>
      <dl class="kv">
        <dt>Anak</dt><dd>${esc(c.name)} · kode ${esc(c.code)}</dd>
        <dt>Tanggal lahir</dt><dd>${fmtDate(c.dob)}${c.prem ? " · lahir prematur (umur tidak dikoreksi)" : ""}</dd>
        <dt>Tanggal skrining</dt><dd>${fmtDate(s.at)} · diisi oleh ${ROLES[s.by]}</dd>
        <dt>Umur</dt><dd>${ageText(s.age)} (${s.age.rounded} bulan)</dd>
        <dt>Formulir</dt><dd>KPSP ${s.form} bulan</dd>
        <dt>Status</dt><dd>${v ? `Diverifikasi oleh ${esc(v.doctor)}, ${fmtTime(v.at)}` : s.status === "menunggu" ? "Menunggu verifikasi dokter" : "Draf"}</dd>
      </dl>
      ${v ? resultBlock(s, false) : `<div class="note info" style="margin-top:14px">Kategori hasil belum ditampilkan karena jawaban belum diverifikasi dokter.</div>`}
      <h2 class="h2" style="margin-top:18px">Ringkasan per bidang ${v ? "(jawaban akhir)" : "(jawaban pengguna)"}</h2>
      <table class="rt"><thead><tr><th>Bidang</th><th>Ya</th><th>Tidak</th></tr></thead><tbody>${perDom}</tbody></table>
      <h2 class="h2" style="margin-top:18px">Jawaban per butir</h2>
      <div class="scroll"><table class="rt"><thead><tr><th>No</th><th>Butir</th><th>Pengguna</th><th>Akhir</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${v && corrections(s) ? `<p class="small muted">* dikoreksi dokter</p>` : ""}
      <p class="foot">${KPSP_DRAFT ? "Teks butir pada prototype ini masih draf dan belum identik dengan Buku Bagan SDIDTK." : "Teks butir, urutan, dan domain sesuai " + esc(KPSP_SOURCE) + "."}</p>
    </div>
    <div class="row noprint">
      <button class="btn pri" data-act="print">Cetak / simpan PDF</button>
      <button class="btn" data-act="copy" data-s="${s.id}">${ui.copied ? "Tersalin" : "Salin sebagai teks"}</button>
    </div>
    ${ui.showText ? `<div class="noprint"><label for="ta">Salin teks di bawah secara manual</label><textarea id="ta" readonly style="min-height:220px">${esc(reportText(c, s))}</textarea></div>` : ""}
  </div>`;
}
function exportJSON(c) {
  const out = {
    app: "CogniTrack MVP (prototype)", exportedAt: new Date().toISOString(),
    child: { code: c.code, birthDate: c.dob, premature: c.prem, consent: c.consent },
    screenings: c.sessions.filter(s => s.status !== "draft").map(s => ({
      instrument: "KPSP", formAgeMonths: s.form, date: s.at, ageAtScreening: s.age, filledBy: s.by, status: s.status,
      items: KPSP[s.form].map((it, i) => { const sp = followSpec(it), fv = followOf(s, i); return { no: i + 1, domain: it[0], userAnswer: s.answers[i], followUp: sp && s.answers[i] === true && followDone(sp, fv) ? followText(sp, fv) : null, finalAnswer: s.verify ? s.verify.final[i] : null, notObserved: nobsOf(s).includes(i) }; }),
      rerecordRequested: !!s.rerecord,
      yesCount: s.verify ? yesCount(s.verify.final) : null,
      category: s.verify ? CATS[category(yesCount(s.verify.final))].k : null,
      verifiedAt: s.verify ? new Date(s.verify.at).toISOString() : null
    }))
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `cognitrack-${c.code}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- dokter ---------- */
/* Video asli diunggah ke server (vids[s.id]). Data contoh (dummy) hanya ditandai s.video = true,
   dan halaman video menampilkan contoh tampilan pemutar per butir. */
const vidsOf = s => vids[s.id] || [];
const realVid = s => vidsOf(s).length > 0;
const hasVideo = s => !!(s.video || s.videoCount || realVid(s));
const clipsOf = s => hasVideo(s) ? KPSP[s.form].map((it, i) => i).filter(i => !KPSP[s.form][i][3].includes("n")) : [];
const clipSec = (s, i) => 12 + ((i * 17 + s.form) % 38);
const mmss = t => Math.floor(t / 60) + ":" + pad(t % 60);
const PROTO_VIDEO = `<div class="note warn small"><b>Ini hanyalah prototipe.</b> Video belum benar-benar direkam atau diunggah. Halaman ini menampilkan contoh tampilan pemutar video untuk dokter.</div>`;
function sessionMeta(c, s) {
  return `Kode <b>${esc(c.code)}</b> · KPSP ${s.form} bulan · umur ${s.age.rounded} bulan · diisi ${ROLES[s.by]}${c.prem ? " · prematur" : ""}`;
}
function thumb(s, i, small) {
  const it = KPSP[s.form][i];
  return `<span class="thumb${small ? " sm" : ""}" style="--c:${DOMS[it[0]].c}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><em>${mmss(clipSec(s, i))}</em></span>`;
}
function realThumb(s, small) {
  return `<span class="thumb${small ? " sm" : ""}" style="--c:var(--d0)" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><em>${vidsOf(s).length} video</em></span>`;
}
const fmtSize = b => b >= 1048576 ? dec(b / 1048576, 1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
function viewAntrean() {
  if (ui.vd) { const x = findSession(ui.vd.sid); if (x && x.s.status === "menunggu") return viewVerify(x.c, x.s); ui.vd = null; }
  const now = Date.now();
  const q = allSessions().filter(x => x.s.status === "menunggu").sort((a, b) => a.s.submittedAt - b.s.submittedAt);
  const week = allSessions().filter(x => x.s.status === "terverifikasi" && now - x.s.verify.at < 7 * 864e5).length;
  const tile = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="stack">
    <div><h1 class="title">Dasbor dokter</h1><p class="muted">Tinjau video, konfirmasi atau koreksi jawaban per butir, lalu tetapkan hasil akhir. Nama anak tidak ditampilkan.</p></div>
    <div class="stats">
      ${tile(q.length, "menunggu verifikasi")}
      ${tile(q.filter(x => hasVideo(x.s)).length, "disertai video")}
      ${tile(q.length ? fmtDur(now - q[0].s.submittedAt) : "–", "antrean terlama")}
      ${tile(week, "diverifikasi 7 hari terakhir")}
    </div>
    <h2 class="h2" style="margin:6px 0 -4px">Antrean verifikasi</h2>
    ${q.length ? q.map(({ c, s }) => {
      const cl = clipsOf(s), wait = rrWaiting(s), rr = s.rerecord;
      const rrTag = !rr ? "" : wait ? `<span class="pill warn">Rekam ulang diminta · batas ${fmtTime(rr.due)}</span>`
        : rr.resubmittedAt ? `<span class="pill ok">Video rekam ulang diterima</span>` : `<span class="pill bad">Batas rekam ulang lewat</span>`;
      return `<article class="card qrow">
        ${realVid(s) ? realThumb(s) : cl.length ? thumb(s, cl[0]) : `<span class="thumb none" aria-hidden="true">Tanpa video</span>`}
        <div class="qmain"><p>${sessionMeta(c, s)}</p>
          <p class="small muted">Dikirim ${fmtTime(s.submittedAt)} · menunggu ${fmtDur(now - s.submittedAt)} · ${realVid(s) ? vidsOf(s).length + " video" : cl.length ? cl.length + " klip video (contoh)" : "tanpa video"}</p>${rrTag}</div>
        <div class="row" style="margin-top:0">
          ${cl.length ? `<button class="btn sm" data-act="vopen" data-s="${s.id}" data-back="antrean">Lihat video</button>` : ""}
          ${wait ? `<button class="btn sm" disabled title="Dapat ditinjau setelah video ulang diterima atau batas waktu lewat">Menunggu rekaman ulang</button>` : `<button class="btn pri sm" data-act="review" data-s="${s.id}">Tinjau</button>`}
        </div>
      </article>`;
    }).join("") : `<div class="card empty"><p class="muted">Tidak ada checklist yang menunggu verifikasi.</p></div>`}
  </div>`;
}
function vdPreview(items) {
  if (ui.vd.rr.length) return `Kategori belum dapat ditetapkan: <b>${ui.vd.rr.length} butir menunggu rekam ulang</b>.`;
  const y = yesCount(ui.vd.final), cat = CATS[category(y)];
  return `Jawaban akhir: <b>${y}/${items.length} Ya</b> → <b>${cat.k}</b> · ${ui.vd.final.filter((v, i) => v !== ui.vd.user[i]).length} butir dikoreksi`;
}
function finalSeg(i, final, off) {
  const d = off ? " disabled" : "";
  return `<div class="seg" role="group" aria-label="Jawaban akhir butir ${i + 1}"><button data-act="vset" data-i="${i}" data-v="y" aria-pressed="${final === true}"${d}>Ya</button><button data-act="vset" data-i="${i}" data-v="n" aria-pressed="${final === false}"${d}>Tidak</button></div>`;
}
function viewVerify(c, s) {
  const items = KPSP[s.form], vd = ui.vd, cl = clipsOf(s), rr = s.rerecord, rrMode = vd.rr.length > 0;
  /* Butir video: sebelum rekam ulang dipakai, dokter dapat meminta rekam ulang (status proses).
     Setelah itu, butir yang tetap tidak teramati ditetapkan "Tidak" dengan catatan "tidak teramati". */
  const clipCtl = i => {
    if (!cl.includes(i)) return "";
    if (!rr) return `<label class="chk small rrchk"><input type="checkbox" data-act="vrr" data-i="${i}" ${vd.rr.includes(i) ? "checked" : ""}> Tidak teramati di video: minta rekam ulang</label>`;
    return `${rr.items.includes(i) ? `<span class="pill">${rr.resubmittedAt ? "sudah direkam ulang" : "rekam ulang tidak dikirim"}</span>` : ""}
      <label class="chk small rrchk"><input type="checkbox" data-act="vnobs" data-i="${i}" ${vd.nobs.includes(i) ? "checked" : ""}> Tetap tidak teramati: tetapkan “Tidak”</label>`;
  };
  const rows = items.map((it, i) => `<article class="item vrow2 ${vd.final[i] !== s.answers[i] ? "corr" : ""}" data-vrow="${i}">
      ${itemHead(it, i)}
      <p class="q">${esc(it[1])}</p>
      ${itemFig(it)}
      <div class="vans"><span class="small">Pengguna: <b>${s.answers[i] ? "Ya" : "Tidak"}</b></span>
        <span class="small">Jawaban akhir:</span>
        ${vd.rr.includes(i) ? `<span class="pill warn">menunggu rekam ulang</span>` : finalSeg(i, vd.final[i], vd.nobs.includes(i))}
        <span class="small corr-lbl">dikoreksi</span>
        ${vd.nobs.includes(i) ? `<span class="pill">tidak teramati</span>` : ""}
        ${cl.includes(i) && !realVid(s) ? `<button class="linkbtn small" data-act="vopen" data-s="${s.id}" data-i="${i}" data-back="verify">Lihat video butir ${i + 1}</button>` : ""}
      </div>
      ${followView(s, i)}
      ${clipCtl(i)}
    </article>`).join("");
  return `<div class="stack">
    <div class="row" style="margin-top:0"><button class="btn sm" data-act="closereview">← Kembali ke dasbor</button></div>
    <div><h1 class="title">Verifikasi checklist</h1><p class="muted">${sessionMeta(c, s)} · umur ${ageText(s.age)} · dikirim ${fmtTime(s.submittedAt)}</p></div>
    ${draftBanner()}
    <section class="card"><h2 class="h2">Video dari pengguna</h2>
      ${rr ? `<p class="note info small" style="margin-bottom:12px">Rekam ulang sudah diminta sekali (${fmtTime(rr.at)}) untuk butir ${rr.items.map(i => i + 1).join(", ")}. ${rr.resubmittedAt ? `Video ulang diterima ${fmtTime(rr.resubmittedAt)}.` : "Video ulang tidak dikirim sampai batas waktu."} Butir yang tetap tidak teramati ditetapkan “Tidak” dengan catatan “tidak teramati”.</p>` : ""}
      ${cl.length ? `${realVid(s)
          ? `<ul class="vlist">${vidsOf(s).map(v => `<li><span class="vn">${esc(v.name)} <span class="small muted">· ${fmtSize(v.size)} · ${fmtTime(v.at)}</span></span><button class="btn sm" data-act="vopen" data-s="${s.id}" data-v="${v.id}" data-back="verify">Putar</button></li>`).join("")}</ul>
            <p class="small muted" style="margin-top:8px">Orang tua diminta menyebutkan nomor butir di awal setiap rekaman.</p>`
          : `<div class="strip">${cl.map(i => `<button class="clipbtn" data-act="vopen" data-s="${s.id}" data-i="${i}" data-back="verify">${thumb(s, i, true)}<span class="small">Butir ${i + 1}</span></button>`).join("")}</div>
        <div class="row"><button class="btn sm" data-act="vopen" data-s="${s.id}" data-back="verify">Buka halaman video (${cl.length} klip)</button></div>`}
        <fieldset class="fs-radio"><legend>Apakah video dapat dinilai?</legend>
          <label class="chk"><input type="radio" name="vok" value="1" data-in="vok" ${vd.videoOk === true ? "checked" : ""}> Dapat dinilai</label>
          <label class="chk"><input type="radio" name="vok" value="0" data-in="vok" ${vd.videoOk === false ? "checked" : ""}> Tidak dapat dinilai (kualitas rekaman kurang)</label>
        </fieldset>`
        : `<p class="muted small">${c.consent.video ? "Pengguna mengirim tanpa video." : "Orang tua tidak menyetujui perekaman video."} Telaah berdasarkan jawaban pengguna.</p>`}
    </section>
    <section class="card"><h2 class="h2">Jawaban per butir</h2>
      <p class="small muted" style="margin-bottom:6px">Jawaban akhir hanya “Ya” atau “Tidak”, sesuai KPSP. Jawaban terisi sama dengan jawaban pengguna; ubah bila video atau telaah menunjukkan jawaban berbeda. Untuk butir yang ditanyakan kepada orang tua, nilailah isi pertanyaan lanjutannya, bukan hanya kata “Ya”.${rr ? "" : " Bila butir tidak teramati di video, minta rekam ulang alih-alih langsung menetapkan “Tidak”."}</p>
      ${rows}
    </section>
    <section class="card">
      <p class="note info" id="vprev">${vdPreview(items)}</p>
      ${ui.err ? `<p class="err" role="alert" style="margin-top:10px">${esc(ui.err)}</p>` : ""}
      <p class="small muted" style="margin-top:14px">Diverifikasi sebagai <b>${esc(vd.doctor)}</b>.</p>
      ${rrMode ? `<p class="note warn small">Anda meminta rekam ulang untuk ${vd.rr.length} butir. Hasil belum ditetapkan dan skrining tetap berstatus “menunggu verifikasi”. Orang tua punya waktu ${RR_DAYS} hari, dan permintaan ini hanya dapat dilakukan sekali.</p>` : ""}
      <div class="field" style="margin-top:12px"><label for="vn">${rrMode ? "Petunjuk rekam ulang untuk orang tua" : "Catatan untuk orang tua (opsional, bahasa sederhana)"}</label><textarea id="vn" maxlength="600" data-in="note">${esc(vd.note)}</textarea></div>
      ${rrMode ? `<button class="btn pri" data-act="askrr">Kirim permintaan rekam ulang</button>` : `<button class="btn pri" data-act="verify">Tetapkan hasil akhir</button>`}
    </section>
  </div>`;
}
function patchVerify(i) {
  const x = findSession(ui.vd.sid); if (!x) return;
  const row = app.querySelector(`[data-vrow="${i}"]`);
  if (row) {
    row.classList.toggle("corr", ui.vd.final[i] !== x.s.answers[i]);
    row.querySelectorAll("[data-act=vset]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.v === "y") === ui.vd.final[i])));
  }
  const pv = app.querySelector("#vprev"); if (pv) pv.innerHTML = vdPreview(KPSP[x.s.form]);
}
function viewVideos() {
  const x = findSession(ui.vview.sid), vv = ui.vview;
  if (!x) { ui.vview = null; return viewAntrean(); }
  const { c, s } = x, items = KPSP[s.form], cl = clipsOf(s);
  const editable = vv.back === "verify" && ui.vd && ui.vd.sid === s.id && s.status === "menunggu";
  const finalOf = i => editable ? ui.vd.final[i] : s.verify ? s.verify.final[i] : null;
  const back = vv.back === "verify" ? "← Kembali ke verifikasi" : vv.back === "selesai" ? "← Kembali ke daftar terverifikasi" : "← Kembali ke dasbor";
  if (!cl.length) return `<div class="stack"><div class="row" style="margin-top:0"><button class="btn sm" data-act="vclose">${back}</button></div><div class="card empty"><p class="muted">Sesi ini tidak disertai video.</p></div></div>`;
  if (realVid(s)) return viewRealVideos(c, s, back);
  if (!cl.includes(vv.clip)) vv.clip = cl[0];
  const i = vv.clip, it = items[i], pos = cl.indexOf(i), dur = clipSec(s, i), fin = finalOf(i);
  const ans = (v, lbl) => `<span class="achip ${v === true ? "y" : v === false ? "n" : ""}">${lbl}: ${v === true ? "Ya" : v === false ? "Tidak" : "–"}</span>`;
  const habit = items.map((t, k) => k).filter(k => items[k][3].includes("n"));
  return `<div class="stack">
    <div class="row" style="margin-top:0"><button class="btn sm" data-act="vclose">${back}</button></div>
    <div><h1 class="title">Video dari pengguna</h1><p class="muted">${sessionMeta(c, s)} · dikirim ${fmtTime(s.submittedAt)} · ${cl.length} klip</p></div>
    ${PROTO_VIDEO}
    <div class="vpage">
      <div class="stack" style="gap:12px">
        <div class="player" style="--c:${DOMS[it[0]].c}" role="img" aria-label="Contoh tampilan video butir ${i + 1}">
          <div class="p-top"><span>Butir ${i + 1} · ${DOMS[it[0]].k}</span><span class="p-badge">Contoh tampilan</span></div>
          <svg class="p-kid" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="34" r="16" fill="currentColor"/><path d="M34 104c0-24 11-44 26-44s26 20 26 44z" fill="currentColor"/></svg>
          <button class="p-play" data-act="vplay" aria-label="${vv.playing ? "Jeda" : "Putar"} (contoh)">${vv.playing
            ? `<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`}</button>
          <div class="p-bar"><span class="p-track"><i class="${vv.playing ? "run" : ""}" style="--dur:${dur}s"></i></span><span class="p-time">${vv.playing ? "memutar" : "0:00"} / ${mmss(dur)}</span></div>
        </div>
        <p class="small muted">Video belum tersedia di prototipe. Pada aplikasi, rekaman orang tua atau guru diputar di sini dan hanya dapat diakses dokter pemverifikasi.</p>
        <section class="card">
          ${itemHead(it, i)}
          <p class="q">${esc(it[1])}</p>
          ${itemFig(it)}
          <div class="vans">${ans(s.answers[i], "Pengguna")}${editable
            ? `<span class="small">Jawaban akhir:</span>${ui.vd.rr.includes(i) ? `<span class="pill warn">menunggu rekam ulang</span>` : finalSeg(i, fin, ui.vd.nobs.includes(i))}${fin !== s.answers[i] && !ui.vd.rr.includes(i) ? `<span class="corr-lbl" style="display:inline-block">dikoreksi</span>` : ""}`
            : ans(fin, "Akhir")}</div>
          <div class="row">
            <button class="btn sm" data-act="vclip" data-i="${cl[pos - 1]}" ${pos > 0 ? "" : "disabled"}>← Klip sebelumnya</button>
            <span class="small muted">${pos + 1} dari ${cl.length}</span>
            <button class="btn sm" data-act="vclip" data-i="${cl[pos + 1]}" ${pos < cl.length - 1 ? "" : "disabled"}>Klip berikutnya →</button>
          </div>
        </section>
      </div>
      <aside class="card clips" aria-label="Daftar klip">
        <h2 class="h2">Klip per butir</h2>
        ${cl.map(k => `<button class="clip" data-act="vclip" data-i="${k}" aria-current="${k === i}">
            ${thumb(s, k, true)}
            <span class="clip-t"><span><b>Butir ${k + 1}</b> · ${DOMS[items[k][0]].k}</span><span class="small muted">${esc(itemShort(items[k]))}</span>
            <span class="small">${s.answers[k] ? "Ya" : "Tidak"}${finalOf(k) !== null && finalOf(k) !== s.answers[k] ? ` → ${finalOf(k) ? "Ya" : "Tidak"} (dikoreksi)` : ""}${s.rerecord && s.rerecord.items.includes(k) ? ` · ${s.rerecord.resubmittedAt ? "rekaman ulang" : "rekam ulang diminta"}` : ""}${nobsOf(s).includes(k) ? " · tidak teramati" : ""}</span></span>
          </button>`).join("")}
        ${habit.length ? `<p class="small muted" style="margin-top:10px">Tidak direkam (ditanyakan kepada orang tua): butir ${habit.map(k => k + 1).join(", ")}.</p>` : ""}
      </aside>
    </div>
  </div>`;
}
/* Halaman video asli. Jawaban akhir diubah tanpa render ulang (patchVerify) agar video tidak berhenti. */
function viewRealVideos(c, s, back) {
  const vv = ui.vview, list = vidsOf(s), items = KPSP[s.form], cl = clipsOf(s);
  const v = list.find(x => x.id === vv.vid) || list[0]; vv.vid = v.id;
  const editable = vv.back === "verify" && ui.vd && ui.vd.sid === s.id && s.status === "menunggu";
  const rows = cl.map(i => {
    const fin = editable ? ui.vd.final[i] : s.verify ? s.verify.final[i] : null;
    return `<article class="item vrow2 ${fin !== null && fin !== s.answers[i] ? "corr" : ""}" data-vrow="${i}">
      ${itemHead(items[i], i)}
      <p class="small">${esc(itemShort(items[i]))}</p>
      <div class="vans"><span class="small">Pengguna: <b>${s.answers[i] ? "Ya" : "Tidak"}</b></span>
        ${editable ? `<span class="small">Jawaban akhir:</span>${ui.vd.rr.includes(i) ? `<span class="pill warn">menunggu rekam ulang</span>` : finalSeg(i, fin, ui.vd.nobs.includes(i))}<span class="small corr-lbl">dikoreksi</span>`
          : fin !== null ? `<span class="small">Akhir: <b>${fin ? "Ya" : "Tidak"}</b></span>` : ""}
      </div></article>`;
  }).join("");
  return `<div class="stack">
    <div class="row" style="margin-top:0"><button class="btn sm" data-act="vclose">${back}</button></div>
    <div><h1 class="title">Video dari pengguna</h1><p class="muted">${sessionMeta(c, s)} · dikirim ${fmtTime(s.submittedAt)} · ${list.length} video</p></div>
    <div class="vpage">
      <div class="stack" style="gap:12px">
        <video class="vreal" src="/api/videos/${enc(v.id)}" controls playsinline preload="metadata"></video>
        <p class="small muted">${esc(v.name)} · ${fmtSize(v.size)} · diunggah ${fmtTime(v.at)}</p>
        <section class="card"><h2 class="h2">Butir yang dapat direkam</h2>${rows}</section>
      </div>
      <aside class="card clips" aria-label="Daftar video">
        <h2 class="h2">Video</h2>
        ${list.map((x, k) => `<button class="clip" data-act="vpick" data-v="${x.id}" aria-current="${x.id === v.id}">
          ${realThumbOne(k)}<span class="clip-t"><span><b>Video ${k + 1}</b></span><span class="small muted">${esc(x.name)}</span><span class="small">${fmtSize(x.size)} · ${fmtTime(x.at)}${s.rerecord && x.at > s.rerecord.at ? " · rekam ulang" : ""}</span></span>
        </button>`).join("")}
      </aside>
    </div>
  </div>`;
}
const realThumbOne = k => `<span class="thumb sm" style="--c:var(--d0)" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg><em>${k + 1}</em></span>`;
function viewSelesai() {
  const list = allSessions().filter(x => x.s.status === "terverifikasi").sort((a, b) => b.s.verify.at - a.s.verify.at);
  return `<div class="stack">
    <div><h1 class="title">Sudah diverifikasi</h1><p class="muted">Pada penelitian, semua video dihapus setelah periode penelitian berakhir.</p></div>
    ${list.length ? `<div class="card scroll"><table class="rt"><thead><tr><th>Anak</th><th>Formulir</th><th>Diverifikasi</th><th>Hasil</th><th>Video</th></tr></thead><tbody>${list.map(({ c, s }) => `<tr>
        <td>${esc(c.code)}</td><td>KPSP ${s.form} bl</td><td>${fmtTime(s.verify.at)}<div class="small muted">${esc(s.verify.doctor)} · ${corrections(s)} dikoreksi</div></td>
        <td><span class="pill ${CATS[category(yesCount(s.verify.final))].cls}">${statusLabel(s)}</span></td>
        <td>${hasVideo(s) ? `<button class="btn sm" data-act="vopen" data-s="${s.id}" data-back="selesai">Lihat video</button>` : `<span class="small muted">Tidak ada</span>`}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="card empty"><p class="muted">Belum ada checklist yang diverifikasi.</p></div>`}
  </div>`;
}
function kappa(pairs, cats) {
  const n = pairs.length; if (!n) return null;
  const a = {}, b = {}; let po = 0;
  cats.forEach(k => { a[k] = 0; b[k] = 0; });
  pairs.forEach(([x, y]) => { if (x === y) po++; a[x]++; b[y]++; });
  po /= n;
  const pe = cats.reduce((t, k) => t + (a[k] / n) * (b[k] / n), 0);
  return { n, po, k: pe === 1 ? null : (po - pe) / (1 - pe) };
}
function landisKoch(k) {
  if (k === null) return "tidak dapat dihitung (semua jawaban sama)";
  if (k < 0) return "buruk (poor)";
  if (k <= 0.2) return "sangat lemah (slight)";
  if (k <= 0.4) return "lemah (fair)";
  if (k <= 0.6) return "sedang (moderate)";
  if (k <= 0.8) return "kuat (substantial)";
  return "hampir sempurna (almost perfect)";
}
function viewIndikator() {
  const all = allSessions().map(x => x.s);
  const done = all.filter(s => s.status !== "draft"), ver = all.filter(s => s.status === "terverifikasi");
  const withVid = done.filter(hasVideo), verVid = ver.filter(hasVideo);
  const okVid = verVid.filter(s => s.verify.videoOk === true);
  const times = ver.map(s => s.verify.at - s.submittedAt);
  const md = median(times);
  let nItems = 0, nCorr = 0; const ip = [], cp = [];
  ver.forEach(s => {
    s.answers.forEach((u, i) => { nItems++; if (u !== s.verify.final[i]) nCorr++; ip.push([u ? "Y" : "T", s.verify.final[i] ? "Y" : "T"]); });
    cp.push([category(yesCount(s.answers)), category(yesCount(s.verify.final))]);
  });
  const ki = kappa(ip, ["Y", "T"]), kc = kappa(cp, ["S", "M", "P"]);
  const rrs = done.filter(s => s.rerecord), rrSent = rrs.filter(s => s.rerecord.resubmittedAt && s.rerecord.resubmittedAt <= s.rerecord.due);
  const nNobs = ver.reduce((a, s) => a + nobsOf(s).length, 0);
  let nFollow = 0, nConflict = 0;
  done.forEach(s => KPSP[s.form].forEach((it, i) => { const sp = followSpec(it); if (sp && s.answers[i] === true) { nFollow++; if (followConflict(sp, followOf(s, i))) nConflict++; } }));
  const krow = (lbl, k) => `<tr><td>${lbl}</td><td>${k ? `κ = ${k.k === null ? "–" : dec(k.k)} · kesepakatan ${pct(k.po * k.n, k.n)} · n = ${k.n}<div class="small muted">${landisKoch(k.k)}</div>` : "–"}</td></tr>`;
  return `<div class="stack">
    <div><h1 class="title">Indikator feasibility</h1><p class="muted">Dihitung dari semua data di server untuk uji feasibility alur verifikasi (Subbab 3.4). Gunakan data dummy saat uji fungsionalitas.</p></div>
    <div class="card scroll"><table class="rt"><tbody>
      <tr><td>Sesi skrining diselesaikan dari yang dimulai</td><td>${done.length}/${all.length} (${pct(done.length, all.length)})</td></tr>
      <tr><td>Checklist yang disertai video</td><td>${withVid.length}/${done.length} (${pct(withVid.length, done.length)})</td></tr>
      <tr><td>Checklist dengan video yang dapat dinilai</td><td>${okVid.length}/${verVid.length} terverifikasi dengan video (${pct(okVid.length, verVid.length)})</td></tr>
      <tr><td>Checklist terverifikasi</td><td>${ver.length}/${done.length} (${pct(ver.length, done.length)})</td></tr>
      <tr><td>Median waktu unggah hingga verifikasi</td><td>${md === null ? "–" : fmtDur(md)}</td></tr>
      <tr><td>Butir yang dikoreksi dokter</td><td>${nCorr}/${nItems} (${pct(nCorr, nItems)})</td></tr>
      <tr><td>Checklist dengan permintaan rekam ulang</td><td>${rrs.length}/${withVid.length} checklist dengan video (${pct(rrs.length, withVid.length)})</td></tr>
      <tr><td>Rekam ulang dikirim dalam ${RR_DAYS} hari</td><td>${rrSent.length}/${rrs.length} (${pct(rrSent.length, rrs.length)})</td></tr>
      <tr><td>Butir dinilai “Tidak” karena tetap tidak teramati</td><td>${nNobs}/${nItems} (${pct(nNobs, nItems)})</td></tr>
      <tr><td>Pertanyaan lanjutan yang tidak konsisten dengan “Ya”</td><td>${nConflict}/${nFollow} (${pct(nConflict, nFollow)})</td></tr>
      ${krow("Cohen's kappa pengguna–dokter, per butir", ki)}
      ${krow("Cohen's kappa pengguna–dokter, per kategori hasil", kc)}
    </tbody></table></div>
    <p class="foot">Interpretasi kappa menurut Landis dan Koch (1977). Kesepakatan antar-dokter (20% checklist ditinjau dua dokter) belum tersedia di prototype ini. “Disertai video” berarti ada video yang diunggah; pada data contoh (dummy), sesi hanya ditandai berisi video.</p>
  </div>`;
}

/* ---------- render ---------- */
const app = document.getElementById("app");
function render() {
  if (!me) return renderAuth();
  document.documentElement.style.fontSize = (FS[data.fs] ?? 1) * 100 + "%";
  if (!ui.tab || !TABS[data.role].some(t => t[0] === ui.tab)) ui.tab = TABS[data.role][0][0];
  let body;
  if (data.role === "dokter") {
    body = tabs() + (ui.vview ? viewVideos() : ui.tab === "selesai" ? viewSelesai() : ui.tab === "indikator" ? viewIndikator() : viewAntrean());
  } else {
    const c = child();
    if (c && c.id !== data.active) data.active = c.id;
    if (data.role === "ortu" && (!c || ui.adding)) {
      if (!ui.draft) ui.draft = blankDraft();
      body = viewAdd();
    } else if (!c) {
      body = `<div class="card empty"><h1 class="h2">Belum ada anak didik</h1><p class="muted">Guru PAUD hanya dapat mengisi checklist untuk anak yang orang tuanya telah memberikan izin di CogniTrack.</p></div>`;
    } else if (!c.consent || ui.editConsent) {
      body = data.role === "ortu" ? viewConsent(c) : `<div class="card empty"><p class="muted">Menunggu persetujuan orang tua.</p></div>`;
    } else {
      body = tabs() + (ui.tab === "skrining" ? viewSkrining(c) : ui.tab === "stimulasi" ? viewStimulasi(c) : ui.tab === "riwayat" ? viewRiwayat(c) : viewBeranda(c));
    }
  }
  app.innerHTML = header() + `<main>${net.err ? `<p class="note ${net.offline ? "warn" : "bad"} small" role="alert" style="margin-bottom:14px">${esc(net.err)}</p>` : ""}${body}</main>
    <p class="foot noprint">Prototype Tahap 1 (MVP). Data dan video tersimpan di server CogniTrack.</p>`;
}

/* ---------- event ---------- */
function setField(el) {
  const k = el.dataset.in; if (!k) return;
  if (k === "vok") { if (ui.vd) ui.vd.videoOk = el.value === "1"; return; }
  if (k === "note" && ui.vd) { ui.vd[k] = el.value; return; }
  if (!ui.draft) return;
  ui.draft[k] = el.type === "checkbox" ? el.checked : el.value;
}
function setFollow(el) {
  const c = child(), dr = c && draftOf(c); if (!dr) return false;
  dr.follow = dr.follow || {};
  if (el.dataset.ft !== undefined) dr.follow[+el.dataset.ft] = el.value;
  else if (el.dataset.fw) {
    const [i, r, k] = el.dataset.fw.split(":"), sp = followSpec(KPSP[dr.form][+i]);
    const rows = Array.isArray(dr.follow[i]) ? dr.follow[i] : Array.from({ length: sp.n }, () => ({ w: "", a: "" }));
    rows[+r] = rows[+r] || { w: "", a: "" }; rows[+r][k] = el.value; dr.follow[i] = rows;
  } else return false;
  save(); refreshNext(dr); return true;
}
app.addEventListener("input", e => { if (!setFollow(e.target)) setField(e.target); });
app.addEventListener("change", e => {
  const t = e.target, act = t.dataset.act;
  if (t.dataset.upload) { const files = [...t.files]; t.value = ""; return uploadVideos(t.dataset.upload, files); }
  if (act === "switch") { data.active = t.value; resetView(); save(); return render(); }
  if ((act === "vrr" || act === "vnobs") && ui.vd) {
    const i = +t.dataset.i, key = act === "vrr" ? "rr" : "nobs";
    ui.vd[key] = t.checked ? [...new Set([...ui.vd[key], i])].sort((a, b) => a - b) : ui.vd[key].filter(x => x !== i);
    if (act === "vnobs" && t.checked) ui.vd.final[i] = false;
    ui.err = ""; return render();
  }
  if (t.dataset.ft !== undefined || t.dataset.fw) return;
  setField(t);
  if (t.dataset.in === "cVideo" && ui.editConsent) render();
});
function resetView() {
  Object.assign(ui, { adding: false, draft: null, err: "", confirm: null, editConsent: false, report: null, vd: null, vview: null, copied: false, showText: false });
}
app.addEventListener("click", e => {
  if (net.err && !net.offline) net.err = "";
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT" || el.tagName === "INPUT" || el.disabled) return;
  const act = el.dataset.act, c = child();
  if (act === "vset") {
    ui.vd.final[+el.dataset.i] = el.dataset.v === "y";
    const x = ui.vview && findSession(ui.vview.sid);
    return ui.vview && !(x && realVid(x.s)) ? render() : patchVerify(+el.dataset.i);
  }
  ui.err = "";
  if (act === "tab") { ui.tab = el.dataset.t; resetView(); window.scrollTo(0, 0); }
  else if (act === "fs") { data.fs = Math.max(0, Math.min(FS.length - 1, (data.fs ?? 1) + +el.dataset.d)); save(); }
  else if (act === "nope") ui.confirm = null;
  else if (act === "showadd") { ui.adding = true; ui.draft = blankDraft(); }
  else if (act === "canceladd") { ui.adding = false; ui.draft = null; }
  else if (act === "demo") {
    req("POST", "/api/demo").then(async j => { await pull(); data.active = j.active; resetView(); ui.tab = "beranda"; savePrefs(); render(); },
      e => { ui.err = e.message; render(); });
    return;
  }
  else if (act === "logout") { req("POST", "/api/auth/logout").catch(() => {}).then(() => loggedOut("")); return; }
  else if (act === "addchild") {
    const d = ui.draft, name = d.name.trim();
    if (!name) ui.err = "Isi nama panggilan anak.";
    else if (!d.dob || isNaN(D(d.dob))) ui.err = "Isi tanggal lahir.";
    else if (d.dob > todayISO()) ui.err = "Tanggal lahir tidak boleh di masa depan.";
    else if (ageParts(d.dob, todayISO()).rounded > 72) ui.err = "CogniTrack Tahap 1 untuk anak umur 3–72 bulan. Periksa kembali tanggal lahirnya.";
    else ui.err = consentErr(d);
    if (!ui.err) {
      const id = uid("c");
      data.children.push({ id, code: newCode(), name, dob: d.dob, prem: d.prem, consent: consentOf(d), sessions: [] });
      data.active = id; resetView(); ui.tab = "beranda"; save();
    }
  }
  else if (act === "editconsent" && c) {
    ui.editConsent = true;
    ui.draft = { ...blankDraft(), wali: c.consent.wali, rel: c.consent.rel, cData: true, cVideo: c.consent.video, cGuru: c.consent.guru };
  }
  else if (act === "cancelconsent") { ui.editConsent = false; ui.draft = null; }
  else if (act === "saveconsent" && c) {
    ui.err = consentErr(ui.draft);
    if (!ui.err) {
      c.consent = consentOf(ui.draft); delete c.legacy;
      ui.editConsent = false; ui.draft = null; save();
    }
  }
  else if (act === "delask") ui.confirm = "delchild";
  else if (act === "delyes" && c) {
    data.children = data.children.filter(x => x.id !== c.id);
    data.active = data.children.length ? data.children[0].id : null;
    resetView(); save();
  }
  else if (act === "start" && c && !draftOf(c) && !pendingOf(c)) {
    const at = todayISO(), age = ageParts(c.dob, at), form = formFor(age.rounded);
    if (form) {
      c.sessions.push({ id: uid("s"), at, form, age, by: data.role, step: "isi", answers: KPSP[form].map(() => null), status: "draft", verify: null });
      save(); window.scrollTo(0, 0);
    }
  }
  else if (act === "ans" && c) {
    const dr = draftOf(c), i = +el.dataset.i, v = el.dataset.v === "y";
    if (dr) { dr.answers[i] = dr.answers[i] === v ? null : v; save(); }
    render();
    const b = app.querySelector(`[data-act="ans"][data-i="${i}"][data-v="${el.dataset.v}"]`); if (b) b.focus({ preventScroll: true });
    return;
  }
  else if (act === "fchoice" && c) {
    const dr = draftOf(c), i = +el.dataset.i;
    if (dr) { dr.follow = dr.follow || {}; dr.follow[i] = +el.dataset.o; save(); }
  }
  else if (act === "resubmit") {
    const x = findSession(el.dataset.s);
    if (x && rrWaiting(x.s) && vidsOf(x.s).some(v => v.at > x.s.rerecord.at)) { x.s.rerecord.resubmittedAt = Date.now(); save(); }
  }
  else if (act === "vdel") {
    const sid = el.dataset.s, vid = el.dataset.v;
    req("DELETE", "/api/videos/" + enc(vid)).then(() => { vids[sid] = vidsOf({ id: sid }).filter(v => v.id !== vid); uploadErr = null; render(); },
      e => { uploadErr = { sid, msg: e.message }; render(); });
    return;
  }
  else if (act === "canceldraft") ui.confirm = "canceldraft";
  else if (act === "canceldraftyes" && c) { const dr = draftOf(c); if (dr) { c.sessions = c.sessions.filter(s => s !== dr); save(); } ui.confirm = null; }
  else if (act === "tovideo" && c) { const dr = draftOf(c); if (dr && canNext(dr)) { dr.step = "video"; save(); window.scrollTo(0, 0); } }
  else if (act === "toisi" && c) { const dr = draftOf(c); if (dr) { dr.step = "isi"; save(); } }
  else if (act === "submit" && c) {
    const dr = draftOf(c);
    if (dr) { dr.status = "menunggu"; dr.submittedAt = Date.now(); dr.video = vidsOf(dr).length > 0; ui.confirm = null; ui.tab = "beranda"; save(); window.scrollTo(0, 0); }
  }
  else if (act === "report") { ui.tab = data.role === "dokter" ? ui.tab : "riwayat"; ui.report = el.dataset.s; ui.copied = false; ui.showText = false; window.scrollTo(0, 0); }
  else if (act === "closereport") { ui.report = null; ui.showText = false; ui.copied = false; }
  else if (act === "print") { try { window.print(); } catch (x) { ui.showText = true; } }
  else if (act === "copy") {
    const x = findSession(el.dataset.s); if (!x) return;
    const txt = reportText(x.c, x.s);
    try { navigator.clipboard.writeText(txt).then(() => { ui.copied = true; render(); }, () => { ui.showText = true; render(); }); }
    catch (err) { ui.showText = true; }
  }
  else if (act === "export" && c) exportJSON(c);
  else if (act === "review") {
    const x = findSession(el.dataset.s);
    /* Setelah rekam ulang, mulai dari keputusan sementara dokter sebelumnya. */
    if (x && !rrWaiting(x.s)) ui.vd = { sid: x.s.id, user: x.s.answers.slice(), final: ((x.s.rerecord && x.s.rerecord.final) || x.s.answers).slice(), note: "", videoOk: null, doctor: me.name, rr: [], nobs: [] };
    window.scrollTo(0, 0);
  }
  else if (act === "closereview") ui.vd = null;
  else if (act === "verify" && ui.vd) {
    const x = findSession(ui.vd.sid);
    if (!x || x.s.status !== "menunggu") ui.vd = null;
    else if (ui.vd.rr.length) ui.err = "Ada butir yang menunggu rekam ulang. Kirim permintaan rekam ulang atau batalkan centangnya.";
    else if (hasVideo(x.s) && ui.vd.videoOk === null) ui.err = "Tandai apakah video dapat dinilai.";
    else {
      x.s.verify = { final: ui.vd.final.slice(), note: ui.vd.note.trim(), videoOk: hasVideo(x.s) ? ui.vd.videoOk : null, doctor: me.name, at: Date.now(),
        notObserved: ui.vd.nobs.filter(i => ui.vd.final[i] === false) };
      x.s.status = "terverifikasi"; ui.vd = null; save(); window.scrollTo(0, 0);
    }
  }
  /* Rekam ulang: status proses, hanya sekali, batas 7 hari. Skrining tetap "menunggu verifikasi". */
  else if (act === "askrr" && ui.vd) {
    const x = findSession(ui.vd.sid);
    if (!x || x.s.status !== "menunggu" || x.s.rerecord) ui.vd = null;
    else {
      const now = Date.now();
      x.s.rerecord = { items: ui.vd.rr.slice(), note: ui.vd.note.trim(), doctor: me.name, at: now, due: now + RR_DAYS * DAY, resubmittedAt: null, final: ui.vd.final.slice() };
      ui.vd = null; save(); window.scrollTo(0, 0);
    }
  }
  else if (act === "vopen") {
    ui.vview = { sid: el.dataset.s, clip: el.dataset.i !== undefined ? +el.dataset.i : null, vid: el.dataset.v || null, back: el.dataset.back, playing: false };
    window.scrollTo(0, 0);
  }
  else if (act === "vclip") { ui.vview.clip = +el.dataset.i; ui.vview.playing = false; }
  else if (act === "vpick") ui.vview.vid = el.dataset.v;
  else if (act === "vplay") ui.vview.playing = !ui.vview.playing;
  else if (act === "vclose") { ui.vview = null; window.scrollTo(0, 0); }
  render();
});
/* ---------- mulai ---------- */
/* ---------- masuk dan daftar ---------- */
const authUi = { mode: "login", login: "", name: "", password: "", password2: "", err: "", busy: false, note: "" };
function viewAuth() {
  const reg = authUi.mode === "register";
  return `<header class="top"><div class="brand">
      <svg viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15" fill="none" stroke="var(--d0)" stroke-width="3"/><circle cx="17" cy="17" r="9.5" fill="none" stroke="var(--d1)" stroke-width="3" stroke-dasharray="40 100" stroke-linecap="round"/><circle cx="17" cy="17" r="4" fill="var(--d2)"/></svg>
      <b>CogniTrack</b></div></header>
    <main><form class="card narrow" data-auth novalidate>
      <h1 class="title">${reg ? "Daftar sebagai orang tua" : "Masuk"}</h1>
      <p class="muted" style="margin-bottom:14px">${reg ? "Buat akun untuk menyimpan data skrining anak Anda. Akun dokter dibuat oleh pengelola CogniTrack."
        : "Masuk sebagai orang tua atau dokter. Dokter melihat kode anak, bukan namanya."}</p>
      ${authUi.note ? `<p class="note info small" style="margin-bottom:12px">${esc(authUi.note)}</p>` : ""}
      ${authUi.err ? `<p class="err" role="alert">${esc(authUi.err)}</p>` : ""}
      ${reg ? `<div class="field"><label for="an">Nama Anda</label><input id="an" type="text" maxlength="60" autocomplete="name" value="${esc(authUi.name)}" data-auth-in="name"></div>` : ""}
      <div class="field"><label for="al">Email atau nomor HP</label><input id="al" type="text" maxlength="200" autocomplete="username" inputmode="email" value="${esc(authUi.login)}" data-auth-in="login"></div>
      <div class="field"><label for="ap">Kata sandi</label><input id="ap" type="password" maxlength="200" autocomplete="${reg ? "new-password" : "current-password"}" value="${esc(authUi.password)}" data-auth-in="password">${reg ? `<p class="small muted">Minimal 8 karakter.</p>` : ""}</div>
      ${reg ? `<div class="field"><label for="ap2">Ulangi kata sandi</label><input id="ap2" type="password" maxlength="200" autocomplete="new-password" value="${esc(authUi.password2)}" data-auth-in="password2"></div>` : ""}
      <div class="row"><button class="btn pri" type="submit" ${authUi.busy ? "disabled" : ""}>${reg ? "Daftar" : "Masuk"}</button></div>
      ${canRegister || reg ? `<p class="small muted" style="margin-top:16px">${reg ? `Sudah punya akun? <button class="linkbtn" type="button" data-auth-mode="login">Masuk</button>`
        : `Orang tua yang belum punya akun? <button class="linkbtn" type="button" data-auth-mode="register">Daftar</button>`}</p>` : ""}
    </form>
    <p class="foot">CogniTrack adalah alat skrining dan edukasi, bukan alat diagnosis.</p></main>`;
}
function renderAuth() {
  app.innerHTML = viewAuth();
  const f = app.querySelector(authUi.err ? "[data-auth-in=password]" : "[data-auth-in]"); if (f && !authUi.busy) f.focus();
}
async function submitAuth() {
  const reg = authUi.mode === "register";
  if (reg && !authUi.name.trim()) authUi.err = "Isi nama Anda.";
  else if (!authUi.login.trim()) authUi.err = "Isi email atau nomor HP.";
  else if (!authUi.password) authUi.err = "Isi kata sandi.";
  else if (reg && authUi.password.length < 8) authUi.err = "Kata sandi minimal 8 karakter.";
  else if (reg && authUi.password !== authUi.password2) authUi.err = "Kedua kata sandi tidak sama.";
  else authUi.err = "";
  if (authUi.err) return renderAuth();
  authUi.busy = true; renderAuth();
  try {
    const j = await req("POST", reg ? "/api/auth/register" : "/api/auth/login",
      JSON.stringify(reg ? { name: authUi.name, login: authUi.login, password: authUi.password } : { login: authUi.login, password: authUi.password }));
    Object.assign(authUi, { password: "", password2: "", err: "", note: "", busy: false });
    await signedIn(j.user);
  } catch (e) {
    authUi.busy = false; authUi.err = e.offline ? "Server tidak dapat dihubungi." : e.message; authUi.password = ""; authUi.password2 = ""; renderAuth();
  }
}
app.addEventListener("submit", e => { if (e.target.matches("[data-auth]")) { e.preventDefault(); submitAuth(); } });
app.addEventListener("input", e => { const k = e.target.dataset.authIn; if (k) authUi[k] = e.target.value; });
app.addEventListener("click", e => {
  const b = e.target.closest("[data-auth-mode]"); if (!b) return;
  Object.assign(authUi, { mode: b.dataset.authMode, err: "", note: "", password: "", password2: "" }); renderAuth();
});

async function signedIn(user) {
  me = user; data.role = user.role; net.err = "";
  resetView(); ui.tab = null;
  app.innerHTML = `<main><p class="muted" style="padding:24px 0">Memuat data…</p></main>`;
  try { await pull(); } catch (e) { net.err = e.message; }
  /* Impor sekali data yang dulu tersimpan di peramban ini ke akun orang tua yang masih kosong.
     Hasil verifikasi lama tidak ikut, karena hanya dokter yang dapat menetapkan hasil. */
  const old = loadLocal();
  if (me.role === "ortu" && !data.children.length && old && old.children && old.children.length) {
    data.children = old.children.map(c => ({ ...c, sessions: (c.sessions || []).filter(s => s.by === "ortu" && s.status !== "terverifikasi" && !s.verify && !s.rerecord) }));
    save(); await flush();
    if (!net.err) try { localStorage.setItem(KEY + ":imported", localStorage.getItem(KEY) || ""); localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch (e) {}
  }
  render();
}
function loggedOut(note) {
  me = null; clearTimeout(net.timer);
  adopt({ children: [], videos: {} }); net.err = ""; upload = null; uploadErr = null;
  resetView();
  Object.assign(authUi, { mode: "login", password: "", password2: "", err: "", busy: false, note: note || "" });
  renderAuth();
}

async function boot() {
  app.innerHTML = `<main><p class="muted" style="padding:24px 0">Memuat data…</p></main>`;
  let r;
  try { r = await fetch("/api/auth/me"); }
  catch (e) {
    app.innerHTML = `<main><section class="card narrow" style="margin-top:24px"><h1 class="title">Server tidak dapat dihubungi</h1>
      <p class="muted">CogniTrack sekarang menyimpan data di server lokal. Jalankan <code>npm start</code> di folder proyek, lalu buka <b>http://localhost:3000</b>.</p>
      <div class="row"><button class="btn pri" onclick="location.reload()">Coba lagi</button></div></section></main>`;
    return;
  }
  const j = await r.json().catch(() => ({}));
  canRegister = j.register !== false;
  if (j.user) await signedIn(j.user); else renderAuth();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("beforeunload", e => { if (me && (dirty() || upload)) { flush(); e.preventDefault(); } });
}
boot();
