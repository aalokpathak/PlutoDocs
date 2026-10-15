#!/usr/bin/env node
/**
 * Collects the Windows release artifacts into ./release after `tauri build`:
 *
 *   PlutoDocs_<v>_x64-setup.exe     NSIS installer          (bundle/nsis)
 *   PlutoDocs_<v>_x64_en-US.msi     Windows Installer       (bundle/msi)
 *   PlutoDocs_<v>_x64_portable.exe  Portable, no install    (the raw app binary)
 *   PlutoDocs_<v>_x64_portable.zip  Portable exe + marker file, for USB sticks
 *   SHA256SUMS.txt
 *
 * Tauri has no "portable" bundle target. The release binary is already
 * self-contained (frontend assets are embedded; WebView2 ships with Windows 11),
 * so the portable build is that binary. PlutoDocs switches to portable mode when
 * its file name contains "portable" or a `portable` file sits next to it, and
 * then keeps settings, history and WebView data in "PlutoDocs Data" beside the exe.
 *
 * Usage: npm run release            (build + collect)
 *        npm run release:collect    (collect an existing build)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const conf = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const cargo = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
const binName = /^name\s*=\s*"([^"]+)"/m.exec(cargo)[1];
const { productName, version } = conf;

const target = join(root, "src-tauri", "target", "release");
const out = join(root, "release");
mkdirSync(out, { recursive: true });

// Drop artifacts from previous versions.
for (const f of readdirSync(out)) {
  if (/\.(exe|msi|zip)$/i.test(f) || f === "SHA256SUMS.txt") rmSync(join(out, f));
}

const base = `${productName}_${version}_x64`;
const artifacts = [
  [`${base}-setup.exe`, join(target, "bundle", "nsis", `${base}-setup.exe`)],
  [`${base}_en-US.msi`, join(target, "bundle", "msi", `${base}_en-US.msi`)],
  [`${base}_portable.exe`, join(target, `${binName}.exe`)],
];
for (const [name, src] of artifacts) {
  if (!existsSync(src)) {
    console.error(`Missing build output: ${src}\nRun "npm run release" (or "npm run app:build") first.`);
    process.exit(1);
  }
  copyFileSync(src, join(out, name));
}

// Portable zip: the exe under its product name plus the marker file, so renaming
// the exe never silently switches it back to installed mode.
const stage = join(out, `${base}_portable`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage);
copyFileSync(join(target, `${binName}.exe`), join(stage, `${productName}.exe`));
writeFileSync(
  join(stage, "portable"),
  "This file makes PlutoDocs run in portable mode: settings, version history and\r\n" +
    "recovery files are stored in the \"PlutoDocs Data\" folder next to PlutoDocs.exe.\r\n",
);
const zip = join(out, `${base}_portable.zip`);
execFileSync("powershell.exe", ["-NoProfile", "-Command", `Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}' -Force`], {
  stdio: "inherit",
});
rmSync(stage, { recursive: true, force: true });

const files = readdirSync(out)
  .filter((f) => /\.(exe|msi|zip)$/i.test(f))
  .sort();
const sums = files.map((f) => `${createHash("sha256").update(readFileSync(join(out, f))).digest("hex")}  ${f}`);
writeFileSync(join(out, "SHA256SUMS.txt"), sums.join("\n") + "\n");
writeFileSync(join(out, "VERSION"), version);

// Body of the GitHub Release created by .github/workflows/release.yml.
const mb = (f) => `${(statSync(join(out, f)).size / 1048576).toFixed(1)} MB`;
const notes = `## PlutoDocs ${version}

A modern rich-text document processor for Windows, part of the Pluto software suite.

### Downloads

| File | Use it when | Size |
| --- | --- | --- |
| \`${base}-setup.exe\` | **Recommended.** Standard installer with Start menu shortcut and \`.pluto\` file association | ${mb(`${base}-setup.exe`)} |
| \`${base}_en-US.msi\` | Deploying with Group Policy, Intune or other MSI tooling | ${mb(`${base}_en-US.msi`)} |
| \`${base}_portable.exe\` | Running without installing (keeps its data in a \`PlutoDocs Data\` folder next to the exe) | ${mb(`${base}_portable.exe`)} |
| \`${base}_portable.zip\` | Same portable build, zipped with its \`portable\` marker file for USB drives | ${mb(`${base}_portable.zip`)} |

Requires Windows 10 or 11 (64-bit) with the Microsoft Edge WebView2 runtime, which is built into Windows 11. The installers set it up automatically if it is missing.

> The binaries are not code-signed yet, so Windows SmartScreen may show "Windows protected your PC". Choose **More info → Run anyway**.

### SHA-256 checksums

\`\`\`
${sums.join("\n")}
\`\`\`
`;
writeFileSync(join(out, "RELEASE_NOTES.md"), notes);

console.log(`\n${productName} v${version} release files in ${out}`);
for (const f of files) console.log(`  ${f.padEnd(44)} ${(statSync(join(out, f)).size / 1048576).toFixed(2).padStart(7)} MB`);
