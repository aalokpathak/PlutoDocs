import { Extension } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphSpacing: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

const TYPES = ["paragraph", "heading"];

/** Paragraph-level line spacing (Word's "Line and Paragraph Spacing"). */
export const ParagraphSpacing = Extension.create({
  name: "paragraphSpacing",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight as string}` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight:
        (lineHeight) =>
        ({ commands }) =>
          TYPES.map((t) => commands.updateAttributes(t, { lineHeight })).some(Boolean),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          TYPES.map((t) => commands.resetAttributes(t, "lineHeight")).some(Boolean),
    };
  },
});
