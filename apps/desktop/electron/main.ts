import { app, BrowserWindow, ipcMain, dialog, session, systemPreferences } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { transcribeAudio, initializeWhisper, TranscriptionProgress } from "./services/whisper";
import { getSettingsStore, GlobalSettings } from "./services/settingsStore";
import { getPermissionManager } from "./services/permissionManager";
import {
  createOverlayWindow,
  destroyOverlay,
  getOverlayWindow,
  positionOverlay,
} from "./overlayWindow";
import {
  getGlobalHotkeyService,
  destroyGlobalHotkeyService,
} from "./services/globalHotkeys";
import { getTextInjectionService } from "./services/textInjection";
import { StreamingSTTService } from "./services/streamingSTT";

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

// Platform detection
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const isLinux = process.platform === "linux";

// Request microphone permission on macOS
async function requestMicrophonePermission(): Promise<boolean> {
  if (isMac) {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    console.log("Current microphone permission status:", status);

    if (status === "not-determined") {
      // Request permission
      const granted = await systemPreferences.askForMediaAccess("microphone");
      console.log("Microphone permission granted:", granted);
      return granted;
    } else if (status === "granted") {
      return true;
    } else {
      // 'denied' or 'restricted'
      console.log("Microphone permission denied or restricted. Please enable in System Preferences > Security & Privacy > Privacy > Microphone");
      return false;
    }
  }
  // On Windows/Linux, permissions are handled differently
  return true;
}

// Global reference to main window
let mainWindow: BrowserWindow | null = null;

// Global reference to overlay window
let overlayWindow: BrowserWindow | null = null;

// Global reference to streaming service
let streamingService: StreamingSTTService | null = null;

// Recording state
let isRecording = false;
let recordingStartTime: number | null = null;

// Window state management
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const getWindowStatePath = () => {
  return path.join(app.getPath("userData"), "window-state.json");
};

const loadWindowState = async (): Promise<WindowState> => {
  try {
    const statePath = getWindowStatePath();
    if (existsSync(statePath)) {
      const data = await fs.readFile(statePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load window state:", error);
  }

  // Return default state
  return {
    width: 1200,
    height: 800,
    isMaximized: false,
  };
};

const saveWindowState = async (window: BrowserWindow) => {
  try {
    const bounds = window.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized(),
    };

    const statePath = getWindowStatePath();
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save window state:", error);
  }
};

async function createWindow() {
  // Load saved window state
  const windowState = await loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // macOS-specific: Custom traffic light positioning
    ...(isMac && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    }),
    // Windows-specific: Custom frame (optional - commented out for now)
    // ...(isWindows && {
    //   frame: false,
    // }),
  });

  // Restore maximized state
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Save window state on various events
  const saveState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      saveWindowState(mainWindow);
    }
  };

  mainWindow.on("close", saveState);
  mainWindow.on("resize", saveState);
  mainWindow.on("move", saveState);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ========================================
// IPC Handlers
// ========================================

