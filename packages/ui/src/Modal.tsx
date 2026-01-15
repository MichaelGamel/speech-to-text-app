import { ReactNode, useEffect, useCallback, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Whether clicking outside the modal closes it (default: true) */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** Optional className for the content panel */
  className?: string;
  /** Whether to show the close button (default: true) */
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = "",
  showCloseButton = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  // Handle click outside
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (
        closeOnOverlayClick &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose]
  );

  // Add/remove keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Focus trap - focus the modal when opened
  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content panel */}
      <div
        ref={contentRef}
        className={`relative bg-dark-900 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in outline-none ${className}`}
        tabIndex={-1}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
