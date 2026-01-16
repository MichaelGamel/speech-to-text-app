import { useEffect, useRef, useCallback } from 'react';
import type { TranscriptionEntry } from '../../types/electron';

interface TranscriptionDetailModalProps {
  entry: TranscriptionEntry;
  onCopy: (entry: TranscriptionEntry) => void;
  onClose: () => void;
}

/**
 * Format duration in seconds to a human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format ISO timestamp to a readable date string
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate word count from text
 */
function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const TranscriptionDetailModal = ({
  entry,
  onCopy,
  onClose,
}: TranscriptionDetailModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management - focus the close button when modal opens
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Handle overlay click (close when clicking outside modal)
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleCopy = () => {
    onCopy(entry);
  };

  const wordCount = getWordCount(entry.text);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="bg-dark-900 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl border border-dark-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h2 id="modal-title" className="text-lg font-semibold text-white">
            Transcription Details
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Metadata */}
        <div className="px-4 py-3 border-b border-dark-700 bg-dark-800/50">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Timestamp */}
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-gray-400">{formatTimestamp(entry.timestamp)}</span>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-gray-400">Duration: {formatDuration(entry.duration)}</span>
            </div>

            {/* Word count */}
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-gray-400">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>

            {/* Character count */}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs">
                {entry.characterCount} {entry.characterCount === 1 ? 'character' : 'characters'}
              </span>
            </div>

            {/* Source badge */}
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                entry.source === 'hotkey'
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-purple-900/30 text-purple-400'
              }`}
            >
              {entry.source === 'hotkey' ? 'Hotkey' : 'Recording'}
            </span>
          </div>
        </div>

        {/* Content - scrollable area */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-dark-900">
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {entry.text}
          </p>
        </div>

        {/* Footer with actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-dark-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
};
