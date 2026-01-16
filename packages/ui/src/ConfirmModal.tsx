import { Modal } from "./Modal";

type ConfirmVariant = "default" | "danger";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Visual variant - 'danger' shows red confirm button for destructive actions */
  variant?: ConfirmVariant;
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: JSX.Element;
    iconBgClass: string;
    iconTextClass: string;
    confirmButtonClass: string;
  }
> = {
  default: {
    iconBgClass: "bg-blue-500/20",
    iconTextClass: "text-blue-400",
    confirmButtonClass:
      "bg-primary text-white hover:bg-primary-hover focus:ring-primary",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
  danger: {
    iconBgClass: "bg-red-500/20",
    iconTextClass: "text-red-400",
    confirmButtonClass:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  variant = "default",
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
}: ConfirmModalProps) {
  const config = variantConfig[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className="p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${config.iconBgClass} ${config.iconTextClass}`}
          >
            {config.icon}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-white text-center mb-2">
          {title}
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-center mb-6">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3">
          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-dark-800 text-gray-300 rounded-lg font-medium hover:bg-dark-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-dark-900"
          >
            {cancelLabel}
          </button>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900 ${config.confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
