import { type ReactNode } from "react";

/**
 * Status types supported by the StatusIndicator component.
 * Each type has an associated color and icon for accessibility.
 */
export type StatusType =
  | "granted"
  | "success"
  | "denied"
  | "error"
  | "restricted"
  | "pending"
  | "not-determined"
  | "recording"
  | "processing"
  | "active";

/**
 * Size variants for the StatusIndicator component.
 * - sm: 8px indicator, small icons (for compact UI)
 * - md: 12px indicator, medium icons (default)
 * - lg: 16px indicator, larger icons (for prominent display)
 */
export type StatusSize = "sm" | "md" | "lg";

export interface StatusIndicatorProps {
  /** The status type to display */
  status: StatusType;
  /** Size variant of the indicator */
  size?: StatusSize;
  /** Whether to show a text label alongside the indicator */
  showLabel?: boolean;
  /** Custom label text (if not provided, uses default for status type) */
  label?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether to animate the indicator (for recording/active states) */
  animate?: boolean;
}

/**
 * Get the background color class for a given status type.
 * Colors are preserved for users who can see them, while icons
 * provide accessibility for color-blind users.
 */
const getStatusColor = (status: StatusType): string => {
  switch (status) {
    case "granted":
    case "success":
    case "active":
      return "bg-green-500";
    case "denied":
    case "error":
    case "restricted":
      return "bg-red-500";
    case "pending":
    case "not-determined":
      return "bg-yellow-500";
    case "recording":
      return "bg-recording";
    case "processing":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

/**
 * Get the default text label for a given status type.
 */
const getStatusLabel = (status: StatusType): string => {
  switch (status) {
    case "granted":
      return "Granted";
    case "success":
      return "Success";
    case "denied":
      return "Denied";
    case "error":
      return "Error";
    case "restricted":
      return "Restricted";
    case "pending":
      return "Pending";
    case "not-determined":
      return "Not Determined";
    case "recording":
      return "Recording";
    case "processing":
      return "Processing";
    case "active":
      return "Active";
    default:
      return "Unknown";
  }
};

/**
 * Get the ARIA label for screen readers based on status type.
 */
const getAriaLabel = (status: StatusType): string => {
  switch (status) {
    case "granted":
    case "success":
      return "Status: success";
    case "denied":
    case "error":
    case "restricted":
      return "Status: error";
    case "pending":
    case "not-determined":
      return "Status: pending";
    case "recording":
      return "Status: recording in progress";
    case "processing":
      return "Status: processing";
    case "active":
      return "Status: active";
    default:
      return "Status: unknown";
  }
};

/**
 * Size configurations for indicators and icons
 */
const sizeConfig = {
  sm: {
    dot: "w-2 h-2",
    icon: "w-3 h-3",
    text: "text-xs",
    gap: "gap-1.5",
    strokeWidth: 2.5,
  },
  md: {
    dot: "w-3 h-3",
    icon: "w-4 h-4",
    text: "text-sm",
    gap: "gap-2",
    strokeWidth: 2,
  },
  lg: {
    dot: "w-4 h-4",
    icon: "w-5 h-5",
    text: "text-base",
    gap: "gap-2.5",
    strokeWidth: 1.75,
  },
};

/**
 * Checkmark icon - used for granted/success states
 */
const CheckmarkIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * X/Cross icon - used for denied/error/restricted states
 */
const CrossIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Clock icon - used for pending/not-determined states
 */
const ClockIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Microphone icon - used for recording state
 */
const MicrophoneIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

/**
 * Spinner icon - used for processing state
 * Animated rotation for visual feedback
 */
const SpinnerIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} animate-spin ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/**
 * Radio/Pulse icon - used for active state
 * Shows concentric circles to indicate active/live status
 */
const PulseIcon = ({ size, className }: { size: StatusSize; className?: string }) => (
  <svg
    className={`${sizeConfig[size].icon} ${className || ""}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sizeConfig[size].strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <circle cx="12" cy="12" r="7" opacity="0.6" />
    <circle cx="12" cy="12" r="11" opacity="0.3" />
  </svg>
);

/**
 * Get the appropriate icon component for a given status type.
 */
const getStatusIcon = (status: StatusType, size: StatusSize, className?: string): ReactNode => {
  switch (status) {
    case "granted":
    case "success":
      return <CheckmarkIcon size={size} className={`text-green-400 ${className || ""}`} />;
    case "denied":
    case "error":
    case "restricted":
      return <CrossIcon size={size} className={`text-red-400 ${className || ""}`} />;
    case "pending":
    case "not-determined":
      return <ClockIcon size={size} className={`text-yellow-400 ${className || ""}`} />;
    case "recording":
      return <MicrophoneIcon size={size} className={`text-red-400 ${className || ""}`} />;
    case "processing":
      return <SpinnerIcon size={size} className={`text-blue-400 ${className || ""}`} />;
    case "active":
      return <PulseIcon size={size} className={`text-green-400 ${className || ""}`} />;
    default:
      return null;
  }
};

/**
 * StatusIndicator Component
 *
 * A reusable component that displays both a colored indicator dot and an
 * appropriate icon for accessibility. This ensures that status information
 * is conveyed through multiple visual cues (color + shape), making the
 * interface usable for users with color vision deficiency.
 *
 * Complies with WCAG 2.1 guideline 1.4.1 (Use of Color) by supplementing
 * color-only indicators with distinctive icons.
 *
 * @example
 * // Basic usage
 * <StatusIndicator status="granted" />
 *
 * @example
 * // With label
 * <StatusIndicator status="recording" showLabel />
 *
 * @example
 * // Custom size and label
 * <StatusIndicator status="processing" size="lg" showLabel label="Transcribing audio..." />
 */
export const StatusIndicator = ({
  status,
  size = "md",
  showLabel = false,
  label,
  className = "",
  animate,
}: StatusIndicatorProps) => {
  const config = sizeConfig[size];
  const colorClass = getStatusColor(status);
  const displayLabel = label || getStatusLabel(status);
  const ariaLabel = getAriaLabel(status);

  // Determine if animation should be applied
  const shouldAnimate = animate !== undefined ? animate : status === "recording" || status === "active";
  const animationClass = shouldAnimate ? "animate-pulse" : "";

  return (
    <div
      className={`inline-flex items-center ${config.gap} ${className}`}
      role="status"
      aria-label={ariaLabel}
    >
      {/* Color indicator dot */}
      <div className="relative flex items-center justify-center">
        <div
          className={`${config.dot} ${colorClass} rounded-full ${animationClass}`}
          aria-hidden="true"
        />
        {/* Glow effect for recording/active states */}
        {shouldAnimate && (
          <div
            className={`absolute inset-0 ${config.dot} ${colorClass} rounded-full animate-ping opacity-30`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Icon */}
      {getStatusIcon(status, size)}

      {/* Optional text label */}
      {showLabel && (
        <span className={`${config.text} text-gray-300`}>{displayLabel}</span>
      )}
    </div>
  );
};

export default StatusIndicator;
