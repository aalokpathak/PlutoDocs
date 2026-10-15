import { useEditorState, type Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { CaseSensitive, ChevronDown, ChevronUp, Replace, WholeWord, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/store/app";
import { getSearchState } from "./extensions/search";

export function FindBar({ editor }: { editor: Editor }) {
  const find = useApp((s) => s.find);
  const openFind = useApp((s) => s.openFind);
  const closeFind = useApp((s) => s.closeFind);
  const [term, setTerm] = useState("");
  const [replacement, setReplacement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const search = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = getSearchState(e.state);
      return { count: s?.matches.length ?? 0, index: s?.index ?? -1, caseSensitive: !!s?.caseSensitive, wholeWord: !!s?.wholeWord };
    },
  });

  // Opening the bar seeds it with the selected text and focuses the input.
  useEffect(() => {
    if (!find.open) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, " ").trim();
    if (selected && selected.length < 120 && !selected.includes("\n")) {
      setTerm(selected);
      editor.commands.setSearch({ term: selected });
    } else if (term) {
      editor.commands.setSearch({ term });
    }
    requestAnimationFrame(() => inputRef.current?.select());
    // Runs only when the bar opens or switches mode, not on every keystroke.
  }, [find.open, find.replace]);

  if (!find.open) return null;

  const close = () => {
    editor.commands.clearSearch();
    closeFind();
    editor.commands.focus();
  };
  const update = (value: string) => {
    setTerm(value);
    editor.commands.setSearch({ term: value });
  };
  const toggleBtn = (active: boolean) =>
    clsx("flex size-7 items-center justify-center rounded-md transition-colors", active ? "bg-accent-soft text-accent" : "text-fg-2 hover:bg-hover");

  return (
    <div className="glass-strong absolute right-6 top-3 z-30 w-[400px] animate-pop-in rounded-xl p-2" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          title={find.replace ? "Hide replace" : "Show replace"}
          onClick={() => openFind(!find.replace)}
          className="flex size-7 items-center justify-center rounded-md text-fg-2 hover:bg-hover"
        >
          <ChevronDown className={clsx("size-4 transition-transform", !find.replace && "-rotate-90")} />
        </button>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={term}
            placeholder="Find in document"
            onChange={(e) => update(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) editor.commands.findPrevious();
                else editor.commands.findNext();
              }
            }}
            className="h-8 w-full rounded-md border border-stroke bg-layer-solid pl-2.5 pr-16 text-[13px] outline-none focus:border-accent"
          />
          <span className="tabular pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11.5px] text-fg-3">
            {term ? (search.count ? `${search.index + 1} of ${search.count}` : "No results") : ""}
          </span>
        </div>
        <button type="button" title="Match case" className={toggleBtn(search.caseSensitive)} onClick={() => editor.commands.setSearch({ caseSensitive: !search.caseSensitive })}>
          <CaseSensitive className="size-4" />
        </button>
        <button type="button" title="Whole words only" className={toggleBtn(search.wholeWord)} onClick={() => editor.commands.setSearch({ wholeWord: !search.wholeWord })}>
          <WholeWord className="size-4" />
        </button>
        <button type="button" title="Previous (Shift+Enter)" disabled={!search.count} className={toggleBtn(false)} onClick={() => editor.commands.findPrevious()}>
          <ChevronUp className="size-4" />
        </button>
        <button type="button" title="Next (Enter)" disabled={!search.count} className={toggleBtn(false)} onClick={() => editor.commands.findNext()}>
          <ChevronDown className="size-4" />
        </button>
        <button type="button" title="Close (Esc)" className={toggleBtn(false)} onClick={close}>
          <X className="size-4" />
        </button>
      </div>
      {find.replace && (
        <div className="mt-1.5 flex items-center gap-1 pl-8">
          <input
            value={replacement}
            placeholder="Replace with"
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor.commands.replaceCurrent(replacement);
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-stroke bg-layer-solid px-2.5 text-[13px] outline-none focus:border-accent"
          />
          <button
            type="button"
            disabled={!search.count}
            onClick={() => editor.commands.replaceCurrent(replacement)}
            className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12.5px] hover:bg-hover disabled:opacity-40"
          >
            <Replace className="size-3.5" /> Replace
          </button>
          <button
            type="button"
            disabled={!search.count}
            onClick={() => editor.commands.replaceAll(replacement)}
            className="h-8 rounded-md px-2.5 text-[12.5px] hover:bg-hover disabled:opacity-40"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
