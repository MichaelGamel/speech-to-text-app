import { useMemo } from 'react';
import type { TranscriptionEntry } from '../../types/electron';

interface TranscriptionHistoryItemProps {
  entry: TranscriptionEntry;
  onCopy: (entry: TranscriptionEntry) => void;
  onViewFull: (entry: TranscriptionEntry) => void;
  onDelete: (entry: TranscriptionEntry) => void;
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
 * Format ISO timestamp to relative time string (e.g., '2 minutes ago')
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }
  // For older entries, show the date
  return date.toLocaleDateString();
}

/**
 * Truncate text to a maximum length, adding ellipsis if necessary
 */
function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength).trim() + '...';
}

export const TranscriptionHistoryItem = ({
  entry,
  onCopy,
  onViewFull,
  onDelete,
}: TranscriptionHistoryItemProps) => {
  const truncatedText = useMemo(() => truncateText(entry.text), [entry.text]);
  const relativeTime = useMemo(() => formatRelativeTime(entry.timestamp), [entry.timestamp]);
  const formattedDuration = useMemo(() => formatDuration(entry.duration), [entry.duration]);

  const handleCopy = () => {
    onCopy(entry);
  };

  const handleViewFull = () => {
    onViewFull(entry);
  };

  const handleDelete = () => {
    onDelete(entry);
  };

  return (
    <div className="bg-dark-800 rounded-lg p-4 hover:bg-dark-700 transition-colors">
      {/* Header with metadata */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Relative timestamp */}
          <span className="text-sm text-gray-400">{relativeTime}</span>

          {/* Duration badge */}
          <span className="text-xs text-gray-500 px-2 py-0.5 bg-dark-900 rounded">
            {formattedDuration}
          </span>

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

      {/* Text preview */}
      <p className="text-sm text-gray-300 mb-3 leading-relaxed break-words">
        {truncatedText}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 bg-dark-900 hover:bg-dark-700 text-white text-xs rounded transition-colors flex items-center gap-1.5"
          title="Copy text to clipboard"
        >
          <svg
            className="w-3.5 h-3.5"
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
          Copy
        </button>

        <button
          onClick={handleViewFull}
          className="px-3 py-1.5 bg-dark-900 hover:bg-dark-700 text-white text-xs rounded transition-colors flex items-center gap-1.5"
          title="View full transcription"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          View
        </button>

        <button
          onClick={handleDelete}
          className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs rounded transition-colors flex items-center gap-1.5"
          title="Delete transcription"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
};
