import type { Editor } from "@tiptap/react";
import { clsx } from "clsx";
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  RemoveFormatting,
  Replace,
  Search,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  UnfoldVertical,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app";
import { ColorGrid, DropdownButton, HIGHLIGHT_COLORS, MenuItem, MenuLabel, Popover, TEXT_COLORS, ToolButton, usePopover } from "../ui";
import { FONT_FAMILIES, FONT_SIZES, Group, LINE_HEIGHTS, useFormatState, type FormatState } from "./shared";

const STYLES: { id: string; label: string; preview: string }[] = [
  { id: "paragraph", label: "Normal", preview: "text-[13px]" },
  { id: "h1", label: "Heading 1", preview: "text-[22px] font-semibold text-accent" },
  { id: "h2", label: "Heading 2", preview: "text-[18px] font-semibold text-accent" },
  { id: "h3", label: "Heading 3", preview: "text-[16px] font-semibold" },
  { id: "h4", label: "Heading 4", preview: "text-[14.5px] font-semibold" },
  { id: "h5", label: "Heading 5", preview: "text-[13px] font-semibold" },
  { id: "h6", label: "Heading 6", preview: "text-[11.5px] font-semibold uppercase tracking-wide text-fg-2" },
  { id: "code", label: "Code block", preview: "font-mono text-[12.5px]" },
];

export function applyBlockStyle(editor: Editor, id: string) {
  const chain = editor.chain().focus();
  if (id === "paragraph") chain.setParagraph().run();
  else if (id === "code") chain.toggleCodeBlock().run();
  else chain.setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
}

function StyleSelect({ editor, state }: { editor: Editor; state: FormatState }) {
  const current = STYLES.find((s) => s.id === state.block) ?? STYLES[0];
  return (
    <DropdownButton label="Paragraph style" wide className="w-[118px]" text={<span className="flex-1 truncate text-left">{current.label}</span>}>
      {(close) => (
        <div className="w-[230px]">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                applyBlockStyle(editor, s.id);
                close();
              }}
              className={clsx(
                "flex w-full items-center rounded-md px-3 py-1.5 text-left transition-colors hover:bg-hover",
                s.id === current.id && "bg-accent-soft",
              )}
            >
              <span className={s.preview}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </DropdownButton>
  );
}

function FontFamilySelect({ editor, state }: { editor: Editor; state: FormatState }) {
  const docFont = useApp((s) => s.doc.page.fontFamily);
  const current = state.fontFamily ?? docFont;
  return (
    <DropdownButton
      label="Font"
      wide
      className="w-[124px]"
      panelClassName="max-h-[360px] overflow-y-auto"
      text={
        <span className="flex-1 truncate text-left" style={{ fontFamily: current }}>
          {current}
        </span>
      }
    >
      {(close) => (
        <div className="w-[220px]">
          <MenuLabel>Document font</MenuLabel>
          <MenuItem
            checked={!state.fontFamily}
            onSelect={() => {
              editor.chain().focus().unsetFontFamily().run();
              close();
            }}
          >
            <span style={{ fontFamily: docFont }}>{docFont} (Body)</span>
          </MenuItem>
          <MenuLabel>All fonts</MenuLabel>
          {FONT_FAMILIES.map((f) => (
            <MenuItem
              key={f}
              checked={state.fontFamily === f}
              onSelect={() => {
                editor.chain().focus().setFontFamily(f).run();
                close();
              }}
            >
              <span style={{ fontFamily: f }}>{f}</span>
            </MenuItem>
          ))}
        </div>
      )}
    </DropdownButton>
  );
}

function parsePt(size: string | null, fallback: number): number {
  if (!size) return fallback;
  const n = parseFloat(size);
  if (!Number.isFinite(n)) return fallback;
  return size.endsWith("px") ? Math.round(n * 0.75 * 2) / 2 : n;
}

