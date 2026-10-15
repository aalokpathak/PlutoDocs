import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

/** Hard page break: forces a new page in print, PDF and .docx output. */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [
      { tag: "div[data-page-break]" },
      // Word / mammoth and common HTML page-break idioms.
      { tag: "br[style*='page-break-before']" },
      { tag: "div[style*='page-break-after']", getAttrs: (el) => ((el as HTMLElement).textContent?.trim() ? false : null) },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-break": "", class: "page-break", style: "page-break-after: always" })];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            // Like Word, continue typing on the new page: at the end of the document
            // the break would otherwise stay selected and be replaced by the next keystroke.
            .command(({ tr, dispatch }) => {
              const { selection } = tr;
              if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) return true;
              if (dispatch) {
                const pos = selection.to;
                const next = tr.doc.resolve(pos).nodeAfter;
                if (!next?.isTextblock) tr.insert(pos, this.editor.schema.nodes.paragraph.create());
                tr.setSelection(TextSelection.create(tr.doc, pos + 1));
              }
              return true;
            })
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.setPageBreak(),
    };
  },
});
