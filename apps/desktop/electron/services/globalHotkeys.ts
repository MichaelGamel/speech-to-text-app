import { globalShortcut, BrowserWindow } from "electron";
import { showOverlay, hideOverlay, updateOverlayState } from "../overlayWindow";

export class GlobalHotkeyService {
  private mainWindow: BrowserWindow;
  private currentHotkey: string | null = null;
  private isRecording = false;
  private recordingStartTime: number | null = null;
  private durationInterval: NodeJS.Timeout | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Register a global hotkey
   * Returns true if registration was successful
   */
  register(accelerator: string): boolean {
    // Unregister existing hotkey first
    if (this.currentHotkey) {
      this.unregister();
    }

    // Validate accelerator format
    if (!this.isValidAccelerator(accelerator)) {
      console.error("Invalid accelerator format:", accelerator);
      return false;
    }

    try {
      const success = globalShortcut.register(accelerator, () => {
        this.toggleRecording();
      });

      if (success) {
        this.currentHotkey = accelerator;
        console.log("Global hotkey registered:", accelerator);
      } else {
        console.error("Failed to register global hotkey (conflict?):", accelerator);
      }

      return success;
    } catch (error) {
      console.error("Error registering global hotkey:", error);
      return false;
    }
  }

  /**
   * Unregister the current hotkey
   */
  unregister(): void {
    if (this.currentHotkey) {
      globalShortcut.unregister(this.currentHotkey);
      console.log("Global hotkey unregistered:", this.currentHotkey);
      this.currentHotkey = null;
    }
  }

  /**
   * Check if a hotkey is currently registered
   */
  isRegistered(): boolean {
    return this.currentHotkey !== null;
  }

  /**
   * Get the current registered hotkey
   */
  getCurrentHotkey(): string | null {
    return this.currentHotkey;
  }

  /**
   * Toggle recording on/off
   * This is called when the user presses the global hotkey
   */
  private toggleRecording(): void {
    this.isRecording = !this.isRecording;

    if (this.isRecording) {
      this.startRecording();
    } else {
      this.stopRecording();
    }
  }

  /**
   * Start recording
   */
  private startRecording(): void {
    console.log("Global recording started via hotkey");

    // Track recording start time
    this.recordingStartTime = Date.now();

    // Show overlay
    showOverlay();

    // Update overlay state
    updateOverlayState({
      isRecording: true,
      transcriptPreview: undefined,
      duration: 0,
    });

    // Start duration counter
    this.startDurationCounter();

    // Notify main window to start audio capture
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("global-recording-started");
    }
  }

  /**
   * Stop recording
   */
  private stopRecording(): void {
    console.log("Global recording stopped via hotkey");

    // Stop duration counter
    this.stopDurationCounter();

    // Hide overlay
    hideOverlay();

    // Notify main window to stop and process
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("global-recording-stopped");
    }

    // Reset state
    this.recordingStartTime = null;
  }

  /**
   * Start the duration counter that updates the overlay every second
   */
  private startDurationCounter(): void {
    // Update immediately
    this.updateDuration();

    // Then update every second
    this.durationInterval = setInterval(() => {
      this.updateDuration();
    }, 1000);
  }

  /**
   * Stop the duration counter
   */
  private stopDurationCounter(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Update the duration in the overlay
   */
  private updateDuration(): void {
    if (!this.recordingStartTime) return;

    const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
    updateOverlayState({
      isRecording: true,
      duration: elapsed,
    });
  }

  /**
   * Update the transcript preview in the overlay
   * Called from main.ts when streaming transcription produces interim results
   */
  updateTranscriptPreview(text: string): void {
    if (!this.isRecording) return;

    updateOverlayState({
      isRecording: true,
      transcriptPreview: text,
      duration: this.recordingStartTime
        ? Math.floor((Date.now() - this.recordingStartTime) / 1000)
        : undefined,
    });
  }

  /**
   * Force stop recording (e.g., on app quit or error)
   */
  forceStop(): void {
    if (this.isRecording) {
      this.isRecording = false;
      this.stopDurationCounter();
      hideOverlay();
      this.recordingStartTime = null;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * Validate accelerator format
   * Ensures it has at least one modifier key to avoid conflicts
   */
  private isValidAccelerator(accelerator: string): boolean {
    if (!accelerator || accelerator.trim().length === 0) {
      return false;
    }

    // Must contain at least one modifier
    const hasModifier =
      accelerator.includes("Command") ||
      accelerator.includes("Control") ||
      accelerator.includes("Alt") ||
      accelerator.includes("Shift") ||
      accelerator.includes("Super") ||
      accelerator.includes("CommandOrControl");

    return hasModifier;
  }

  /**
   * Cleanup - unregister hotkey and stop any active recording
   */
  cleanup(): void {
    this.forceStop();
    this.unregister();
  }
}

// Singleton instance
let hotkeyServiceInstance: GlobalHotkeyService | null = null;

export function getGlobalHotkeyService(mainWindow?: BrowserWindow): GlobalHotkeyService {
  if (!hotkeyServiceInstance && mainWindow) {
    hotkeyServiceInstance = new GlobalHotkeyService(mainWindow);
  }
  if (!hotkeyServiceInstance) {
    throw new Error("GlobalHotkeyService not initialized. Pass mainWindow on first call.");
  }
  return hotkeyServiceInstance;
}

export function destroyGlobalHotkeyService(): void {
  if (hotkeyServiceInstance) {
    hotkeyServiceInstance.cleanup();
    hotkeyServiceInstance = null;
  }
}
