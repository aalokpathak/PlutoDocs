/**
 * Auto-save engine.
 *  1. Crash-recovery backup of the working copy ~1s after every edit (always on).
 *  2. AutoSave to the open file after a short idle period (toggle in the title bar).
 *  3. Periodic revision snapshots for the History panel.
 */
import type { Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { createSnapshot, lastSnapshotAt, recoveryPayload, saveDocument } from "@/lib/documents";
import { platform } from "@/lib/platform";
import { isDirty, useApp } from "@/store/app";

const BACKUP_DELAY_MS = 1200;
const SNAPSHOT_CHECK_MS = 30_000;

export function useAutosave(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;
    const app = () => useApp.getState();
    let backupTimer: ReturnType<typeof setTimeout> | undefined;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const backup = async () => {
      const { doc } = app();
      if (!isDirty(doc) || editor.isDestroyed) return;
      try {
        await platform.recoveryWrite(doc.docId, recoveryPayload(editor, doc));
        app().setDoc({ lastBackupAt: Date.now() });
      } catch (e) {
        console.warn("Recovery backup failed", e);
      }
    };

    const autoSave = async () => {
      const { doc, settings } = app();
      if (!settings.autoSave || !doc.path || !platform.savesInPlace || !isDirty(doc)) return;
      if (doc.saving) {
        saveTimer = setTimeout(autoSave, 1000);
        return;
      }
      await saveDocument({ silent: true });
    };

    const onUpdate = ({ transaction }: { transaction: Transaction }) => {
      // Plugin normalization alone (e.g. adding a trailing paragraph after a freshly
      // loaded document) is not an edit and must not mark the document dirty.
      if (!transaction.docChanged) return;
      app().markChanged();
    };
    editor.on("update", onUpdate);

    // React to any content or page-setup change recorded in the store.
    const unsubscribe = useApp.subscribe((state, prev) => {
      if (state.doc.changeCount === prev.doc.changeCount || !isDirty(state.doc)) return;
      clearTimeout(backupTimer);
      backupTimer = setTimeout(backup, BACKUP_DELAY_MS);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(autoSave, state.settings.autoSaveDelaySec * 1000);
    });

    // Turning AutoSave on saves pending changes right away.
    const unsubscribeToggle = useApp.subscribe((state, prev) => {
      if (state.settings.autoSave && !prev.settings.autoSave) void autoSave();
    });

    const snapshotTimer = setInterval(() => {
      const { doc, settings } = app();
      if (doc.changeCount === 0) return;
      if (Date.now() - lastSnapshotAt(doc.docId) < settings.snapshotMinutes * 60_000) return;
      void createSnapshot("Auto snapshot");
    }, SNAPSHOT_CHECK_MS);

    return () => {
      editor.off("update", onUpdate);
      unsubscribe();
      unsubscribeToggle();
      clearTimeout(backupTimer);
      clearTimeout(saveTimer);
      clearInterval(snapshotTimer);
    };
  }, [editor]);
}
