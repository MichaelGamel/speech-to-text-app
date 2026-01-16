import { contextBridge, ipcRenderer } from "electron";

// CRITICAL: Only expose specific, type-safe methods
// Never expose generic send/on/invoke to prevent security vulnerabilities
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,

  // Transcription operations
  startRecording: () => ipcRenderer.invoke("start-recording"),
  stopRecording: () => ipcRenderer.invoke("stop-recording"),
  transcribeFile: (filePath: string) => ipcRenderer.invoke("transcribe-file", filePath),
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke("transcribe-audio", audioBuffer),
  preloadWhisper: () => ipcRenderer.invoke("preload-whisper"),

  // File operations
  saveTranscript: (text: string, fileName?: string) =>
    ipcRenderer.invoke("save-transcript", text, fileName),
  loadTranscript: (filePath: string) => ipcRenderer.invoke("load-transcript", filePath),
  selectAudioFile: () => ipcRenderer.invoke("select-audio-file"),
  selectOutputDirectory: () => ipcRenderer.invoke("select-output-directory"),

  // Settings
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("save-settings", settings),

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke("get-audio-devices"),

  // Microphone permissions (macOS)
  checkMicrophonePermission: () => ipcRenderer.invoke("check-microphone-permission"),
  requestMicrophonePermission: () => ipcRenderer.invoke("request-microphone-permission"),

  // Global settings (Phase 1)
  getGlobalSettings: () => ipcRenderer.invoke("get-global-settings"),
  saveGlobalSettings: (settings: unknown) => ipcRenderer.invoke("save-global-settings", settings),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke("save-api-key", apiKey),
  hasApiKey: () => ipcRenderer.invoke("has-api-key"),
  clearApiKey: () => ipcRenderer.invoke("clear-api-key"),

  // Permissions (Phase 1)
  getAllPermissions: () => ipcRenderer.invoke("get-all-permissions"),
  checkAccessibilityPermission: () => ipcRenderer.invoke("check-accessibility-permission"),
  requestAccessibilityPermission: () => ipcRenderer.invoke("request-accessibility-permission"),
  openAccessibilityPreferences: () => ipcRenderer.invoke("open-accessibility-preferences"),
  openMicrophonePreferences: () => ipcRenderer.invoke("open-microphone-preferences"),

  // Global Hotkeys (Phase 3)
  registerGlobalHotkey: (accelerator: string) => ipcRenderer.invoke("register-global-hotkey", accelerator),
  unregisterGlobalHotkey: () => ipcRenderer.invoke("unregister-global-hotkey"),
  getCurrentHotkey: () => ipcRenderer.invoke("get-current-hotkey"),
  isHotkeyRegistered: () => ipcRenderer.invoke("is-hotkey-registered"),

  // Text Injection (Phase 4)
  injectText: (text: string, preserveClipboard?: boolean) =>
    ipcRenderer.invoke("inject-text", text, preserveClipboard),
  copyToClipboard: (text: string) => ipcRenderer.invoke("copy-to-clipboard", text),
  isTextInjectionAvailable: () => ipcRenderer.invoke("is-text-injection-available"),

  // Streaming Transcription (Phase 5)
  startStreamingTranscription: (apiKey?: string) =>
    ipcRenderer.invoke("start-streaming-transcription", apiKey),
  stopStreamingTranscription: () => ipcRenderer.invoke("stop-streaming-transcription"),
  sendAudioChunk: (audioData: ArrayBuffer) => ipcRenderer.invoke("send-audio-chunk", audioData),

  // Transcription History
  getTranscriptionHistory: () => ipcRenderer.invoke("get-transcription-history"),
  addTranscriptionHistory: (entry: { text: string; duration: number; source: "recording" | "hotkey" }) =>
    ipcRenderer.invoke("add-transcription-history", entry),
  deleteTranscriptionHistory: (id: string) => ipcRenderer.invoke("delete-transcription-history", id),
  clearTranscriptionHistory: () => ipcRenderer.invoke("clear-transcription-history"),

  // Event listeners for streaming updates
  onGlobalRecordingStarted: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("global-recording-started", listener);
    return () => {
      ipcRenderer.removeListener("global-recording-started", listener);
    };
  },
  onGlobalRecordingStopped: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("global-recording-stopped", listener);
    return () => {
      ipcRenderer.removeListener("global-recording-stopped", listener);
    };
  },
  onTranscriptionProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on("transcription-progress", (_event, progress) => callback(progress));
  },
  onTranscriptionComplete: (callback: (text: string) => void) => {
    ipcRenderer.on("transcription-complete", (_event, text) => callback(text));
  },
  onAudioChunk: (callback: (chunk: ArrayBuffer) => void) => {
    ipcRenderer.on("audio-chunk", (_event, chunk) => callback(chunk));
  },
  onOverlayStateChange: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on("overlay-state-update", listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("overlay-state-update", listener);
    };
  },
  onStreamingTranscript: (callback: (result: unknown) => void) => {
    const listener = (_event: unknown, result: unknown) => callback(result);
    ipcRenderer.on("streaming-transcript", listener);
    return () => {
      ipcRenderer.removeListener("streaming-transcript", listener);
    };
  },
  onStreamingError: (callback: (error: string) => void) => {
    const listener = (_event: unknown, error: string) => callback(error);
    ipcRenderer.on("streaming-error", listener);
    return () => {
      ipcRenderer.removeListener("streaming-error", listener);
    };
  },

  // Cleanup methods
  removeListener: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