function FontSizeInput({ editor, state }: { editor: Editor; state: FormatState }) {
  const docSize = useApp((s) => s.doc.page.fontSize);
  const current = parsePt(state.fontSize, docSize);
  const [text, setText] = useState(String(current));
  const pop = usePopover();
  useEffect(() => setText(String(current)), [current]);

  const apply = (pt: number) => {
    const clamped = Math.min(400, Math.max(1, Math.round(pt * 2) / 2));
    if (clamped === docSize) editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(`${clamped}pt`).run();
  };
  const step = (dir: 1 | -1) => {
    const next = dir > 0 ? FONT_SIZES.find((s) => s > current) : [...FONT_SIZES].reverse().find((s) => s < current);
    apply(next ?? current + dir);
  };

  return (
    <>
      <div className="flex h-8 items-center rounded-md border border-transparent hover:border-stroke">
        <input
          aria-label="Font size"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const n = parseFloat(text);
              if (Number.isFinite(n)) apply(n);
            }
          }}
          onBlur={() => setText(String(current))}
          className="tabular h-full w-9 rounded-l-md bg-transparent pl-2 text-[12.5px] outline-none focus:bg-layer-solid"
        />
        <button
          ref={pop.anchorRef}
          type="button"
          aria-label="Font sizes"
          onMouseDown={(e) => e.preventDefault()}
          onClick={pop.toggle}
          className="flex h-full w-5 items-center justify-center rounded-r-md hover:bg-hover"
        >
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </div>
      <Popover open={pop.open} onClose={pop.close} anchorRef={pop.anchorRef} className="max-h-[320px] overflow-y-auto">
        <div className="w-[88px]">
          {FONT_SIZES.map((s) => (
            <MenuItem
              key={s}
              checked={s === current}
              onSelect={() => {
                apply(s);
                pop.close();
              }}
            >
              {s}
            </MenuItem>
          ))}
        </div>
      </Popover>
      <ToolButton label="Increase font size" shortcut="Ctrl+]" onClick={() => step(1)}>
        <AArrowUp className="size-4" />
      </ToolButton>
      <ToolButton label="Decrease font size" shortcut="Ctrl+[" onClick={() => step(-1)}>
        <AArrowDown className="size-4" />
      </ToolButton>
    </>
  );
}

