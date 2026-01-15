import { clipboard } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const isMac = process.platform === "darwin";

/**
 * Delay helper function
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export class TextInjectionService {
  /**
   * Inject text into the currently focused input field
   * Uses clipboard + AppleScript Cmd+V simulation on macOS
   *
   * @param text - The text to inject
   * @param preserveClipboard - Whether to restore the original clipboard content after injection
   */
  async injectText(text: string, preserveClipboard = true): Promise<void> {
    if (!isMac) {
      throw new Error("Text injection is currently only supported on macOS");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot inject empty text");
    }

    let originalClipboard: string | null = null;

    try {
      // Step 1: Store original clipboard content if preserving
      if (preserveClipboard) {
        try {
          originalClipboard = clipboard.readText();
        } catch (error) {
          console.warn("Failed to read clipboard:", error);
          // Continue anyway, just won't preserve
        }
      }

      // Step 2: Write text to clipboard
      clipboard.writeText(text);
      console.log("Text written to clipboard");

      // Small delay to ensure clipboard is updated
      await delay(50);

      // Step 3: Simulate Cmd+V via AppleScript
      // Using execFile for security (prevents shell injection)
      await execFileAsync("osascript", [
        "-e",
        'tell application "System Events" to keystroke "v" using command down',
      ]);
      console.log("Paste command executed");

      // Delay to ensure paste completes
      await delay(150);

    } finally {
      // Step 4: Restore original clipboard if requested
      if (preserveClipboard && originalClipboard !== null) {
        // Wait a bit longer to ensure paste has completed
        await delay(250);

        try {
          clipboard.writeText(originalClipboard);
          console.log("Original clipboard restored");
        } catch (error) {
          console.error("Failed to restore clipboard:", error);
          // Non-fatal error, text was still injected
        }
      }
    }
  }

  /**
   * Copy text to clipboard without pasting
   * Useful as a fallback when no input field is focused
   */
  async copyToClipboard(text: string): Promise<void> {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot copy empty text");
    }

    clipboard.writeText(text);
    console.log("Text copied to clipboard");
  }

  /**
   * Check if text injection is available on this platform
   */
  isAvailable(): boolean {
    return isMac;
  }

  /**
   * Get a user-friendly error message for unsupported platforms
   */
  getUnsupportedMessage(): string {
    if (!isMac) {
      return "Text injection is currently only supported on macOS. The transcription will be copied to your clipboard instead.";
    }
    return "";
  }
}

// Singleton instance
let textInjectionServiceInstance: TextInjectionService | null = null;

export function getTextInjectionService(): TextInjectionService {
  if (!textInjectionServiceInstance) {
    textInjectionServiceInstance = new TextInjectionService();
  }
  return textInjectionServiceInstance;
}
