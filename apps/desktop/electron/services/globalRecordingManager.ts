import { BrowserWindow, ipcMain } from "electron";
import { StreamingSTTService } from "./streamingSTT";
import { getGlobalHotkeyService } from "./globalHotkeys";
import { getTextInjectionService } from "./textInjection";
import { getSettingsStore } from "./settingsStore";

/**
 * Manages the complete global recording flow:
 * Hotkey press → Start streaming → Live transcription → Hotkey release → Text injection
 */
export class GlobalRecordingManager {
  private mainWindow: BrowserWindow;
  private streamingService: StreamingSTTService | null = null;
  private isActive = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupEventListeners();
  }

  /**
   * Setup IPC event listeners for the recording flow
   */
  private setupEventListeners(): void {
    // Listen for streaming transcript updates and forward to overlay
    ipcMain.on("update-overlay-transcript", (_event, text: string) => {
      try {
        const hotkeyService = getGlobalHotkeyService();
        hotkeyService.updateTranscriptPreview(text);
      } catch (error) {
        console.error("Failed to update overlay transcript:", error);
      }
    });

    // Listen for recording complete event (when renderer finishes)
    ipcMain.on("recording-complete", async (_event, finalTranscript: string) => {
      await this.handleRecordingComplete(finalTranscript);
    });
  }

  /**
   * Initialize the streaming service
   */
  async initializeStreamingService(): Promise<void> {
    if (!this.streamingService) {
      this.streamingService = new StreamingSTTService(this.mainWindow);
    }
  }

  /**
   * Start global recording
   * Called when the global hotkey is pressed
   */
  async startRecording(): Promise<void> {
    if (this.isActive) {
      console.warn("Recording already active");
      return;
    }

    try {
      this.isActive = true;

      // Initialize streaming service
      await this.initializeStreamingService();

      // Get API key from settings
      const settingsStore = getSettingsStore();
      const apiKey = settingsStore.getApiKey() || undefined;

      // Start streaming service
      if (this.streamingService) {
        await this.streamingService.start(apiKey);
      }

      console.log("Global recording started successfully");
    } catch (error) {
      console.error("Failed to start global recording:", error);
      this.isActive = false;
    }
  }

  /**
   * Stop global recording
   * Called when the global hotkey is pressed again
   */
  async stopRecording(): Promise<string> {
    if (!this.isActive) {
      return "";
    }

    try {
      let transcript = "";

      // Stop streaming service and get final transcript
      if (this.streamingService) {
        transcript = await this.streamingService.stop();
      }

      this.isActive = false;
      return transcript;
    } catch (error) {
      console.error("Failed to stop global recording:", error);
      this.isActive = false;
      return "";
    }
  }

  /**
   * Handle recording complete - inject text into focused field
   */
  private async handleRecordingComplete(finalTranscript: string): Promise<void> {
    if (!finalTranscript || finalTranscript.trim().length === 0) {
      console.log("No transcript to inject");
      return;
    }

    try {
      // Get settings for clipboard preservation
      const settingsStore = getSettingsStore();
      const preserveClipboard = settingsStore.get("preserveClipboard");

      // Inject text
      const textInjectionService = getTextInjectionService();
      await textInjectionService.injectText(finalTranscript, preserveClipboard);

      console.log("Text injected successfully:", finalTranscript.substring(0, 50) + "...");
    } catch (error) {
      console.error("Failed to inject text:", error);

      // Fallback: copy to clipboard
      try {
        const textInjectionService = getTextInjectionService();
        await textInjectionService.copyToClipboard(finalTranscript);
        console.log("Text copied to clipboard as fallback");
      } catch (copyError) {
        console.error("Failed to copy to clipboard:", copyError);
      }
    }
  }

  /**
   * Send audio chunk to streaming service
   */
  sendAudioChunk(audioData: Float32Array): void {
    if (this.streamingService && this.isActive) {
      this.streamingService.sendAudio(audioData);
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.isActive;
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    if (this.streamingService) {
      this.streamingService.stop();
    }
    this.isActive = false;
  }
}

// Singleton instance
let recordingManagerInstance: GlobalRecordingManager | null = null;

export function getGlobalRecordingManager(mainWindow?: BrowserWindow): GlobalRecordingManager {
  if (!recordingManagerInstance && mainWindow) {
    recordingManagerInstance = new GlobalRecordingManager(mainWindow);
  }
  if (!recordingManagerInstance) {
    throw new Error("GlobalRecordingManager not initialized");
  }
  return recordingManagerInstance;
}

export function destroyGlobalRecordingManager(): void {
  if (recordingManagerInstance) {
    recordingManagerInstance.cleanup();
    recordingManagerInstance = null;
  }
}
