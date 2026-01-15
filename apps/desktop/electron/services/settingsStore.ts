import Store from "electron-store";
import { safeStorage } from "electron";

// Settings that are persisted to disk
export interface GlobalSettings {
  hotkey: string;
  sttProvider: "deepgram" | "whisper";
  preserveClipboard: boolean;
  showOverlay: boolean;
  overlayPosition: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  maxRecordingDuration: number; // Max recording duration in seconds (0 = no limit)
}

// Internal storage format (includes encrypted API key)
interface StoredSettings extends GlobalSettings {
  encryptedApiKey?: string;
}

// Default settings
const defaults: StoredSettings = {
  hotkey: "CommandOrControl+Shift+Space",
  sttProvider: "whisper", // Default to offline mode
  preserveClipboard: true,
  showOverlay: true,
  overlayPosition: "top-right",
  maxRecordingDuration: 300, // 5 minutes default, 0 = no limit
};

class SettingsStore {
  private store: Store<StoredSettings>;

  constructor() {
    this.store = new Store<StoredSettings>({
      name: "global-settings",
      defaults,
    });
  }

  /**
   * Get all settings (excluding encrypted API key)
   */
  getAll(): GlobalSettings & { hasApiKey: boolean } {
    const { encryptedApiKey, ...settings } = this.store.store;
    return {
      ...settings,
      hasApiKey: !!encryptedApiKey,
    };
  }

  /**
   * Get a specific setting
   */
  get<K extends keyof GlobalSettings>(key: K): GlobalSettings[K] {
    return this.store.get(key);
  }

  /**
   * Set a specific setting
   */
  set<K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]): void {
    this.store.set(key, value);
  }

  /**
   * Update multiple settings at once
   */
  update(settings: Partial<GlobalSettings>): void {
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && key !== "encryptedApiKey") {
        this.store.set(key as keyof GlobalSettings, value);
      }
    }
  }

  /**
   * Securely store the API key using Electron's safeStorage
   * This encrypts the key at rest using the OS keychain
   */
  setApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.trim().length === 0) {
      this.store.delete("encryptedApiKey");
      return true;
    }

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(apiKey);
        this.store.set("encryptedApiKey", encrypted.toString("base64"));
        return true;
      } catch (error) {
        console.error("Failed to encrypt API key:", error);
        return false;
      }
    } else {
      // Fallback: store in plain text (not recommended, but functional)
      console.warn("Encryption not available, storing API key in plain text");
      this.store.set("encryptedApiKey", apiKey);
      return true;
    }
  }

  /**
   * Retrieve and decrypt the API key
   */
  getApiKey(): string | null {
    const encrypted = this.store.get("encryptedApiKey");
    if (!encrypted) return null;

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(encrypted, "base64");
        return safeStorage.decryptString(buffer);
      } catch (error) {
        console.error("Failed to decrypt API key:", error);
        return null;
      }
    }

    // Fallback: return plain text key
    return encrypted;
  }

  /**
   * Check if an API key is stored
   */
  hasApiKey(): boolean {
    return !!this.store.get("encryptedApiKey");
  }

  /**
   * Clear the stored API key
   */
  clearApiKey(): void {
    this.store.delete("encryptedApiKey");
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this.store.clear();
  }

  /**
   * Get the path to the settings file (for debugging)
   */
  getPath(): string {
    return this.store.path;
  }
}

// Singleton instance
let settingsStoreInstance: SettingsStore | null = null;

export function getSettingsStore(): SettingsStore {
  if (!settingsStoreInstance) {
    settingsStoreInstance = new SettingsStore();
  }
  return settingsStoreInstance;
}

export type { SettingsStore };
