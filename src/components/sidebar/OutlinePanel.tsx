import { TextSelection } from "@tiptap/pm/state";
import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { ListTree } from "lucide-react";

export function OutlinePanel({ editor }: { editor: Editor }) {
  const { headings, active } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const list: { level: number; text: string; pos: number }[] = [];
      e.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          list.push({ level: node.attrs.level as number, text: node.textContent, pos });
          return false;
        }
        return node.isBlock && !node.isTextblock;
      });
      const caret = e.state.selection.from;
      let current = -1;
      list.forEach((h, i) => {
        if (h.pos <= caret) current = i;
      });
      return { headings: list, active: current };
    },
  });

  if (!headings.length) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center text-[12.5px] text-fg-3">
        <ListTree className="mb-3 size-9 text-fg-3/60" strokeWidth={1.4} />
        Add headings (Heading 1–6) to your document and they will show up here for quick navigation.
      </div>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));
  const jump = (pos: number) => {
    const { state, view } = editor;
    view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos + 1))));
    view.focus();
    const dom = view.nodeDOM(pos) as HTMLElement | null;
    dom?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="space-y-px">
      {headings.map((h, i) => (
        <button
          key={`${h.pos}-${i}`}
          type="button"
          onClick={() => jump(h.pos)}
          style={{ paddingLeft: 10 + (h.level - minLevel) * 14 }}
          className={clsx(
            "relative block w-full truncate rounded-md py-1.5 pr-2 text-left text-[12.5px] transition-colors hover:bg-hover",
            h.level === minLevel ? "font-semibold" : "text-fg-2",
            i === active && "bg-accent-soft text-accent",
          )}
        >
          {i === active && <span className="absolute left-0.5 top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full bg-accent" />}
          {h.text || <span className="italic text-fg-3">Untitled heading</span>}
        </button>
      ))}
    </div>
  );
}
