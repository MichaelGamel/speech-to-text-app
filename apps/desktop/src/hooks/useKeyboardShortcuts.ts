import { useEffect, useCallback, useRef } from "react";

/**
 * Represents a keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** The key to listen for (e.g., "Space", "Enter", "A") */
  key: string;
  /** Handler function called when the shortcut is triggered */
  handler: () => void;
  /** Optional: require modifier keys (default: false) */
  requireModifier?: boolean;
  /** Optional: prevent default browser behavior (default: true) */
  preventDefault?: boolean;
}

/**
 * Options for the useKeyboardShortcuts hook
 */
export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled (default: true) */
  enabled?: boolean;
}

/**
 * Maps raw keyboard event keys to normalized key names
 * Following the pattern from HotkeyConfig.tsx
 */
const normalizeKey = (key: string): string => {
  if (key === " ") return "Space";
  if (key === "ArrowUp") return "Up";
  if (key === "ArrowDown") return "Down";
  if (key === "ArrowLeft") return "Left";
  if (key === "ArrowRight") return "Right";
  // For regular keys, uppercase single characters
  if (key.length === 1) return key.toUpperCase();
  return key;
};

/**
 * Checks if the currently focused element is an input field
 * where typing should not trigger shortcuts
 */
const isInputFocused = (): boolean => {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();

  // Check common input elements
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  // Check for contenteditable elements
  if (activeElement.getAttribute("contenteditable") === "true") {
    return true;
  }

  return false;
};

/**
 * Checks if the main window has focus
 */
const isWindowFocused = (): boolean => {
  return document.hasFocus();
};

/**
 * Custom hook for managing keyboard shortcuts in the app.
 *
 * Features:
 * - Registers document-level keyboard event listeners
 * - Automatically ignores shortcuts when typing in input fields
 * - Only triggers when the window is focused
 * - Follows key mapping pattern from HotkeyConfig.tsx
 *
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: "Space", handler: toggleRecording },
 *   { key: "Enter", handler: handleTranscribe },
 * ]);
 * ```
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void => {
  const { enabled = true } = options;

  // Store shortcuts in a ref to avoid recreating the listener on every render
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if shortcuts are disabled
    if (!enabled) return;

    // Skip if window doesn't have focus
    if (!isWindowFocused()) return;

    // Skip if user is typing in an input field
    if (isInputFocused()) return;

    // Normalize the pressed key
    const pressedKey = normalizeKey(event.key);

    // Check for modifier keys
    const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;

    // Find matching shortcut
    const matchingShortcut = shortcutsRef.current.find((shortcut) => {
      // Check if key matches
      if (shortcut.key !== pressedKey) return false;

      // Check modifier requirement
      if (shortcut.requireModifier && !hasModifier) return false;

      return true;
    });

    if (matchingShortcut) {
      // Prevent default unless explicitly disabled
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault();
      }

      // Call the handler
      matchingShortcut.handler();
    }
  }, [enabled]);

  useEffect(() => {
    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
};
