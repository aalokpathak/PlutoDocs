import type { Editor } from "@tiptap/react";
import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Globe, Info, Link2, LifeBuoy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { restoreRecovery } from "@/lib/documents";
import { normalizeUrl } from "@/lib/links";
import { platform, type RecoveryEntry } from "@/lib/platform";
import type { RecoveryPayload } from "@/lib/types";
import { useApp } from "@/store/app";
import { relativeTime } from "../StatusBar";
import { Button, Kbd, Modal, TextInput } from "../ui";

// ------------------------------------------------------------------ link

function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [initial] = useState(() => {
    if (editor.isActive("link")) editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    return {
      text: editor.state.doc.textBetween(from, to, " "),
      href: (editor.getAttributes("link").href as string | undefined) ?? "",
      existing: editor.isActive("link"),
    };
  });
  const [text, setText] = useState(initial.text);
  const [href, setHref] = useState(initial.href);
  const urlRef = useRef<HTMLInputElement>(null);
  useEffect(() => urlRef.current?.focus(), []);

  const apply = () => {
    const url = normalizeUrl(href);
    if (!url) return;
    const label = text.trim() || url;
    const chain = editor.chain().focus();
    if (label !== initial.text) {
      chain
        .insertContent({ type: "text", text: label, marks: [{ type: "link", attrs: { href: url } }] })
        .unsetMark("link")
        .run();
    } else {
      chain.extendMarkRange("link").setLink({ href: url }).run();
    }
    onClose();
  };
  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onClose();
  };

  return (
    <Modal
      title={initial.existing ? "Edit link" : "Insert link"}
      icon={<Link2 className="size-5" />}
      onClose={onClose}
      footer={
        <>
          {initial.existing && (
            <Button tone="subtle" className="mr-auto text-danger" onClick={remove}>
              Remove link
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" disabled={!href.trim()} onClick={apply}>
            {initial.existing ? "Update" : "Insert"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-fg">Text to display</span>
          <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Link text" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-fg">Address</span>
          <TextInput ref={urlRef} value={href} onChange={(e) => setHref(e.target.value)} placeholder="https://example.com or name@example.com" />
        </label>
        <p className="text-[11.5px] text-fg-3">
          Tip: <Kbd>Ctrl</Kbd> + click a link in the document to open it in your browser.
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ image from URL

function ImageUrlDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const normalized = normalizeUrl(url);

  return (
    <Modal
      title="Insert picture from the web"
      icon={<Globe className="size-5" />}
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="primary"
            disabled={status !== "ok"}
            onClick={() => {
              editor.chain().focus().setImage({ src: normalized, alt }).run();
              onClose();
            }}
          >
            Insert
          </Button>
        </>
      }
    >
      <div className="space-y-3 pt-1">
        <TextInput
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStatus("idle");
          }}
          placeholder="https://example.com/picture.png"
        />
        <TextInput value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alternative text (for accessibility)" />
        {normalized && (
          <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border border-stroke bg-layer-alt">
            <img
              src={normalized}
              alt=""
              className={clsx("max-h-full max-w-full object-contain", status !== "ok" && "hidden")}
              onLoad={() => setStatus("ok")}
              onError={() => setStatus("error")}
            />
            {status === "idle" && <span className="text-[12px] text-fg-3">Loading preview…</span>}
            {status === "error" && <span className="text-[12px] text-danger">Couldn't load an image from this address.</span>}
          </div>
        )}
        <p className="text-[11.5px] text-fg-3">Web pictures are linked, not embedded; they need an internet connection to display.</p>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ recovery

function RecoveryDialog({ entries, onClose }: { entries: RecoveryEntry[]; onClose: () => void }) {
  const [list, setList] = useState(entries);
  const describe = (e: RecoveryEntry) => {
    try {
      const data = JSON.parse(e.payload) as RecoveryPayload;
      return { name: data.recovery.name, path: data.recovery.path, words: data.meta.words };
    } catch {
      return { name: "Unknown document", path: null, words: 0 };
    }
  };
  const discard = async (e: RecoveryEntry) => {
    await platform.recoveryClear(e.docId).catch(() => undefined);
    const next = list.filter((x) => x !== e);
    setList(next);
    if (!next.length) onClose();
  };

  return (
    <Modal
      title="Recover unsaved work"
      icon={<LifeBuoy className="size-5" />}
      onClose={onClose}
      width={500}
      footer={
        <>
          <Button className="mr-auto" tone="subtle" onClick={() => void Promise.all(list.map((e) => platform.recoveryClear(e.docId))).then(onClose)}>
            Discard all
          </Button>
          <Button onClick={onClose}>Decide later</Button>
        </>
      }
    >
      <p className="mb-3">PlutoDocs closed before these documents were saved. Restore the ones you want to keep.</p>
      <div className="space-y-2">
        {list.map((e) => {
          const d = describe(e);
          return (
            <div key={e.docId} className="flex items-center gap-3 rounded-lg border border-stroke bg-layer-alt p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-fg">{d.name}</div>
                <div className="truncate text-[11.5px] text-fg-3">
                  {relativeTime(e.modifiedMs)} · {d.words.toLocaleString()} words{d.path ? ` · ${d.path}` : " · never saved"}
                </div>
              </div>
              <Button size="sm" tone="subtle" onClick={() => void discard(e)}>
                Discard
              </Button>
              <Button
                size="sm"
                tone="primary"
                onClick={() => {
                  onClose();
                  void restoreRecovery(e);
                }}
              >
                Restore
              </Button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ about

function AboutDialog({ onClose }: { onClose: () => void }) {
  const info = useApp((s) => s.appInfo);
  const shortcuts: [string, string][] = [
    ["New / Open / Save", "Ctrl+N · Ctrl+O · Ctrl+S"],
    ["Save as", "Ctrl+Shift+S"],
    ["Export PDF", "Ctrl+Shift+P"],
    ["Print", "Ctrl+P"],
    ["Find / Replace", "Ctrl+F · Ctrl+H"],
    ["Insert link", "Ctrl+K"],
    ["Page break", "Ctrl+Enter"],
    ["Zoom", "Ctrl+= · Ctrl+- · Ctrl+0"],
    ["Toggle sidebar", "Ctrl+\\"],
    ["Focus mode", "F11"],
  ];
  return (
    <Modal title="About PlutoDocs" onClose={onClose} width={460} footer={<Button tone="primary" onClick={onClose}>Close</Button>}>
      <div className="mb-4 flex items-center gap-4">
        <img src="/app-icon.svg" alt="" className="size-16" />
        <div>
          <div className="font-display text-[18px] font-semibold text-fg">PlutoDocs</div>
          <div className="text-[12.5px]">
            Version {info?.version ?? "0.1.0"} · {info?.portable ? "Portable" : "Installed"} · Part of the Pluto suite
          </div>
        </div>
      </div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-3">Keyboard shortcuts</div>
      <div className="divide-y divide-stroke rounded-lg border border-stroke">
        {shortcuts.map(([k, v]) => (
          <div key={k} className="flex justify-between px-3 py-1.5 text-[12.5px]">
            <span>{k}</span>
            <span className="text-fg-3">{v}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ host

export function Dialogs({ editor }: { editor: Editor | null }) {
  const dialog = useApp((s) => s.dialog);
  const closeDialog = useApp((s) => s.closeDialog);
  if (!dialog) return null;
  switch (dialog.kind) {
    case "link":
      return editor ? <LinkDialog editor={editor} onClose={closeDialog} /> : null;
    case "image":
      return editor ? <ImageUrlDialog editor={editor} onClose={closeDialog} /> : null;
    case "recovery":
      return <RecoveryDialog entries={dialog.entries} onClose={closeDialog} />;
    case "about":
      return <AboutDialog onClose={closeDialog} />;
    case "confirm": {
      const { options, resolve } = dialog;
      return (
        <Modal
          title={options.title}
          icon={<AlertCircle className="size-5" />}
          onClose={() => resolve("cancel")}
          footer={options.actions.map((a, i) => (
            <Button key={a.id} autoFocus={i === 0} tone={a.tone === "primary" ? "primary" : "default"} className={clsx(a.tone === "danger" && "text-danger")} onClick={() => resolve(a.id)}>
              {a.label}
            </Button>
          ))}
        >
          {options.body}
        </Modal>
      );
    }
    default:
      return null;
  }
}

// ------------------------------------------------------------------ toasts

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[70] flex w-[340px] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? AlertCircle : Info;
        return (
          <div key={t.id} role="status" className="glass-strong pointer-events-auto flex animate-pop-in gap-3 rounded-xl p-3">
            <Icon className={clsx("mt-px size-[18px] shrink-0", t.tone === "success" ? "text-success" : t.tone === "error" ? "text-danger" : "text-accent")} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">{t.title}</div>
              {t.body && <div className="break-words text-[12px] text-fg-2">{t.body}</div>}
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-mr-1 -mt-1 self-start rounded p-1 text-fg-3 hover:bg-hover hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
