// Type definitions for Electron API exposed via preload script

export interface TranscriptionProgress {
  progress: number;
  status: 'loading' | 'transcribing' | 'completed' | 'error';
  message: string;
}

export interface TranscriptionResult {
  success: boolean;
  text?: string;
  duration?: number;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  outputDirectory: string;
}

export interface AudioDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

// Global settings for the speech-to-text feature
export interface GlobalSettings {
  hotkey: string;
  sttProvider: 'deepgram' | 'whisper';
  preserveClipboard: boolean;
  showOverlay: boolean;
  overlayPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxRecordingDuration: number; // Max recording duration in seconds (0 = no limit)
}

// Permission status types
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted';

export interface PermissionState {
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
}

// Overlay window state (Phase 2)
export interface OverlayState {
  isRecording: boolean;
  transcriptPreview?: string;
  duration?: number;
}

// Streaming transcription (Phase 5)
export interface StreamingResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export type TranscriptionMode = 'deepgram' | 'whisper';

// Transcription history entry
export interface TranscriptionEntry {
  id: string; // UUID
  text: string;
  timestamp: string; // ISO 8601 string
  duration: number; // Duration in seconds
  source: 'recording' | 'hotkey';
  characterCount: number;
}

// Input type for adding new transcription entries (id, timestamp, characterCount auto-generated)
export type TranscriptionEntryInput = Omit<TranscriptionEntry, 'id' | 'timestamp' | 'characterCount'>;

export interface ElectronAPI {
  // Platform info
  platform: string;

  // Transcription operations
  startRecording: () => Promise<{ success: boolean; error?: string }>;
  stopRecording: () => Promise<{ success: boolean; audioPath?: string; error?: string }>;
  transcribeFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<TranscriptionResult>;
  preloadWhisper: () => Promise<{ success: boolean; error?: string }>;

  // File operations
  saveTranscript: (text: string, fileName?: string) => Promise<SaveResult>;
  loadTranscript: (filePath: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  selectAudioFile: () => Promise<{ filePath?: string; cancelled: boolean }>;
  selectOutputDirectory: () => Promise<{ dirPath?: string; cancelled: boolean }>;

  // Settings
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Partial<Settings>) => Promise<{ success: boolean; error?: string }>;

  // Audio devices
  getAudioDevices: () => Promise<AudioDevice[]>;

  // Microphone permissions (macOS)
  checkMicrophonePermission: () => Promise<{ status: string; platform: string }>;
  requestMicrophonePermission: () => Promise<{ granted: boolean }>;

  // Global settings (Phase 1)
  getGlobalSettings: () => Promise<GlobalSettings & { hasApiKey: boolean }>;
  saveGlobalSettings: (settings: Partial<GlobalSettings>) => Promise<{ success: boolean; error?: string }>;
  saveApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
  hasApiKey: () => Promise<boolean>;
  clearApiKey: () => Promise<{ success: boolean }>;

  // Permissions (Phase 1)
  getAllPermissions: () => Promise<PermissionState>;
  checkAccessibilityPermission: () => Promise<{ status: PermissionStatus }>;
  requestAccessibilityPermission: () => Promise<{ granted: boolean }>;
  openAccessibilityPreferences: () => Promise<void>;
  openMicrophonePreferences: () => Promise<void>;

  // Global Hotkeys (Phase 3)
  registerGlobalHotkey: (accelerator: string) => Promise<{ success: boolean; error?: string }>;
  unregisterGlobalHotkey: () => Promise<{ success: boolean }>;
  getCurrentHotkey: () => Promise<string | null>;
  isHotkeyRegistered: () => Promise<boolean>;

  // Text Injection (Phase 4)
  injectText: (text: string, preserveClipboard?: boolean) => Promise<{ success: boolean; error?: string }>;
  copyToClipboard: (text: string) => Promise<{ success: boolean; error?: string }>;
  isTextInjectionAvailable: () => Promise<boolean>;

  // Streaming Transcription (Phase 5)
  startStreamingTranscription: (apiKey?: string) => Promise<{ success: boolean; mode: TranscriptionMode; error?: string }>;
  stopStreamingTranscription: () => Promise<{ transcript: string }>;
  sendAudioChunk: (audioData: ArrayBuffer) => Promise<void>;

  // Transcription History
  getTranscriptionHistory: () => Promise<{ success: boolean; data?: TranscriptionEntry[]; error?: string }>;
  addTranscriptionHistory: (entry: TranscriptionEntryInput) => Promise<{ success: boolean; data?: TranscriptionEntry; error?: string }>;
  deleteTranscriptionHistory: (id: string) => Promise<{ success: boolean; error?: string }>;
  clearTranscriptionHistory: () => Promise<{ success: boolean; error?: string }>;

  // Event listeners
  onGlobalRecordingStarted: (callback: () => void) => () => void;
  onGlobalRecordingStopped: (callback: () => void) => () => void;
  onTranscriptionProgress: (callback: (progress: TranscriptionProgress) => void) => void;
  onTranscriptionComplete: (callback: (text: string) => void) => void;
  onAudioChunk: (callback: (chunk: ArrayBuffer) => void) => void;
  onOverlayStateChange: (callback: (state: OverlayState) => void) => () => void;
  onStreamingTranscript: (callback: (result: StreamingResult) => void) => () => void;
  onStreamingError: (callback: (error: string) => void) => () => void;
  removeListener: (channel: string) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}