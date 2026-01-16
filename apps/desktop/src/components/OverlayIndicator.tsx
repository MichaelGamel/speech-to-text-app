import { useState, useEffect } from "react";
import { StatusIndicator } from "./StatusIndicator";

export interface OverlayState {
  isRecording: boolean;
  transcriptPreview?: string;
  duration?: number;
}

export const OverlayIndicator = () => {
  const [state, setState] = useState<OverlayState>({ isRecording: false });

  useEffect(() => {
    // Listen for overlay state updates from main process
    const unsubscribe = window.electronAPI.onOverlayStateChange((newState: OverlayState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Don't render anything if not recording
  if (!state.isRecording) {
    return null;
  }

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-dark-900/95 rounded-full backdrop-blur-sm border border-dark-700 shadow-2xl">
      {/* Recording indicator with icon for color-blind accessibility */}
      <StatusIndicator status="recording" size="md" animate />

      {/* Status text */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm text-white font-medium truncate">
          {state.transcriptPreview
            ? state.transcriptPreview.slice(-40) + (state.transcriptPreview.length > 40 ? "..." : "")
            : "Listening..."}
        </span>

        {/* Duration */}
        {state.duration !== undefined && (
          <span className="text-xs text-gray-400">{formatDuration(state.duration)}</span>
        )}
      </div>
    </div>
  );
};
