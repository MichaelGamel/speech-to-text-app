# State Management in Electron Apps

## Overview
State management in Electron applications has unique challenges due to the multi-process architecture. You need strategies for managing state within the renderer process, sharing state between processes, and persisting state across app restarts.

## Renderer Process State Management

### Approach 1: React Context API (Lightweight)

Best for: Small to medium apps, simple state requirements

```typescript
// src/contexts/AppContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface AppState {
  transcript: string;
  isRecording: boolean;
  settings: UserSettings;
}

interface UserSettings {
  theme: 'light' | 'dark';
  language: string;
  autoSave: boolean;
}

interface AppContextType {
  state: AppState;
  setTranscript: (text: string) => void;
  setRecording: (recording: boolean) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    transcript: '',
    isRecording: false,
    settings: {
      theme: 'dark',
      language: 'en',
      autoSave: true,
    },
  });

  const setTranscript = (text: string) => {
    setState((prev) => ({ ...prev, transcript: text }));
  };

  const setRecording = (recording: boolean) => {
    setState((prev) => ({ ...prev, isRecording: recording }));
  };

  const updateSettings = (settings: Partial<UserSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  return (
    <AppContext.Provider value={{ state, setTranscript, setRecording, updateSettings }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
```

```typescript
// src/components/RecordButton.tsx
import { useApp } from '../contexts/AppContext';

export const RecordButton = () => {
  const { state, setRecording } = useApp();

  return (
    <button onClick={() => setRecording(!state.isRecording)}>
      {state.isRecording ? 'Stop' : 'Start'} Recording
    </button>
  );
};
```

### Approach 2: Zustand (Simple and Powerful)

Best for: Medium to large apps, complex state with minimal boilerplate

```typescript
// src/stores/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
}

interface AppState {
  // State
  transcript: string;
  segments: TranscriptSegment[];
  isRecording: boolean;
  settings: UserSettings;

  // Actions
  setTranscript: (text: string) => void;
  addSegment: (segment: TranscriptSegment) => void;
  clearSegments: () => void;
  toggleRecording: () => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      transcript: '',
      segments: [],
      isRecording: false,
      settings: {
        theme: 'dark',
        language: 'en',
        autoSave: true,
      },

      // Actions
      setTranscript: (text) => set({ transcript: text }),

      addSegment: (segment) =>
        set((state) => ({
          segments: [...state.segments, segment],
          transcript: state.transcript + ' ' + segment.text,
        })),

      clearSegments: () => set({ segments: [], transcript: '' }),

      toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),

      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// Usage in components
export const TranscriptView = () => {
  const transcript = useAppStore((state) => state.transcript);
  const clearSegments = useAppStore((state) => state.clearSegments);

  return (
    <div>
      <p>{transcript}</p>
      <button onClick={clearSegments}>Clear</button>
    </div>
  );
};
```

### Approach 3: Redux Toolkit (Enterprise-Grade)

Best for: Large apps, complex state logic, time-travel debugging

```typescript
// src/store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import transcriptReducer from './slices/transcriptSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    transcript: transcriptReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// src/store/slices/transcriptSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TranscriptState {
  text: string;
  segments: TranscriptSegment[];
  isRecording: boolean;
}

const transcriptSlice = createSlice({
  name: 'transcript',
  initialState: {
    text: '',
    segments: [],
    isRecording: false,
  },
  reducers: {
    setText: (state, action: PayloadAction<string>) => {
      state.text = action.payload;
    },
    addSegment: (state, action: PayloadAction<TranscriptSegment>) => {
      state.segments.push(action.payload);
      state.text += ' ' + action.payload.text;
    },
    toggleRecording: (state) => {
      state.isRecording = !state.isRecording;
    },
  },
});

export const { setText, addSegment, toggleRecording } = transcriptSlice.actions;
export default transcriptSlice.reducer;
```

## Sharing State Between Main and Renderer

### Pattern 1: Sync via IPC

```typescript
// electron/main.ts
import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';

const store = new Store();

ipcMain.handle('get-settings', () => {
  return store.get('settings', {});
});

ipcMain.handle('update-settings', (_event, settings) => {
  store.set('settings', settings);
  // Broadcast to all windows
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('settings-updated', settings);
  });
  return true;
});

// src/hooks/useSettings.ts
import { useEffect, useState } from 'react';

export const useSettings = () => {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
    window.electronAPI.onSettingsUpdated(setSettings);
  }, []);

  const updateSettings = async (newSettings: any) => {
    await window.electronAPI.updateSettings(newSettings);
  };

  return { settings, updateSettings };
};
```

## Persistent Storage Strategies

### Strategy 1: electron-store (Simple Key-Value)

```typescript
// electron/storage.ts
import Store from 'electron-store';

interface StoreSchema {
  settings: UserSettings;
  transcripts: SavedTranscript[];
  recentFiles: string[];
}

export const storage = new Store<StoreSchema>({
  defaults: {
    settings: {
      theme: 'dark',
      language: 'en',
      autoSave: true,
    },
    transcripts: [],
    recentFiles: [],
  },
});

// Watch for changes
storage.onDidChange('settings', (newValue, oldValue) => {
  console.log('Settings changed:', newValue);
});
```

### Strategy 2: IndexedDB (Large Datasets)

```typescript
// src/db/database.ts
import Dexie, { Table } from 'dexie';

interface TranscriptRecord {
  id?: number;
  text: string;
  createdAt: Date;
  duration: number;
}

class TranscriptDatabase extends Dexie {
  transcripts!: Table<TranscriptRecord>;

  constructor() {
    super('TranscriptDB');
    this.version(1).stores({
      transcripts: '++id, text, createdAt',
    });
  }
}

export const db = new TranscriptDatabase();

// Usage
export const saveTranscript = async (text: string, duration: number) => {
  await db.transcripts.add({
    text,
    duration,
    createdAt: new Date(),
  });
};

export const getAllTranscripts = async () => {
  return await db.transcripts.orderBy('createdAt').reverse().toArray();
};
```

## Comparison Matrix

| Approach | Complexity | Performance | Best For |
|----------|-----------|-------------|----------|
| Context API | Low | Good | Small apps, simple state |
| Zustand | Low | Excellent | Most apps, balanced solution |
| Redux Toolkit | Medium | Good | Large apps, complex logic |
| electron-store | Low | Good | Settings, preferences |
| IndexedDB | Medium | Excellent | Large datasets, offline-first |

## Recommendations for Speech-to-Text App

1. **Zustand** for renderer state (transcripts, UI state)
2. **electron-store** for persistent settings
3. **IndexedDB** for storing historical transcripts
4. **Main process state** for audio processing status

## Key Takeaways

1. Choose the right tool: Context for simple, Zustand for balanced, Redux for complex
2. Keep sensitive data in main process
3. Debounce IPC calls for performance
4. Use appropriate storage based on data type
5. Type everything with TypeScript

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - IPC communication patterns
- [10-performance-optimization.md](./10-performance-optimization.md) - State performance tips
