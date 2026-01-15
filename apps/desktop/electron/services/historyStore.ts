import Store from "electron-store";

// Transcription entry stored in history
export interface TranscriptionEntry {
  id: string; // UUID
  text: string;
  timestamp: string; // ISO 8601 string
  duration: number; // Duration in seconds
  source: "recording" | "hotkey";
  characterCount: number;
}

// Internal storage format
interface StoredHistory {
  entries: TranscriptionEntry[];
  maxEntries: number;
}

// Default values
const defaults: StoredHistory = {
  entries: [],
  maxEntries: 100,
};

class TranscriptionHistoryStore {
  private store: Store<StoredHistory>;

  constructor() {
    this.store = new Store<StoredHistory>({
      name: "transcription-history",
      defaults,
    });
  }

  /**
   * Add a new transcription entry to history
   * Automatically prunes oldest entries if limit is exceeded
   */
  add(entry: Omit<TranscriptionEntry, "id" | "timestamp" | "characterCount">): TranscriptionEntry {
    const newEntry: TranscriptionEntry = {
      id: crypto.randomUUID(),
      text: entry.text,
      timestamp: new Date().toISOString(),
      duration: entry.duration,
      source: entry.source,
      characterCount: entry.text.length,
    };

    const entries = this.store.get("entries", []);
    const maxEntries = this.store.get("maxEntries", defaults.maxEntries);

    // Add new entry at the beginning (most recent first)
    entries.unshift(newEntry);

    // Prune oldest entries if exceeding limit
    if (entries.length > maxEntries) {
      entries.splice(maxEntries);
    }

    this.store.set("entries", entries);
    return newEntry;
  }

  /**
   * Get all transcription entries
   * Returns entries sorted by timestamp (most recent first)
   */
  getAll(): TranscriptionEntry[] {
    return this.store.get("entries", []);
  }

  /**
   * Get a specific transcription entry by ID
   */
  getById(id: string): TranscriptionEntry | null {
    const entries = this.store.get("entries", []);
    return entries.find((entry) => entry.id === id) || null;
  }

  /**
   * Delete a specific transcription entry by ID
   * Returns true if entry was found and deleted
   */
  delete(id: string): boolean {
    const entries = this.store.get("entries", []);
    const index = entries.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return false;
    }

    entries.splice(index, 1);
    this.store.set("entries", entries);
    return true;
  }

  /**
   * Clear all transcription history
   */
  clear(): void {
    this.store.set("entries", []);
  }

  /**
   * Get the current maximum entries limit
   */
  getMaxEntries(): number {
    return this.store.get("maxEntries", defaults.maxEntries);
  }

  /**
   * Set the maximum entries limit
   * Automatically prunes if current entries exceed new limit
   */
  setMaxEntries(limit: number): void {
    if (limit < 1) {
      limit = 1;
    }

    this.store.set("maxEntries", limit);

    // Prune if needed
    const entries = this.store.get("entries", []);
    if (entries.length > limit) {
      entries.splice(limit);
      this.store.set("entries", entries);
    }
  }

  /**
   * Get the count of entries in history
   */
  getCount(): number {
    return this.store.get("entries", []).length;
  }

  /**
   * Get the path to the history file (for debugging)
   */
  getPath(): string {
    return this.store.path;
  }
}

// Singleton instance
let historyStoreInstance: TranscriptionHistoryStore | null = null;

export function getHistoryStore(): TranscriptionHistoryStore {
  if (!historyStoreInstance) {
    historyStoreInstance = new TranscriptionHistoryStore();
  }
  return historyStoreInstance;
}

export type { TranscriptionHistoryStore };
