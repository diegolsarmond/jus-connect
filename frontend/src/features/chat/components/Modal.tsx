import type { MouseEvent, PropsWithChildren } from "react";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  ariaLabel: string;
  onClose: () => void;
  contentClassName?: string;
}

const focusableSelectors = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export const Modal = ({
  open,
  ariaLabel,
  onClose,
  contentClassName,
  children,
}: PropsWithChildren<ModalProps>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;
    const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
      focusableSelectors,
    );
    firstFocusable?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      lastFocusedElementRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
          focusableSelectors,
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return createPortal(
    <div className={styles.overlay} role="presentation" onMouseDown={handleBackdropMouseDown}>
      <div
        ref={containerRef}
        className={clsx(styles.content, contentClassName)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};
