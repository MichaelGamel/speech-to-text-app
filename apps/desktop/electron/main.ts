import { app, BrowserWindow, ipcMain, dialog, session, systemPreferences } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { transcribeAudio, initializeWhisper, TranscriptionProgress } from "./services/whisper";
import { getSettingsStore, GlobalSettings } from "./services/settingsStore";
import { getHistoryStore, TranscriptionEntry } from "./services/historyStore";
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
      maxRecordingDuration: 300,
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

// ========================================
// Transcription History (Phase 2)
// ========================================

ipcMain.handle("get-history", async () => {
  try {
    const historyStore = getHistoryStore();
    return historyStore.getAll();
  } catch (error) {
    console.error("Failed to get history:", error);
    return [];
  }
});

ipcMain.handle("add-history-entry", async (_event, entry: Omit<TranscriptionEntry, "id" | "timestamp">) => {
  try {
    if (!entry.text || typeof entry.text !== "string") {
      throw new Error("Invalid entry text");
    }

    const historyStore = getHistoryStore();
    const newEntry: TranscriptionEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      text: entry.text,
      duration: entry.duration || 0,
      model: entry.model || "whisper",
    };

    historyStore.add(newEntry);
    return { success: true, entry: newEntry };
  } catch (error) {
    console.error("Failed to add history entry:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("delete-history-entry", async (_event, id: string) => {
  try {
    if (!id || typeof id !== "string") {
      throw new Error("Invalid entry ID");
    }

    const historyStore = getHistoryStore();
    historyStore.delete(id);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete history entry:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("clear-history", async () => {
  try {
    const historyStore = getHistoryStore();
    historyStore.clear();
    return { success: true };
  } catch (error) {
    console.error("Failed to clear history:", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// App Lifecycle
// ========================================

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  // On macOS, applications stay active until the user quits explicitly
  if (!isMac) {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS, re-create a window in the app when the dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});