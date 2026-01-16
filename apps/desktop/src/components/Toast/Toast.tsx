import { useEffect } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onDismiss: () => void;
  duration?: number;
}

/**
 * Simple toast notification component
 * Auto-dismisses after specified duration (default 2 seconds)
 */
export const Toast = ({
  message,
  isVisible,
  onDismiss,
  duration = 2000,
}: ToastProps) => {
  // Auto-dismiss after duration
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-toast-in"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg shadow-lg">
        {/* Checkmark icon */}
        <svg
          className="w-5 h-5 text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="text-sm font-medium text-white">{message}</span>
      </div>
    </div>
  );
};
