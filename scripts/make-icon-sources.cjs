// Membuat sumber ikon & splash (assets/) dari favicon index.html (kotak biru #1f45a6, batang putih).
// Jalankan dari akar repo: `node scripts/make-icon-sources.cjs && npm run assets`.
const sharp = require(process.cwd() + "/node_modules/sharp");
const BARS = "M7 24h18M10 24v-5M16 24V12M22 24V7";
const glyph = (stroke) => `<path d="${BARS}" stroke="${stroke}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
const badge = (pen, onPen) => `<rect width="32" height="32" rx="7" fill="${pen}"/>${glyph(onPen)}`;
const svg = (size, body, bg) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}${body}</svg>`);
// Tempatkan grafik 32x32 berukuran `px` di tengah kanvas `size`.
const place = (size, px, inner) => `<g transform="translate(${(size - px) / 2} ${(size - px) / 2}) scale(${px / 32})">${inner}</g>`;
const out = "assets/";
(async () => {
  await sharp(svg(1024, place(1024, 1024, badge("#1f45a6", "#fff")))).png().toFile(out + "icon-only.png");
  // Ikon adaptif: @capacitor/assets sudah memberi inset 16,7% (area tampak 72 dari 108 dp), jadi batang digambar seukuran kanvas.
  await sharp(svg(1024, place(1024, 1024, glyph("#fff")))).png().toFile(out + "icon-foreground.png");
  await sharp(svg(1024, "", "#1f45a6")).png().toFile(out + "icon-background.png");
  await sharp(svg(2732, place(2732, 560, badge("#1f45a6", "#fff")), "#f4f6f8")).png().toFile(out + "splash.png");
  await sharp(svg(2732, place(2732, 560, badge("#93abf2", "#0d1530")), "#11151c")).png().toFile(out + "splash-dark.png");
  console.log("ok");
})();
