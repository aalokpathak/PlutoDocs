import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchRange {
  from: number;
  to: number;
}

interface SearchState {
  term: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  matches: SearchRange[];
  index: number;
  decorations: DecorationSet;
}

type SearchMeta = Partial<Pick<SearchState, "term" | "caseSensitive" | "wholeWord" | "index">>;

export const searchKey = new PluginKey<SearchState>("search");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    search: {
      setSearch: (options: SearchMeta) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds matches inside each textblock; inline atoms count as one opaque character. */
function findMatches(doc: PMNode, term: string, caseSensitive: boolean, wholeWord: boolean): SearchRange[] {
  if (!term) return [];
  const source = wholeWord ? `\\b${escapeRegExp(term)}\\b` : escapeRegExp(term);
  const re = new RegExp(source, caseSensitive ? "gu" : "giu");
  const results: SearchRange[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) positions.push(pos + 1 + offset + i);
        text += child.text;
      } else {
        positions.push(pos + 1 + offset);
        text += "￼";
      }
    });
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      results.push({ from: positions[m.index], to: positions[m.index + m[0].length - 1] + 1 });
      if (results.length > 5000) return false;
    }
    return false;
  });
  return results;
}

function build(doc: PMNode, term: string, caseSensitive: boolean, wholeWord: boolean, index: number): SearchState {
  const matches = findMatches(doc, term, caseSensitive, wholeWord);
  const current = matches.length ? Math.min(Math.max(index, 0), matches.length - 1) : -1;
  const decorations = DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? "search-match search-match-current" : "search-match" })),
  );
  return { term, caseSensitive, wholeWord, matches, index: current, decorations };
}

export function getSearchState(state: EditorState): SearchState | undefined {
  return searchKey.getState(state);
}

/** Index of the first match at or after the cursor, so searching starts "from here". */
function indexFromSelection(state: EditorState, matches: SearchRange[]): number {
  const from = state.selection.from;
  const i = matches.findIndex((m) => m.from >= from);
  return i === -1 ? 0 : i;
}

export const Search = Extension.create({
  name: "search",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, { doc }) => build(doc, "", false, false, 0),
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
            if (meta) {
              const term = meta.term ?? prev.term;
              const caseSensitive = meta.caseSensitive ?? prev.caseSensitive;
              const wholeWord = meta.wholeWord ?? prev.wholeWord;
              const queryChanged = term !== prev.term || caseSensitive !== prev.caseSensitive || wholeWord !== prev.wholeWord;
              let index = meta.index ?? prev.index;
              if (queryChanged && meta.index === undefined) {
                index = indexFromSelection(newState, findMatches(tr.doc, term, caseSensitive, wholeWord));
              }
              return build(tr.doc, term, caseSensitive, wholeWord, index);
            }
            if (tr.docChanged && prev.term) {
              return build(tr.doc, prev.term, prev.caseSensitive, prev.wholeWord, prev.index);
            }
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decorations,
        },
      }),
    ];
  },

  addCommands() {
    const goTo =
      (step: 1 | -1) =>
      () =>
      ({ state, dispatch, view }: { state: EditorState; dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void; view: import("@tiptap/pm/view").EditorView }) => {
        const s = searchKey.getState(state);
        if (!s || !s.matches.length) return false;
        const index = (s.index + step + s.matches.length) % s.matches.length;
        const match = s.matches[index];
        if (dispatch) {
          const tr = state.tr.setMeta(searchKey, { index }).setSelection(TextSelection.create(state.doc, match.from, match.to));
          dispatch(tr.scrollIntoView());
          // Scroll the match to the middle of the viewport rather than its edge.
          requestAnimationFrame(() => {
            const dom = view.domAtPos(match.from).node as HTMLElement;
            (dom.nodeType === 1 ? dom : dom.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
          });
        }
        return true;
      };

    return {
      setSearch:
        (options) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, options);
          return true;
        },
      findNext: goTo(1),
      findPrevious: goTo(-1),
      replaceCurrent:
        (replacement) =>
        ({ state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || s.index < 0) return false;
          const match = s.matches[s.index];
          if (dispatch) {
            const tr = state.tr.insertText(replacement, match.from, match.to);
            // Keep the same index: the next match slides into this slot.
            tr.setMeta(searchKey, { index: s.index });
            dispatch(tr);
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ state, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || !s.matches.length) return false;
          if (dispatch) {
            const tr = state.tr;
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const { from, to } = s.matches[i];
              tr.insertText(replacement, from, to);
            }
            dispatch(tr);
          }
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, { term: "", index: 0 });
          return true;
        },
    };
  },
});
