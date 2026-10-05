"use strict";
/* Kelola akun dari baris perintah (server boleh sedang berjalan).
     npm run user -- add-doctor <email/HP> "<nama dokter>"
     npm run user -- add-parent <email/HP> "<nama>"
     npm run user -- add-teacher <email/HP> "<nama>"
     npm run user -- reset-password <email/HP>
     npm run user -- claim <email/HP>       (anak dari sebelum ada login diberikan ke akun orang tua ini)
     npm run user -- list
   Kata sandi diminta tanpa ditampilkan di layar. */
const auth = require("./auth");
const store = require("./db");

function askHidden(prompt) {
  return new Promise((ok, fail) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      /* Masukan dari pipa: baca satu baris. */
      let buf = "";
      stdin.setEncoding("utf8");
      stdin.on("data", d => { buf += d; const i = buf.indexOf("\n"); if (i >= 0) { stdin.pause(); ok(buf.slice(0, i).replace(/\r$/, "")); } });
      stdin.on("end", () => ok(buf.replace(/\r?\n$/, "")));
      return;
    }
    process.stdout.write(prompt);
    let pw = "";
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    const onData = ch => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); return ok(pw); }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(130); }
        if (c === "\u007f" || c === "\b") pw = pw.slice(0, -1); else pw += c;
      }
    };
    stdin.on("data", onData);
  });
}
async function newPassword() {
  const pw = await askHidden("Kata sandi: ");
  const err = auth.passwordError(pw); if (err) throw new Error(err);
  if (process.stdin.isTTY && (await askHidden("Ulangi kata sandi: ")) !== pw) throw new Error("Kata sandi tidak sama.");
  return pw;
}

async function main() {
  const [cmd, login, name] = process.argv.slice(2);
  if (cmd === "add-doctor" || cmd === "add-parent" || cmd === "add-teacher") {
    if (!login || !name) throw new Error(`Pakai: npm run user -- ${cmd} <email/HP> "<nama>"`);
    const role = { "add-doctor": "dokter", "add-parent": "ortu", "add-teacher": "guru" }[cmd];
    const u = auth.createUser({ login, name, role, password: await newPassword() });
    console.log(`Akun ${{ dokter: "dokter", ortu: "orang tua", guru: "guru PAUD" }[role]} dibuat: ${u.login} (${u.name})`);
  } else if (cmd === "reset-password") {
    const u = login && store.userByLogin(auth.normLogin(login));
    if (!u) throw new Error("Akun tidak ditemukan.");
    store.setPassword(u.id, auth.hashPassword(await newPassword()));
    console.log(`Kata sandi ${u.login} diganti. Semua sesi masuk akun ini diakhiri.`);
  } else if (cmd === "claim") {
    const u = login && store.userByLogin(auth.normLogin(login));
    if (!u || u.role !== "ortu") throw new Error("Akun orang tua tidak ditemukan.");
    const n = store.db.prepare("UPDATE children SET owner_id = ? WHERE owner_id IS NULL").run(u.id).changes;
    console.log(`${n} data anak tanpa pemilik sekarang dimiliki ${u.login}.`);
  } else if (cmd === "list") {
    store.db.prepare("SELECT login, role, name, created_at FROM users ORDER BY role, created_at").all()
      .forEach(u => console.log(`${u.role.padEnd(7)} ${u.login.padEnd(32)} ${u.name}`));
    const orphans = store.db.prepare("SELECT COUNT(*) AS n FROM children WHERE owner_id IS NULL").get().n;
    if (orphans) console.log(`\n${orphans} data anak belum punya pemilik. Jalankan: npm run user -- claim <email/HP orang tua>`);
  } else {
    console.log(`Perintah:
  add-doctor <email/HP> "<nama>"   buat akun dokter
  add-parent <email/HP> "<nama>"   buat akun orang tua
  add-teacher <email/HP> "<nama>"  buat akun guru PAUD
  reset-password <email/HP>        ganti kata sandi
  claim <email/HP>                 berikan data anak dari sebelum ada login ke akun orang tua ini
  list                             daftar akun`);
  }
}
main().catch(e => { console.error("Gagal: " + e.message); process.exit(1); });