/** Split button: the main part re-applies the last colour, the arrow opens the palette. */
export function ColorSplitButton({
  label,
  icon: Icon,
  color,
  colors,
  onApply,
  onClear,
  clearLabel,
}: {
  label: string;
  icon: typeof Baseline;
  color: string;
  colors: string[];
  onApply: (c: string) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  const pop = usePopover();
  return (
    <div className="flex shrink-0 items-center">
      <ToolButton label={label} className="w-7 flex-col gap-0 rounded-r-none" onClick={() => onApply(color)}>
        <Icon className="size-[15px]" />
        <span className="mt-px h-[3px] w-4 rounded-full" style={{ backgroundColor: color }} />
      </ToolButton>
      <ToolButton ref={pop.anchorRef} label={`${label} colours`} className="w-4 rounded-l-none" active={pop.open} onClick={pop.toggle}>
        <ChevronDown className="size-3 opacity-60" />
      </ToolButton>
      <Popover open={pop.open} onClose={pop.close} anchorRef={pop.anchorRef}>
        <ColorGrid
          colors={colors}
          columns={colors.length > 8 ? 8 : 4}
          clearLabel={clearLabel}
          onClear={() => {
            onClear();
            pop.close();
          }}
          onPick={(c) => {
            onApply(c);
            pop.close();
          }}
        />
      </Popover>
    </div>
  );
}

export function HomeTab({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);
  const openFind = useApp((s) => s.openFind);
  const [textColor, setTextColor] = useState("#c0392b");
  const [highlight, setHighlight] = useState(HIGHLIGHT_COLORS[0]);
  const chain = () => editor.chain().focus();
  const listItemType = state.taskList ? "taskItem" : "listItem";

  return (
    <>
      <Group label="Style">
        <StyleSelect editor={editor} state={state} />
      </Group>
      <Group label="Font">
        <FontFamilySelect editor={editor} state={state} />
        <FontSizeInput editor={editor} state={state} />
      </Group>
      <Group label="Formatting">
        <ToolButton label="Bold" shortcut="Ctrl+B" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold className="size-4" strokeWidth={2.5} />
        </ToolButton>
        <ToolButton label="Italic" shortcut="Ctrl+I" active={state.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolButton>
        <ToolButton label="Underline" shortcut="Ctrl+U" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline className="size-4" />
        </ToolButton>
        <ToolButton label="Strikethrough" shortcut="Ctrl+Shift+S" active={state.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough className="size-4" />
        </ToolButton>
        <ToolButton label="Subscript" shortcut="Ctrl+," active={state.subscript} onClick={() => chain().toggleSubscript().run()}>
          <Subscript className="size-4" />
        </ToolButton>
        <ToolButton label="Superscript" shortcut="Ctrl+." active={state.superscript} onClick={() => chain().toggleSuperscript().run()}>
          <Superscript className="size-4" />
        </ToolButton>
        <ToolButton label="Inline code" shortcut="Ctrl+E" active={state.code} onClick={() => chain().toggleCode().run()}>
          <Code className="size-4" />
        </ToolButton>
        <ColorSplitButton
          label="Text highlight colour"
          icon={Highlighter}
          color={highlight}
          colors={HIGHLIGHT_COLORS}
          clearLabel="No highlight"
          onApply={(c) => {
            setHighlight(c);
            chain().setHighlight({ color: c }).run();
          }}
          onClear={() => chain().unsetHighlight().run()}
        />
        <ColorSplitButton
          label="Font colour"
          icon={Baseline}
          color={textColor}
          colors={TEXT_COLORS}
          clearLabel="Automatic"
          onApply={(c) => {
            setTextColor(c);
            chain().setColor(c).run();
          }}
          onClear={() => chain().unsetColor().run()}
        />
        <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().unsetLineHeight().run()}>
          <RemoveFormatting className="size-4" />
        </ToolButton>
      </Group>
      <Group label="Paragraph">
        <ToolButton label="Bulleted list" shortcut="Ctrl+Shift+8" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolButton>
        <ToolButton label="Numbered list" shortcut="Ctrl+Shift+7" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolButton>
        <ToolButton label="Checklist" shortcut="Ctrl+Shift+9" active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
          <ListChecks className="size-4" />
        </ToolButton>
        <ToolButton label="Decrease indent" shortcut="Shift+Tab" disabled={!state.canOutdent} onClick={() => chain().liftListItem(listItemType).run()}>
          <IndentDecrease className="size-4" />
        </ToolButton>
        <ToolButton label="Increase indent" shortcut="Tab" disabled={!state.canIndent} onClick={() => chain().sinkListItem(listItemType).run()}>
          <IndentIncrease className="size-4" />
        </ToolButton>
      </Group>
      <Group label="Alignment">
        <ToolButton label="Align left" shortcut="Ctrl+Shift+L" active={state.align === "left"} onClick={() => chain().setTextAlign("left").run()}>
          <AlignLeft className="size-4" />
        </ToolButton>
        <ToolButton label="Center" shortcut="Ctrl+Shift+E" active={state.align === "center"} onClick={() => chain().setTextAlign("center").run()}>
          <AlignCenter className="size-4" />
        </ToolButton>
        <ToolButton label="Align right" shortcut="Ctrl+Shift+R" active={state.align === "right"} onClick={() => chain().setTextAlign("right").run()}>
          <AlignRight className="size-4" />
        </ToolButton>
        <ToolButton label="Justify" shortcut="Ctrl+Shift+J" active={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}>
          <AlignJustify className="size-4" />
        </ToolButton>
        <DropdownButton label="Line spacing" icon={<UnfoldVertical className="size-4" />}>
          {(close) => (
            <div className="w-[150px]">
              <MenuLabel>Line spacing</MenuLabel>
              {LINE_HEIGHTS.map((lh) => (
                <MenuItem
                  key={lh}
                  checked={(state.lineHeight ?? "1.5") === lh}
                  onSelect={() => {
                    if (lh === "1.5") chain().unsetLineHeight().run();
                    else chain().setLineHeight(lh).run();
                    close();
                  }}
                >
                  {lh === "1.5" ? "1.5 (default)" : lh}
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
      </Group>
      <Group label="Editing" last>
        <ToolButton label="Find" shortcut="Ctrl+F" onClick={() => openFind(false)}>
          <Search className="size-4" />
        </ToolButton>
        <ToolButton label="Replace" shortcut="Ctrl+H" onClick={() => openFind(true)}>
          <Replace className="size-4" />
        </ToolButton>
      </Group>
    </>
  );
}
