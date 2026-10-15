#!/usr/bin/env node
/**
 * Regenerates the README screenshots in docs/screenshots/.
 *
 * Starts the Vite dev server, opens each scene (src/dev/screenshots.ts) in
 * headless Google Chrome (or Microsoft Edge), and saves a PNG.
 *
 * Usage: npm run screenshots [-- scene ...]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs", "screenshots");
const PORT = 1430;
const ALL_SCENES = ["hero", "dark", "table", "find", "history", "focus"];
const scenes = process.argv.slice(2).length ? process.argv.slice(2) : ALL_SCENES;

// Chrome first: a running Edge can swallow a headless launch without writing the file.
const browser = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find(existsSync);
if (!browser) {
  console.error("Microsoft Edge or Google Chrome is required.");
  process.exit(1);
}

mkdirSync(out, { recursive: true });
const server = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: "warn" });
await server.listen();

try {
  for (const scene of scenes) {
    const profile = mkdtempSync(join(tmpdir(), "pd-shot-"));
    const file = join(out, `${scene}.png`);
    // Async on purpose: a blocking call would freeze the Vite server in this same process.
    await promisify(execFile)(browser, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      "--window-size=1440,900",
      "--force-device-scale-factor=1.5",
      "--virtual-time-budget=10000",
      `--screenshot=${file}`,
      `http://localhost:${PORT}/?shot=${scene}`,
    ], { timeout: 60_000 });
    rmSync(profile, { recursive: true, force: true });
    if (!existsSync(file)) throw new Error(`${browser} did not write ${file}`);
    console.log(`  ${scene.padEnd(8)} -> ${file}`);
  }
} finally {
  await server.close();
}
