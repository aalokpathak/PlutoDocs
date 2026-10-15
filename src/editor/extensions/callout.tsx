import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, StickyNote, type LucideIcon } from "lucide-react";

export type CalloutType = "info" | "success" | "warning" | "danger" | "note";

export const CALLOUT_TYPES: { type: CalloutType; label: string; icon: LucideIcon }[] = [
  { type: "info", label: "Info", icon: Info },
  { type: "success", label: "Success", icon: CheckCircle2 },
  { type: "warning", label: "Warning", icon: AlertTriangle },
  { type: "danger", label: "Danger", icon: OctagonAlert },
  { type: "note", label: "Note", icon: StickyNote },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
      toggleCallout: (type?: CalloutType) => ReturnType;
      setCalloutType: (type: CalloutType) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

function CalloutView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const type = (node.attrs.type as CalloutType) ?? "info";
  const index = CALLOUT_TYPES.findIndex((c) => c.type === type);
  const current = CALLOUT_TYPES[index] ?? CALLOUT_TYPES[0];
  const Icon = current.icon;
  const cycle = () => {
    if (!editor.isEditable) return;
    updateAttributes({ type: CALLOUT_TYPES[(index + 1) % CALLOUT_TYPES.length].type });
  };
  return (
    <NodeViewWrapper className={`callout callout-${type}`} data-callout={type}>
      <button
        type="button"
        contentEditable={false}
        className="callout-icon callout-type-button cursor-pointer rounded hover:opacity-70"
        title={`${current.label} box — click to change type`}
        onClick={cycle}
      >
        <Icon size="1.15em" strokeWidth={2.2} />
      </button>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-callout") || "info",
        renderHTML: (attrs) => ({ "data-callout": attrs.type, class: `callout callout-${attrs.type}` }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }, { tag: "aside[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      setCallout:
        (type = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type }),
      toggleCallout:
        (type = "info") =>
        ({ commands, editor }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.wrapIn(this.name, { type }),
      setCalloutType:
        (type) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { type }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});
