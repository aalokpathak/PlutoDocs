import type { Editor } from "@tiptap/react";
import { clsx } from "clsx";
import {
  CalendarClock,
  FileCode2,
  ImagePlus,
  Link2,
  Minus,
  Omega,
  Quote,
  ScissorsLineDashed,
  Table2,
  Upload,
  Globe,
  MessageSquareWarning,
} from "lucide-react";
import { useState } from "react";
import { CALLOUT_TYPES } from "@/editor/extensions/callout";
import { lowlight } from "@/editor/extensions";
import { pickAndInsertImage } from "@/lib/insert";
import { useApp } from "@/store/app";
import { DropdownButton, MenuDivider, MenuItem, MenuLabel, ToolButton } from "../ui";
import { Group, useFormatState } from "./shared";

function TableGridPicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  const ROWS = 8;
  const COLS = 10;
  return (
    <div className="p-2">
      <div className="mb-2 px-0.5 text-[12px] font-medium text-fg-2">
        {hover.r && hover.c ? `${hover.c} × ${hover.r} table` : "Insert table"}
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${COLS}, 16px)` }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const r = Math.floor(i / COLS) + 1;
          const c = (i % COLS) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${c} by ${r} table`}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              className={clsx(
                "size-4 rounded-[3px] border transition-colors",
                on ? "border-accent bg-accent-soft" : "border-stroke-strong bg-layer-solid",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

const SYMBOLS = "©®™§¶†‡•…–—‘’“”«»‹›°±×÷≈≠≤≥∞√∑∏πΩµ←↑→↓↔⇒⇔✓✔✗★☆♥♦♣♠€£¥¢₹½¼¾¹²³αβγδλσφ".split("");

const LANGUAGES = ["plaintext", ...lowlight.listLanguages().filter((l) => l !== "plaintext")].sort();

export function InsertTab({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);
  const openDialog = useApp((s) => s.openDialog);
  const chain = () => editor.chain().focus();

  const insertDate = (format: Intl.DateTimeFormatOptions) =>
    chain().insertContent(new Intl.DateTimeFormat(undefined, format).format(new Date())).run();

  return (
    <>
      <Group label="Tables">
        <DropdownButton label="Table" icon={<Table2 className="size-4" />} text="Table">
          {(close) => (
            <TableGridPicker
              onPick={(rows, cols) => {
                chain().insertTable({ rows, cols, withHeaderRow: true }).run();
                close();
              }}
            />
          )}
        </DropdownButton>
      </Group>
      <Group label="Illustrations">
        <DropdownButton label="Pictures" icon={<ImagePlus className="size-4" />} text="Pictures">
          {(close) => (
            <div className="w-[200px]">
              <MenuItem
                icon={<Upload className="size-4" />}
                onSelect={() => {
                  close();
                  void pickAndInsertImage(editor);
                }}
              >
                From this device…
              </MenuItem>
              <MenuItem
                icon={<Globe className="size-4" />}
                onSelect={() => {
                  close();
                  openDialog({ kind: "image" });
                }}
              >
                From a web address…
              </MenuItem>
            </div>
          )}
        </DropdownButton>
      </Group>
      <Group label="Links">
        <ToolButton label="Link" shortcut="Ctrl+K" wide active={state.link} onClick={() => openDialog({ kind: "link" })}>
          <Link2 className="size-4" /> Link
        </ToolButton>
      </Group>
      <Group label="Blocks">
        <DropdownButton label="Callout box" icon={<MessageSquareWarning className="size-4" />} text="Callout" active={state.callout}>
          {(close) => (
            <div className="w-[190px]">
              <MenuLabel>Insert callout</MenuLabel>
              {CALLOUT_TYPES.map(({ type, label, icon: Icon }) => (
                <MenuItem
                  key={type}
                  icon={<Icon className={clsx("size-4", `callout-swatch-${type}`)} />}
                  onSelect={() => {
                    if (state.callout) chain().setCalloutType(type).run();
                    else chain().setCallout(type).run();
                    close();
                  }}
                >
                  {label}
                </MenuItem>
              ))}
              {state.callout && (
                <>
                  <MenuDivider />
                  <MenuItem
                    onSelect={() => {
                      chain().unsetCallout().run();
                      close();
                    }}
                  >
                    Remove callout
                  </MenuItem>
                </>
              )}
            </div>
          )}
        </DropdownButton>
        <ToolButton label="Quote" shortcut="Ctrl+Shift+B" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
          <Quote className="size-4" />
        </ToolButton>
        <DropdownButton label="Code block" icon={<FileCode2 className="size-4" />} active={state.codeBlock} panelClassName="max-h-[340px] overflow-y-auto">
          {(close) => (
            <div className="w-[180px]">
              <MenuLabel>Code block language</MenuLabel>
              {LANGUAGES.map((lang) => (
                <MenuItem
                  key={lang}
                  checked={editor.isActive("codeBlock", { language: lang === "plaintext" ? null : lang })}
                  onSelect={() => {
                    const language = lang === "plaintext" ? null : lang;
                    if (state.codeBlock) chain().updateAttributes("codeBlock", { language }).run();
                    else (language ? chain().setCodeBlock({ language }) : chain().setCodeBlock()).run();
                    close();
                  }}
                >
                  {lang}
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
        <ToolButton label="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>
          <Minus className="size-4" />
        </ToolButton>
        <ToolButton label="Page break" shortcut="Ctrl+Enter" onClick={() => chain().setPageBreak().run()}>
          <ScissorsLineDashed className="size-4" />
        </ToolButton>
      </Group>
      <Group label="Text" last>
        <DropdownButton label="Date & time" icon={<CalendarClock className="size-4" />}>
          {(close) => (
            <div className="w-[240px]">
              <MenuLabel>Insert date & time</MenuLabel>
              {(
                [
                  { dateStyle: "long" },
                  { dateStyle: "full" },
                  { dateStyle: "short" },
                  { dateStyle: "medium", timeStyle: "short" },
                  { timeStyle: "short" },
                ] as Intl.DateTimeFormatOptions[]
              ).map((f, i) => (
                <MenuItem
                  key={i}
                  onSelect={() => {
                    insertDate(f);
                    close();
                  }}
                >
                  {new Intl.DateTimeFormat(undefined, f).format(new Date())}
                </MenuItem>
              ))}
            </div>
          )}
        </DropdownButton>
        <DropdownButton label="Symbol" icon={<Omega className="size-4" />}>
          {(close) => (
            <div className="grid w-[264px] grid-cols-10 gap-0.5 p-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    chain().insertContent(s).run();
                    close();
                  }}
                  className="flex size-6 items-center justify-center rounded text-[14px] hover:bg-accent-soft hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </DropdownButton>
      </Group>
    </>
  );
}
