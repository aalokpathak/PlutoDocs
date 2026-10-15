import { useEditorState, type Editor } from "@tiptap/react";
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Columns2,
  PaintBucket,
  PanelTop,
  PanelLeft,
  Rows2,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from "lucide-react";
import { ColorGrid, DropdownButton, MenuItem, ToolButton } from "../ui";
import { Group } from "./shared";

const CELL_COLORS = [
  "#f8fafc", "#f1f5f9", "#e2e8f0", "#fef3c7", "#fde68a", "#dcfce7", "#bbf7d0", "#dbeafe",
  "#bfdbfe", "#e0e7ff", "#c7d2fe", "#f3e8ff", "#fce7f3", "#fee2e2", "#fed7aa", "#ccfbf1",
];

/** Contextual tab shown while the cursor is inside a table. */
export function TableTab({ editor }: { editor: Editor }) {
  const can = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      merge: e.can().mergeCells(),
      split: e.can().splitCell(),
      deleteRow: e.can().deleteRow(),
      deleteColumn: e.can().deleteColumn(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <>
      <Group label="Rows & columns">
        <ToolButton label="Insert row above" wide onClick={() => chain().addRowBefore().run()}>
          <BetweenHorizontalStart className="size-4" /> Above
        </ToolButton>
        <ToolButton label="Insert row below" wide onClick={() => chain().addRowAfter().run()}>
          <BetweenHorizontalEnd className="size-4" /> Below
        </ToolButton>
        <ToolButton label="Insert column left" wide onClick={() => chain().addColumnBefore().run()}>
          <BetweenVerticalStart className="size-4" /> Left
        </ToolButton>
        <ToolButton label="Insert column right" wide onClick={() => chain().addColumnAfter().run()}>
          <BetweenVerticalEnd className="size-4" /> Right
        </ToolButton>
      </Group>
      <Group label="Delete">
        <DropdownButton label="Delete" icon={<Trash2 className="size-4" />} text="Delete">
          {(close) => (
            <div className="w-[180px]">
              <MenuItem
                icon={<Rows2 className="size-4" />}
                disabled={!can.deleteRow}
                onSelect={() => {
                  chain().deleteRow().run();
                  close();
                }}
              >
                Delete row
              </MenuItem>
              <MenuItem
                icon={<Columns2 className="size-4" />}
                disabled={!can.deleteColumn}
                onSelect={() => {
                  chain().deleteColumn().run();
                  close();
                }}
              >
                Delete column
              </MenuItem>
              <MenuItem
                danger
                icon={<Trash2 className="size-4" />}
                onSelect={() => {
                  chain().deleteTable().run();
                  close();
                }}
              >
                Delete table
              </MenuItem>
            </div>
          )}
        </DropdownButton>
      </Group>
      <Group label="Merge">
        <ToolButton label="Merge cells" wide disabled={!can.merge} onClick={() => chain().mergeCells().run()}>
          <TableCellsMerge className="size-4" /> Merge
        </ToolButton>
        <ToolButton label="Split cell" wide disabled={!can.split} onClick={() => chain().splitCell().run()}>
          <TableCellsSplit className="size-4" /> Split
        </ToolButton>
      </Group>
      <Group label="Style" last>
        <ToolButton label="Header row" wide onClick={() => chain().toggleHeaderRow().run()}>
          <PanelTop className="size-4" /> Header row
        </ToolButton>
        <ToolButton label="Header column" wide onClick={() => chain().toggleHeaderColumn().run()}>
          <PanelLeft className="size-4" /> Header column
        </ToolButton>
        <DropdownButton label="Cell shading" icon={<PaintBucket className="size-4" />} text="Shading">
          {(close) => (
            <ColorGrid
              colors={CELL_COLORS}
              clearLabel="No colour"
              onClear={() => {
                chain().setCellAttribute("backgroundColor", null).run();
                close();
              }}
              onPick={(c) => {
                chain().setCellAttribute("backgroundColor", c).run();
                close();
              }}
            />
          )}
        </DropdownButton>
      </Group>
    </>
  );
}
