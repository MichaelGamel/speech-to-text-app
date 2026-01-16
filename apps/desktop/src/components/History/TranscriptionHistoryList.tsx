import { useState, useEffect, useCallback, useRef } from 'react';
import type { TranscriptionEntry } from '../../types/electron';
import { TranscriptionHistoryItem } from './TranscriptionHistoryItem';

interface TranscriptionHistoryListProps {
  onCopy: (entry: TranscriptionEntry) => void;
  onViewFull: (entry: TranscriptionEntry) => void;
}

// Virtualization constants
const ITEM_HEIGHT = 140; // Approximate height of each history item in pixels
const VIRTUALIZATION_THRESHOLD = 50;
const OVERSCAN_COUNT = 5; // Number of items to render outside visible area

export const TranscriptionHistoryList = ({
  onCopy,
  onViewFull,
}: TranscriptionHistoryListProps) => {
  const [history, setHistory] = useState<TranscriptionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Virtualization state
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Track container height for virtualization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.getTranscriptionHistory();

      if (result.success && result.data) {
        // Sort by timestamp descending (most recent first)
        const sortedHistory = [...result.data].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setHistory(sortedHistory);
      } else {
        setError(result.error || 'Failed to load history');
      }
    } catch (err) {
      setError('Failed to load transcription history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = useCallback(async (entry: TranscriptionEntry) => {
    try {
      const result = await window.electronAPI.deleteTranscriptionHistory(entry.id);

      if (result.success) {
        setHistory((prev) => prev.filter((item) => item.id !== entry.id));
      } else {
        setError(result.error || 'Failed to delete entry');
      }
    } catch (err) {
      setError('Failed to delete transcription');
    }
  }, []);

  const handleClearAll = async () => {
    setIsClearing(true);
    setError(null);

    try {
      const result = await window.electronAPI.clearTranscriptionHistory();

      if (result.success) {
        setHistory([]);
        setShowClearConfirm(false);
      } else {
        setError(result.error || 'Failed to clear history');
      }
    } catch (err) {
      setError('Failed to clear history');
    } finally {
      setIsClearing(false);
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate virtualized items
  const useVirtualization = history.length > VIRTUALIZATION_THRESHOLD;
  const totalHeight = history.length * ITEM_HEIGHT;

  let visibleItems: { entry: TranscriptionEntry; index: number }[];
  let offsetY = 0;

  if (useVirtualization) {
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN_COUNT);
    const endIndex = Math.min(
      history.length,
      Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN_COUNT
    );

    visibleItems = history.slice(startIndex, endIndex).map((entry, i) => ({
      entry,
      index: startIndex + i,
    }));
    offsetY = startIndex * ITEM_HEIGHT;
  } else {
    visibleItems = history.map((entry, index) => ({ entry, index }));
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-dark-900 rounded-xl p-6">
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin h-8 w-8 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-gray-400">Loading history...</span>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div className="bg-dark-900 rounded-xl p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold mb-2 text-gray-300">No transcriptions yet</h3>
          <p className="text-sm text-gray-500 text-center max-w-sm">
            Your transcription history will appear here. Record something or use the global hotkey
            to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-900 rounded-xl p-6">
      {/* Header with Clear All */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm text-gray-400">
            {history.length} {history.length === 1 ? 'transcription' : 'transcriptions'}
          </span>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="mb-4 p-4 bg-dark-800 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">Clear all history?</h4>
              <p className="text-sm text-gray-400 mb-3">
                This will permanently delete all {history.length} transcriptions. This action
                cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearing ? 'Clearing...' : 'Yes, Clear All'}
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={isClearing}
                  className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-dark-900"
        style={useVirtualization ? { position: 'relative' } : undefined}
      >
        {useVirtualization ? (
          // Virtualized list
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: offsetY,
                left: 0,
                right: 0,
              }}
            >
              <div className="space-y-3">
                {visibleItems.map(({ entry }) => (
                  <TranscriptionHistoryItem
                    key={entry.id}
                    entry={entry}
                    onCopy={onCopy}
                    onViewFull={onViewFull}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Regular list
          <div className="space-y-3">
            {history.map((entry) => (
              <TranscriptionHistoryItem
                key={entry.id}
                entry={entry}
                onCopy={onCopy}
                onViewFull={onViewFull}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {useVirtualization && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Showing virtualized list for better performance
        </div>
      )}
    </div>
  );
};