// Recording operations
ipcMain.handle("start-recording", async () => {
  try {
    if (isRecording) {
      return { success: false, error: "Recording already in progress" };
    }

    isRecording = true;
    recordingStartTime = Date.now();

    // TODO: Implement actual audio recording
    // For now, just simulate the recording state
    console.log("Recording started");

    return { success: true };
  } catch (error) {
    isRecording = false;
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("stop-recording", async () => {
  try {
    if (!isRecording) {
      return { success: false, error: "No recording in progress" };
    }

    isRecording = false;
    const duration = recordingStartTime ? Date.now() - recordingStartTime : 0;
    recordingStartTime = null;

    // TODO: Implement actual audio recording stop and save
    // For now, create a dummy WAV file for testing
    const audioPath = path.join(app.getPath("temp"), `recording-${Date.now()}.wav`);

    // Create a minimal valid WAV file header (44 bytes) with silence
    // This is just for testing - replace with actual audio recording later
    const wavHeader = Buffer.alloc(44);
    // RIFF header
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36, 4); // Chunk size
    wavHeader.write('WAVE', 8);
    // fmt subchunk
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // Subchunk1 size
    wavHeader.writeUInt16LE(1, 20); // Audio format (PCM)
    wavHeader.writeUInt16LE(1, 22); // Number of channels (mono)
    wavHeader.writeUInt32LE(44100, 24); // Sample rate
    wavHeader.writeUInt32LE(88200, 28); // Byte rate
    wavHeader.writeUInt16LE(2, 32); // Block align
    wavHeader.writeUInt16LE(16, 34); // Bits per sample
    // data subchunk
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(0, 40); // Subchunk2 size (0 for empty audio)

    await fs.writeFile(audioPath, wavHeader);
    console.log("Recording stopped. Duration:", duration, "ms");

    return { success: true, audioPath };
  } catch (error) {
    isRecording = false;
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("transcribe-file", async (_event, filePath: string) => {
  try {
    // Validate input
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("Invalid file path");
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    // TODO: Implement file-based transcription using Whisper
    // For now, return an error suggesting to use the audio buffer method
    return { success: false, error: "File transcription not yet implemented. Please use the recording feature." };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Transcribe audio buffer using Whisper
ipcMain.handle("transcribe-audio", async (_event, audioBuffer: ArrayBuffer) => {
  try {
    // Validate input
    if (!(audioBuffer instanceof ArrayBuffer) || audioBuffer.byteLength === 0) {
      throw new Error("Invalid audio buffer");
    }

    console.log("Received audio buffer for transcription:", audioBuffer.byteLength, "bytes");

    // Convert ArrayBuffer to Float32Array
    const audioData = new Float32Array(audioBuffer);
    console.log("Audio data length:", audioData.length, "samples");

    // Progress callback to send updates to renderer
    const onProgress = (progress: TranscriptionProgress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("transcription-progress", progress);
      }
    };

    // Transcribe the audio
    const result = await transcribeAudio(audioData, onProgress);

    console.log("Transcription result:", result.text.substring(0, 100) + "...");

    return {
      success: true,
      text: result.text,
      duration: result.duration,
    };
  } catch (error) {
    console.error("Transcription error:", error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("transcription-progress", {
        status: "error",
        progress: 0,
        message: (error as Error).message,
      });
    }
    return { success: false, error: (error as Error).message };
  }
});

// Pre-load Whisper model
ipcMain.handle("preload-whisper", async () => {
  try {
    const onProgress = (progress: TranscriptionProgress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("transcription-progress", progress);
      }
    };

    await initializeWhisper(onProgress);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// File operations
ipcMain.handle("save-transcript", async (_event, text: string, fileName?: string) => {
  try {
    // Validate input
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("Invalid transcript text");
    }

    if (text.length > 10_000_000) {
      throw new Error("Transcript too large (max 10MB)");
    }

    // Create transcripts directory if it doesn't exist
    const transcriptsDir = path.join(app.getPath("documents"), "Transcripts");
    await fs.mkdir(transcriptsDir, { recursive: true });

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const finalFileName = fileName || `transcript-${timestamp}.txt`;
    const filePath = path.join(transcriptsDir, finalFileName);

    // Save file
    await fs.writeFile(filePath, text, "utf-8");

    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("load-transcript", async (_event, filePath: string) => {
  try {
    // Validate input
    if (typeof filePath !== "string" || filePath.length === 0) {
      throw new Error("Invalid file path");
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error("File does not exist");
    }

    // Read file
    const text = await fs.readFile(filePath, "utf-8");

    return { success: true, text };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("select-audio-file", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Audio Files", extensions: ["mp3", "wav", "m4a", "ogg", "flac", "aac"] },
        { name: "All Files", extensions: ["*"] },
      ],
      title: "Select Audio File",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }

    return { filePath: result.filePaths[0], cancelled: false };
  } catch (error) {
    return { cancelled: true };
  }
});

ipcMain.handle("select-output-directory", async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Output Directory",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { cancelled: true };
    }

    return { dirPath: result.filePaths[0], cancelled: false };
  } catch (error) {
    return { cancelled: true };
  }
});

// Settings operations
ipcMain.handle("load-settings", async () => {
  try {
    // TODO: Implement proper settings storage (e.g., using electron-store)
    // For now, return default settings
    return {
      theme: "system",
      language: "en",
      autoSave: true,
      outputDirectory: path.join(app.getPath("documents"), "Transcripts"),
    };
  } catch (error) {
    // Return defaults on error
    return {
      theme: "system",
      language: "en",
      autoSave: true,
      outputDirectory: path.join(app.getPath("documents"), "Transcripts"),
    };
  }
});

ipcMain.handle("save-settings", async (_event, settings: unknown) => {
  try {
    // Validate settings object
    if (typeof settings !== "object" || settings === null) {
      throw new Error("Invalid settings object");
    }

    // TODO: Implement proper settings storage
    console.log("Settings saved:", settings);

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

// Audio device operations
ipcMain.handle("get-audio-devices", async () => {
  try {
    // TODO: Implement actual audio device enumeration
    // For now, return mock devices
    return [
      { id: "default", label: "Default Microphone", kind: "audioinput" },
      { id: "device-1", label: "Built-in Microphone", kind: "audioinput" },
    ];
  } catch (error) {
    return [];
  }
});

// Microphone permission operations
ipcMain.handle("check-microphone-permission", async () => {
  if (isMac) {
    const status = systemPreferences.getMediaAccessStatus("microphone");
    return { status, platform: "darwin" };
  }
  return { status: "granted", platform: process.platform };
});

ipcMain.handle("request-microphone-permission", async () => {
  const granted = await requestMicrophonePermission();
  return { granted };
});

// ========================================
// Global Settings (Phase 1)
// ========================================

ipcMain.handle("get-global-settings", async () => {
  try {
    const settingsStore = getSettingsStore();
    return settingsStore.getAll();
  } catch (error) {
    console.error("Failed to get global settings:", error);
    // Return defaults on error
    return {
      hotkey: "CommandOrControl+Shift+Space",
      sttProvider: "whisper",
      preserveClipboard: true,
      showOverlay: true,
      overlayPosition: "top-right",
      hasApiKey: false,
    };
  }
});

ipcMain.handle("save-global-settings", async (_event, settings: Partial<GlobalSettings>) => {
  try {
    if (typeof settings !== "object" || settings === null) {
      throw new Error("Invalid settings object");
    }

    const settingsStore = getSettingsStore();
    settingsStore.update(settings);

    return { success: true };
  } catch (error) {
    console.error("Failed to save global settings:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("save-api-key", async (_event, apiKey: string) => {
  try {
    if (typeof apiKey !== "string") {
      throw new Error("Invalid API key");
    }

    const settingsStore = getSettingsStore();
    const success = settingsStore.setApiKey(apiKey);

    return { success };
  } catch (error) {
    console.error("Failed to save API key:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("has-api-key", async () => {
  try {
    const settingsStore = getSettingsStore();
    return settingsStore.hasApiKey();
  } catch (error) {
    return false;
  }
});

ipcMain.handle("clear-api-key", async () => {
  try {
    const settingsStore = getSettingsStore();
    settingsStore.clearApiKey();
    return { success: true };
  } catch (error) {
    console.error("Failed to clear API key:", error);
    return { success: false };
  }
});

// ========================================
// Permissions (Phase 1)
// ========================================

ipcMain.handle("get-all-permissions", async () => {
  try {
    const permissionManager = getPermissionManager();
    return permissionManager.getAllPermissions();
  } catch (error) {
    console.error("Failed to get permissions:", error);
    return {
      microphone: "not-determined",
      accessibility: "not-determined",
    };
  }
});

ipcMain.handle("check-accessibility-permission", async () => {
  try {
    const permissionManager = getPermissionManager();
    const status = permissionManager.checkAccessibilityPermission();
    return { status };
  } catch (error) {
    console.error("Failed to check accessibility permission:", error);
    return { status: "not-determined" };
  }
});

ipcMain.handle("request-accessibility-permission", async () => {
  try {
    const permissionManager = getPermissionManager();
    const granted = permissionManager.requestAccessibilityPermission();
    return { granted };
  } catch (error) {
    console.error("Failed to request accessibility permission:", error);
    return { granted: false };
  }
});

ipcMain.handle("open-accessibility-preferences", async () => {
  try {
    const permissionManager = getPermissionManager();
    await permissionManager.openAccessibilityPreferences();
  } catch (error) {
    console.error("Failed to open accessibility preferences:", error);
  }
});

ipcMain.handle("open-microphone-preferences", async () => {
  try {
    const permissionManager = getPermissionManager();
    await permissionManager.openMicrophonePreferences();
  } catch (error) {
    console.error("Failed to open microphone preferences:", error);
  }
});

// ========================================
// Global Hotkeys (Phase 3)
// ========================================

ipcMain.handle("register-global-hotkey", async (_event, accelerator: string) => {
  try {
    if (typeof accelerator !== "string" || accelerator.trim().length === 0) {
      throw new Error("Invalid accelerator");
    }

    if (!mainWindow) {
      throw new Error("Main window not available");
    }

    const hotkeyService = getGlobalHotkeyService(mainWindow);
    const success = hotkeyService.register(accelerator);

    if (success) {
      // Save to settings
      const settingsStore = getSettingsStore();
      settingsStore.set("hotkey", accelerator);
    }

    return { success };
  } catch (error) {
    console.error("Failed to register global hotkey:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("unregister-global-hotkey", async () => {
  try {
    const hotkeyService = getGlobalHotkeyService();
    hotkeyService.unregister();
    return { success: true };
  } catch (error) {
    console.error("Failed to unregister global hotkey:", error);
    return { success: false };
  }
});

ipcMain.handle("get-current-hotkey", async () => {
  try {
    const hotkeyService = getGlobalHotkeyService();
    return hotkeyService.getCurrentHotkey();
  } catch (error) {
    return null;
  }
});

ipcMain.handle("is-hotkey-registered", async () => {
  try {
    const hotkeyService = getGlobalHotkeyService();
    return hotkeyService.isRegistered();
  } catch (error) {
    return false;
  }
});

// ========================================
// Text Injection (Phase 4)
// ========================================

ipcMain.handle("inject-text", async (_event, text: string, preserveClipboard = true) => {
  try {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text");
    }

    const textInjectionService = getTextInjectionService();

    // Check if text injection is available on this platform
    if (!textInjectionService.isAvailable()) {
      // Fallback: just copy to clipboard
      await textInjectionService.copyToClipboard(text);
      return {
        success: true,
        error: textInjectionService.getUnsupportedMessage(),
      };
    }

    // Inject the text
    await textInjectionService.injectText(text, preserveClipboard);

    return { success: true };
  } catch (error) {
    console.error("Failed to inject text:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("copy-to-clipboard", async (_event, text: string) => {
  try {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text");
    }

    const textInjectionService = getTextInjectionService();
    await textInjectionService.copyToClipboard(text);

    return { success: true };
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("is-text-injection-available", async () => {
  try {
    const textInjectionService = getTextInjectionService();
    return textInjectionService.isAvailable();
  } catch (error) {
    return false;
  }
});

// ========================================
// Streaming Transcription (Phase 5)
// ========================================

ipcMain.handle("start-streaming-transcription", async (_event, apiKey?: string) => {
  try {
    if (!mainWindow) {
      throw new Error("Main window not available");
    }

    // Create streaming service if not exists
    if (!streamingService) {
      streamingService = new StreamingSTTService(mainWindow);
    }

    // Get API key from settings if not provided
    let finalApiKey = apiKey;
    if (!finalApiKey) {
      const settingsStore = getSettingsStore();
      finalApiKey = settingsStore.getApiKey() || undefined;
    }

    // Start streaming
    const result = await streamingService.start(finalApiKey);

    return result;
  } catch (error) {
    console.error("Failed to start streaming transcription:", error);
    return { success: false, mode: "whisper" as const, error: (error as Error).message };
  }
});

ipcMain.handle("stop-streaming-transcription", async () => {
  try {
    if (!streamingService) {
      return { transcript: "" };
    }

    const transcript = await streamingService.stop();
    return { transcript };
  } catch (error) {
    console.error("Failed to stop streaming transcription:", error);
    return { transcript: "" };
  }
});

ipcMain.handle("send-audio-chunk", async (_event, audioData: ArrayBuffer) => {
  try {
    if (!streamingService) {
      throw new Error("Streaming service not started");
    }

    // Convert ArrayBuffer to Float32Array
    const float32Data = new Float32Array(audioData);
    streamingService.sendAudio(float32Data);
  } catch (error) {
    console.error("Failed to send audio chunk:", error);
  }
});

// ========================================
// Application Lifecycle
// ========================================

app.whenReady().then(async () => {
  // Request microphone permission on macOS
  const micPermission = await requestMicrophonePermission();
  if (!micPermission && isMac) {
    console.warn("Microphone permission not granted. Speech recognition may not work.");
  }

  // Request accessibility permission on macOS (required for global hotkeys and text injection)
  if (isMac) {
    const permissionManager = getPermissionManager();
    const accessibilityStatus = permissionManager.checkAccessibilityPermission();

    if (accessibilityStatus !== "granted") {
      // Request accessibility permission - this will show a system prompt
      const accessibilityGranted = permissionManager.requestAccessibilityPermission();
      if (!accessibilityGranted) {
        console.warn("Accessibility permission not granted. Global hotkeys and text injection may not work.");
      }
    }
  }

  // Configure session for Web Speech API
  const ses = session.defaultSession;

  // Set Content Security Policy at session level
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' https://www.google.com https://*.googleapis.com wss://*.google.com; " +
          "media-src 'self' blob: mediastream:"
        ]
      }
    });
  });

  // Handle permission requests for media devices
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'geolocation', 'notifications', 'midi', 'midiSysex', 'pointerLock', 'fullscreen'];

    if (allowedPermissions.includes(permission)) {
      callback(true); // Allow
    } else {
      callback(false); // Deny
    }
  });

  createWindow();

  // Create overlay window (Phase 2)
  overlayWindow = createOverlayWindow();

  // Position overlay based on settings
  const settingsStore = getSettingsStore();
  const settings = settingsStore.getAll();
  positionOverlay(settings.overlayPosition);

  // Initialize global hotkey service (Phase 3)
  if (mainWindow) {
    const hotkeyService = getGlobalHotkeyService(mainWindow);

    // Check accessibility permission before registering hotkey (required on macOS)
    const permissionManager = getPermissionManager();
    const accessibilityStatus = permissionManager.checkAccessibilityPermission();

    if (accessibilityStatus !== "granted") {
      console.warn(
        "Skipping global hotkey registration: accessibility permission not granted. " +
        "Please grant accessibility permission in System Preferences > Security & Privacy > Privacy > Accessibility"
      );
    } else {
      const success = hotkeyService.register(settings.hotkey);
      if (!success) {
        console.warn("Failed to register default hotkey:", settings.hotkey);
      }
    }

    // Initialize streaming service (Phase 6)
    streamingService = new StreamingSTTService(mainWindow);
  }

  // Handle overlay transcript updates from renderer (Phase 6)
  ipcMain.on("update-overlay-transcript", (_event, text: string) => {
    try {
      const hotkeyService = getGlobalHotkeyService();
      hotkeyService.updateTranscriptPreview(text);
    } catch (error) {
      console.error("Failed to update overlay transcript:", error);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
    // Recreate overlay if it was destroyed
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      overlayWindow = createOverlayWindow();
      positionOverlay(settings.overlayPosition);
    }
  });
});

// macOS: Keep app running when all windows closed (standard macOS behavior)
// Windows/Linux: Quit when all windows closed
app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});

// Graceful shutdown
let isQuitting = false;

app.on("before-quit", async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    // Cleanup tasks
    try {
      // Stop any active recording
      if (isRecording) {
        isRecording = false;
        recordingStartTime = null;
      }

      // Save window state one final time
      if (mainWindow && !mainWindow.isDestroyed()) {
        await saveWindowState(mainWindow);
      }

      // Destroy overlay window
      destroyOverlay();

      // Cleanup global hotkey service
      destroyGlobalHotkeyService();

      // TODO: Add other cleanup tasks here
      // - Close database connections
      // - Clean up temporary files
      // - Cancel pending operations
    } catch (error) {
      console.error("Error during cleanup:", error);
    }

    // Close all windows
    BrowserWindow.getAllWindows().forEach((window) => window.close());

    // Finally quit
    app.quit();
  }
});
