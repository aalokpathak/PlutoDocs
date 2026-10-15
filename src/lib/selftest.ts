/**
 * Native smoke test, available only in debug builds:
 *   set PLUTODOCS_SELFTEST_DIR=C:\some\folder && npm run app:dev
 * Saves the current document in every format, exports a PDF, reads each file
 * back, exercises recovery/revision/recent commands, writes report.json to the
 * folder and closes the window.
 */
import { getEditor, wordCount } from "@/editor/instance";
import { exportPdfTo } from "@/lib/documents";
import { loadDocument, writeDocument } from "@/lib/formats";
import { errorMessage, platform } from "@/lib/platform";
import type { DocFormat } from "@/lib/types";
import { useApp } from "@/store/app";

export async function runSelfTest(dir: string) {
  const editor = getEditor()!;
  const { doc } = useApp.getState();
  const results: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      results[name] = { ok: true, value: (await fn()) ?? null };
    } catch (e) {
      results[name] = { ok: false, error: errorMessage(e) };
    }
  };

  editor.commands.insertContent('<p>Selftest table:</p><table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>');
  const opts = { title: "Selftest", page: doc.page, createdAt: doc.createdAt, accentRgb: "99 102 241" };
  for (const format of ["pluto", "docx", "md", "html", "txt"] as DocFormat[]) {
    const path = `${dir}\\selftest.${format}`;
    await step(`write.${format}`, () => writeDocument(editor, path, format, opts));
    await step(`read.${format}`, async () => {
      const loaded = await loadDocument(path, format);
      const text = typeof loaded.content === "string" ? loaded.content : JSON.stringify(loaded.content);
      return { length: text.length, hasWelcome: text.includes("Welcome to PlutoDocs"), hasTable: text.includes("Selftest table") };
    });
  }
  await step("exportPdf", async () => {
    await exportPdfTo(`${dir}\\selftest.pdf`);
    const head = await platform.readText(`${dir}\\selftest.pdf`);
    return { magic: head.slice(0, 5), length: head.length };
  });
  await step("recovery", async () => {
    await platform.recoveryWrite("selftest-doc", '{"x":1}');
    const listed = (await platform.recoveryList()).some((e) => e.docId === "selftest-doc");
    await platform.recoveryClear("selftest-doc");
    const cleared = !(await platform.recoveryList()).some((e) => e.docId === "selftest-doc");
    return { listed, cleared };
  });
  await step("revisions", async () => {
    const r = await platform.revisionCreate("selftest-doc", "Selftest", wordCount(editor), '{"y":2}', 3);
    const list = await platform.revisionList("selftest-doc");
    const body = await platform.revisionRead("selftest-doc", r.id);
    await platform.revisionDelete("selftest-doc", r.id);
    return { created: r.id, listed: list.length, body };
  });
  await step("invalidId", async () => {
    try {
      await platform.recoveryWrite("../escape", "x");
      return "accepted (BAD)";
    } catch (e) {
      return `rejected: ${errorMessage(e)}`;
    }
  });
  await step("recent", async () => {
    await platform.recentAdd(`${dir}\\selftest.pluto`);
    const list = await platform.recentList();
    await platform.recentRemove(`${dir}\\selftest.pluto`);
    return list.find((d) => d.path.endsWith("selftest.pluto"));
  });

  await platform.writeText(`${dir}\\report.json`, JSON.stringify(results, null, 2));
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().destroy();
}
