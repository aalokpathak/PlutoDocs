/**
 * Dev-only scenes for the README screenshots (`?shot=<scene>`), captured by
 * scripts/screenshots.mjs. Never included in production builds.
 */
import { TextSelection } from "@tiptap/pm/state";
import { getSearchState } from "@/editor/extensions/search";
import { getEditor, wordCount } from "@/editor/instance";
import { formatFromPath, serializePluto } from "@/lib/formats";
import { platform } from "@/lib/platform";
import { getTemplates } from "@/lib/templates";
import type { Theme } from "@/lib/types";
import { newUntitledDoc, useApp, type RibbonTab, type SidebarPanel } from "@/store/app";

interface Scene {
  theme: Theme;
  template: string;
  name: string;
  sidebar: SidebarPanel | null;
  ribbon?: RibbonTab;
  focus?: boolean;
  /** Runs after the document is loaded. */
  setup?: () => Promise<void> | void;
}

const DOCS = "C:\\Users\\Alex\\Documents";

/** Puts the caret inside the first node of the given type. */
function caretInto(type: string, index = 0) {
  const editor = getEditor()!;
  let found = -1;
  let seen = 0;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === type && seen++ === index) found = pos;
    return true;
  });
  if (found < 0) return;
  const { state, view } = editor;
  view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(found + 1))));
}

const SCENES: Record<string, Scene> = {
  hero: { theme: "light", template: "project-proposal", name: "Customer Portal Proposal.docx", sidebar: "templates" },
  dark: {
    theme: "dark",
    template: "report",
    name: "Q3 Performance Report.pluto",
    sidebar: "outline",
    setup: () => caretInto("heading", 3),
  },
  table: {
    theme: "dark",
    template: "meeting-notes",
    name: "Weekly Team Sync.pluto",
    sidebar: null,
    ribbon: "table",
    setup: () => caretInto("tableCell", 1),
  },
  find: {
    theme: "light",
    template: "study-notes",
    name: "CS101 Lecture 4.md",
    sidebar: "files",
    setup: async () => {
      const editor = getEditor()!;
      editor.commands.setSearch({ term: "algorithm" });
      const match = getSearchState(editor.state)?.matches[1];
      if (match) editor.commands.setTextSelection(match);
      // The find bar seeds itself from the selection when it opens…
      useApp.getState().openFind(true);
      await new Promise((r) => setTimeout(r, 100));
      // …then collapse it so the selection toolbar doesn't cover the page.
      if (match) editor.commands.setTextSelection(match.from);
    },
  },
  history: {
    theme: "light",
    template: "letter",
    name: "Cover Letter.docx",
    sidebar: "history",
    setup: async () => {
      const editor = getEditor()!;
      const { doc } = useApp.getState();
      const payload = JSON.stringify(serializePluto(editor.getJSON(), doc.page, "Cover Letter", wordCount(editor), doc.createdAt));
      for (const label of ["Auto snapshot", "Auto snapshot", "Saved version", "Manual snapshot", "Saved version"]) {
        await platform.revisionCreate(doc.docId, label, wordCount(editor), payload, 50);
        await new Promise((r) => setTimeout(r, 5));
      }
      useApp.getState().bumpHistory();
    },
  },
  focus: { theme: "dark", template: "study-notes", name: "CS101 Lecture 4.pluto", sidebar: null, focus: true },
};

export async function stageScene(name: string) {
  const scene = SCENES[name] ?? SCENES.hero;
  const app = useApp.getState();
  const editor = getEditor();
  if (!editor) return;

  document.documentElement.classList.add("shot");
  app.updateSettings({ theme: scene.theme, accent: "indigo", darkPaper: false });
  const doc = newUntitledDoc(app.settings.defaultPage);
  const path = `${DOCS}\\${scene.name}`;
  app.replaceDoc({ ...doc, docId: `shot-${name}`, name: scene.name, path, format: formatFromPath(path) ?? "pluto", lastSavedAt: Date.now() });

  const template = getTemplates().find((t) => t.id === scene.template)!;
  editor.commands.setContent(template.html, { emitUpdate: false });
  editor.commands.focus("start");

  useApp.setState({
    sidebarOpen: !!scene.sidebar,
    sidebarPanel: scene.sidebar ?? "files",
    ribbonTab: scene.ribbon ?? "home",
    focusMode: !!scene.focus,
  });
  await scene.setup?.();

  // A staged document is "saved", so the title bar shows its clean state.
  const { changeCount } = useApp.getState().doc;
  useApp.getState().setDoc({ savedChangeCount: changeCount });
  document.documentElement.dataset.shotReady = "1";
}
