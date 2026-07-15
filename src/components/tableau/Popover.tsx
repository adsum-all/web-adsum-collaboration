import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
  minWidth?: number;
}

// A popover rendered in a portal with position: fixed, anchored to a trigger
// element. Because it lives at the document root it escapes the card modal's
// scroll overflow and stacking context, so it is never clipped or painted behind
// following content (the bug the inline absolute popovers had). It flips above the
// anchor when there is no room below, is clamped inside the viewport, and closes on
// outside click or Escape.
export function Popover({ open, anchor, onClose, children, align = "right", minWidth = 200 }: Props): JSX.Element | null {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const place = (): void => {
      const r = anchor.getBoundingClientRect();
      const pop = ref.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(Math.max(minWidth, pop?.offsetWidth ?? minWidth), vw - 16);
      const height = pop?.offsetHeight ?? 0;
      let left = align === "right" ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, vw - width - 8));
      const spaceBelow = vh - r.bottom - 8;
      const spaceAbove = r.top - 8;
      // Open below when it fits there, otherwise wherever there is more room.
      const below = height <= spaceBelow || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(120, (below ? spaceBelow : spaceAbove) - 4);
      const shown = Math.min(height || maxHeight, maxHeight);
      let top = below ? r.bottom + 4 : r.top - shown - 4;
      // Final guard: keep the whole box inside the viewport.
      top = Math.max(8, Math.min(top, vh - shown - 8));
      setPos({ top, left, maxHeight });
    };
    place();
    // Re-place after the content has painted (so height is known) and on scroll/resize.
    const raf = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, align, minWidth]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node;
      if (ref.current && !ref.current.contains(t) && anchor && !anchor.contains(t)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchor, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      className="popover-layer"
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        minWidth,
        maxHeight: pos?.maxHeight,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
