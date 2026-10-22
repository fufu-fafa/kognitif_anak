// Menyalin situs statis ke www/ untuk Capacitor. Situs di akar repo tetap dapat
// di-deploy apa adanya (misalnya GitHub Pages); hanya www/ yang mendapat runtime Capacitor.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "www");

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const dir of ["js", "img", "fonts"]) cpSync(join(root, dir), join(out, dir), { recursive: true });

// Tanpa bundler: runtime @capacitor/core (IIFE) mengisi window.Capacitor, lalu js/app.js
// mendaftarkan plugin native lewat Capacitor.registerPlugin dan memakainya dari Capacitor.Plugins.
const core = join(root, "node_modules/@capacitor/core/dist/capacitor.js");
if (!existsSync(core)) throw new Error("Jalankan `npm install` terlebih dahulu (runtime @capacitor/core tidak ditemukan).");
cpSync(core, join(out, "capacitor.js"));

const html = readFileSync(join(root, "index.html"), "utf8");
const marker = '<script src="js/kpsp.js"></script>';
if (!html.includes(marker)) throw new Error(`Penanda ${marker} tidak ditemukan di index.html.`);
writeFileSync(join(out, "index.html"), html.replace(marker, '<script src="capacitor.js"></script>\n' + marker));

console.log("www/ siap: index.html, capacitor.js, js/, img/, fonts/");
