import { clsx } from "clsx";
import { Check, ChevronDown, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

// ------------------------------------------------------------------ buttons

type Tone = "primary" | "default" | "subtle" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" }>(
  function Button({ tone = "default", size = "md", className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          "inline-flex select-none items-center justify-center gap-1.5 rounded-md font-medium transition-[background,color,box-shadow,transform] duration-100 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
          size === "md" ? "h-8 px-3.5 text-[13px]" : "h-7 px-2.5 text-[12px]",
          tone === "primary" && "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover",
          tone === "default" && "border border-stroke bg-layer-solid text-fg shadow-[0_1px_0_var(--pd-stroke)] hover:bg-hover",
          tone === "subtle" && "text-fg hover:bg-hover active:bg-pressed",
          tone === "danger" && "bg-danger text-white hover:brightness-110",
          className,
        )}
        {...props}
      />
    );
  },
);

export const ToolButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label: string; shortcut?: string; wide?: boolean }
>(function ToolButton({ active, label, shortcut, wide, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      onMouseDown={(e) => e.preventDefault() /* keep the editor selection */}
      className={clsx(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-fg transition-colors duration-100 disabled:pointer-events-none disabled:opacity-35",
        wide ? "px-2 text-[12.5px]" : "w-8",
        active ? "bg-accent-soft text-accent" : "hover:bg-hover active:bg-pressed",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export function Separator() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-stroke-strong/70" />;
}

// ------------------------------------------------------------------ popover

export function usePopover() {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return { open, setOpen, toggle: () => setOpen((o) => !o), close, anchorRef };
}

/** Floating panel rendered in a portal (so overflow:auto containers never clip it). */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = "start",
  className,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      let left = align === "end" ? anchor.right - w : anchor.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = anchor.bottom + 4;
      if (top + h > window.innerHeight - 8) top = Math.max(8, anchor.top - h - 4);
      setPos({ top, left });
    };
    place();
    const ro = new ResizeObserver(place);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;
  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className={clsx("glass-strong fixed z-50 animate-pop-in rounded-lg p-1", className)}
      onMouseDown={(e) => {
        // Clicking inside a menu must not steal the editor selection (inputs excepted).
        if (!(e.target as HTMLElement).closest("input, textarea, select")) e.preventDefault();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** A toolbar button that opens a popover. */
export function DropdownButton({
  label,
  icon,
  text,
  children,
  active,
  wide,
  className,
  panelClassName,
  align,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  text?: ReactNode;
  children: (close: () => void) => ReactNode;
  active?: boolean;
  wide?: boolean;
  className?: string;
  panelClassName?: string;
  align?: "start" | "end";
  disabled?: boolean;
}) {
  const pop = usePopover();
  return (
    <>
      <ToolButton
        ref={pop.anchorRef}
        label={label}
        active={active || pop.open}
        wide
        disabled={disabled}
        onClick={pop.toggle}
        className={clsx(wide && "justify-between", className)}
      >
        {icon}
        {text}
        <ChevronDown className="size-3 opacity-60" />
      </ToolButton>
      <Popover open={pop.open} onClose={pop.close} anchorRef={pop.anchorRef} align={align} className={panelClassName}>
        {children(pop.close)}
      </Popover>
    </>
  );
}

export function MenuItem({
  children,
  onSelect,
  checked,
  icon,
  hint,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void;
  checked?: boolean;
  icon?: ReactNode;
  hint?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-hover disabled:opacity-40",
        danger && "text-danger",
      )}
    >
      {icon !== undefined && <span className="flex w-4 shrink-0 justify-center text-fg-2">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11.5px] text-fg-3">{hint}</span>}
      {checked !== undefined && <Check className={clsx("size-3.5 shrink-0 text-accent", !checked && "invisible")} />}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-3">{children}</div>;
}

export function MenuDivider() {
  return <div className="mx-1.5 my-1 h-px bg-stroke" />;
}

// ------------------------------------------------------------------ inputs

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150",
        checked ? "border-accent bg-accent" : "border-fg-3 bg-transparent hover:bg-hover",
      )}
    >
      <span
        className={clsx(
          "absolute size-3 rounded-full transition-all duration-150",
          checked ? "left-[19px] bg-accent-fg" : "left-[3px] bg-fg-2",
        )}
      />
    </button>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-8 w-full rounded-md border border-stroke border-b-stroke-strong bg-layer-solid px-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-3 focus:border-b-accent focus:shadow-[inset_0_-1px_0_var(--pd-accent)]",
        className,
      )}
      {...props}
    />
  );
});

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-stroke bg-layer-alt p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[12.5px] transition-all",
            value === o.value ? "bg-layer-solid font-medium text-fg shadow-card" : "text-fg-2 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ colours

export const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#d9d9d9", "#efefef", "#ffffff",
  "#c0392b", "#e67e22", "#f1c40f", "#27ae60", "#16a085", "#2980b9", "#4f46e5", "#8e44ad",
  "#e6b8af", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#d9d2e9", "#ead1dc",
  "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#351c75", "#741b47",
];

export const HIGHLIGHT_COLORS = ["#fde68a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#ddd6fe", "#fed7aa", "#fecaca", "#e5e7eb"];

export function ColorGrid({
  colors,
  onPick,
  onClear,
  clearLabel = "Automatic",
  columns = 8,
}: {
  colors: string[];
  onPick: (color: string) => void;
  onClear: () => void;
  clearLabel?: string;
  columns?: number;
}) {
  return (
    <div className="w-[220px] p-1.5">
      <button
        type="button"
        onClick={onClear}
        className="mb-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-hover"
      >
        <X className="size-3.5 text-fg-3" /> {clearLabel}
      </button>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onPick(c)}
            className="aspect-square rounded-[4px] border border-black/10 transition-transform hover:scale-110 hover:shadow-card"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-hover">
        <span className="size-3.5 rounded-full" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
        Custom colour…
        <input type="color" className="sr-only" onChange={(e) => onPick(e.target.value)} />
      </label>
    </div>
  );
}

// ------------------------------------------------------------------ modal

export function Modal({
  title,
  children,
  footer,
  onClose,
  width = 440,
  icon,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  icon?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/30 p-6 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-strong flex max-h-full animate-pop-in flex-col overflow-hidden rounded-xl"
        style={{ width }}
      >
        <div className="flex items-start gap-3 px-6 pb-2 pt-5">
          {icon && <div className="mt-0.5 text-accent">{icon}</div>}
          <h2 className="min-w-0 flex-1 font-display text-[19px] font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-md p-1.5 text-fg-3 hover:bg-hover hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-auto px-6 pb-5 pt-1 text-[13.5px] text-fg-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stroke bg-layer-alt px-6 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-stroke border-b-stroke-strong bg-layer-solid px-1.5 py-px font-sans text-[11px] text-fg-2">
      {children}
    </kbd>
  );
}
