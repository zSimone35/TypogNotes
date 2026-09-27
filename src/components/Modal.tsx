import { useEffect, useRef } from "react";

/**
 * Native modal dialog: the browser keeps focus inside, makes the page behind
 * inert and closes on Escape. Clicking the backdrop also closes it.
 */
export function Modal({ className, labelledBy, onClose, children }: {
  className: string;
  labelledBy?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // showModal() moves focus to the first control (the close button): give it to the intended field instead.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      {children}
    </dialog>
  );
}
