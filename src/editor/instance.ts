import type { Editor } from "@tiptap/react";

/**
 * The single editor instance, for code that runs outside React components
 * (file commands, keyboard shortcuts, the autosave engine).
 */
let current: Editor | null = null;

export function setEditor(editor: Editor | null) {
  current = editor;
}

export function getEditor(): Editor | null {
  return current && !current.isDestroyed ? current : null;
}

export function wordCount(editor: Editor): number {
  return (editor.storage.characterCount?.words() as number | undefined) ?? 0;
}
