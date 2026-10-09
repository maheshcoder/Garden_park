import { useEffect, useRef, type ReactNode } from "react";
import { clearInput } from "../controllers/input";
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null!);
  useEffect(() => {
    clearInput();
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const elements = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>("button,input,select,a[href]"),
      ).filter((e) => !e.hasAttribute("disabled"));
    elements()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const list = elements();
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    root.addEventListener("keydown", keys);
    return () => {
      root.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="veil">
      <div
        className="dialog panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <button
          className="close icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
