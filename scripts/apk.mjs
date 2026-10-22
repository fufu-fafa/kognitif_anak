// Menjalankan `gradlew assembleDebug` di android/. Gradle 9.1 berjalan di Java 17–25; bila JAVA_HOME
// kosong atau menunjuk Java yang lebih baru, dipakai JDK bawaan Android Studio (JBR).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const android = join(dirname(fileURLToPath(import.meta.url)), "..", "android");
const env = { ...process.env };
const MAX_JAVA = 25;

function javaMajor(home) {
  try { return parseInt(readFileSync(join(home, "release"), "utf8").match(/JAVA_VERSION="(\d+)/)[1], 10); } catch (e) { return null; }
}
const cur = env.JAVA_HOME && javaMajor(env.JAVA_HOME);
if (!env.JAVA_HOME || (cur && cur > MAX_JAVA)) {
  const jbr = [
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    join(homedir(), "Applications/Android Studio.app/Contents/jbr/Contents/Home"),
    "/opt/android-studio/jbr",
    join(homedir(), "android-studio/jbr"),
    "C:\\Program Files\\Android\\Android Studio\\jbr"
  ].find(p => existsSync(p) && (javaMajor(p) ?? 0) <= MAX_JAVA);
  if (jbr) { env.JAVA_HOME = jbr; console.log(`JAVA_HOME=${jbr}${cur ? ` (Java ${cur} terlalu baru untuk Gradle)` : ""}`); }
  else if (cur) console.warn(`Peringatan: JAVA_HOME memakai Java ${cur}; Gradle butuh Java 17–${MAX_JAVA}.`);
}

const win = process.platform === "win32";
const r = spawnSync(win ? "gradlew.bat" : "./gradlew", ["assembleDebug"], { cwd: android, env, stdio: "inherit", shell: win });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("\nAPK debug: " + join(android, "app/build/outputs/apk/debug/app-debug.apk"));
