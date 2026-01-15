# Electron Architecture Patterns

## Overview
Electron applications consist of two main process types: the **Main Process** (Node.js backend) and **Renderer Process** (Chromium frontend). Understanding how to structure communication between these processes is critical for building secure, maintainable applications.

## Process Separation Pattern

### Main Process Responsibilities
The main process should handle:
- Application lifecycle (startup, quit, window management)
- Native OS integrations (file system, system tray, native dialogs)
- Backend business logic
- Database operations
- External API calls

### Renderer Process Responsibilities
The renderer process should handle:
- UI rendering and user interactions
- Frontend state management
- Display logic
- User input validation

### Example: Basic Process Structure

```typescript
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // CRITICAL: Enable context isolation for security
      contextIsolation: true,
      // Disable Node.js integration in renderer
      nodeIntegration: false,
      // Use preload script for safe API exposure
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

## IPC Communication Patterns

### Pattern 1: Request-Response (One-Way)

Best for: Simple data fetching, triggering actions

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Expose safe methods to renderer
  saveTranscript: (text: string) => ipcRenderer.invoke('save-transcript', text),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
});

// electron/main.ts
import { ipcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';

ipcMain.handle('save-transcript', async (_event, text: string) => {
  try {
    const filePath = path.join(app.getPath('documents'), 'transcripts', `${Date.now()}.txt`);
    await fs.writeFile(filePath, text, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-settings', async () => {
  // Load and return settings
  return {
    theme: 'dark',
    language: 'en',
    autoSave: true,
  };
});
```

```typescript
// src/App.tsx
import { useState } from 'react';

// Type definition for API exposed via preload
declare global {
  interface Window {
    electronAPI: {
      saveTranscript: (text: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      loadSettings: () => Promise<any>;
    };
  }
}

function App() {
  const [transcript, setTranscript] = useState('');

  const handleSave = async () => {
    const result = await window.electronAPI.saveTranscript(transcript);
    if (result.success) {
      console.log('Saved to:', result.filePath);
    }
  };

  return (
    <div>
      <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} />
      <button onClick={handleSave}>Save Transcript</button>
    </div>
  );
}
```

### Pattern 2: Event Streaming (Pub/Sub)

Best for: Real-time updates, progress tracking, push notifications

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Subscribe to events from main process
  onTranscriptionProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('transcription-progress', (_event, progress) => callback(progress));
  },
  onTranscriptionComplete: (callback: (text: string) => void) => {
    ipcRenderer.on('transcription-complete', (_event, text) => callback(text));
  },
  // Unsubscribe
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// electron/main.ts
import { BrowserWindow } from 'electron';

const processAudioFile = async (filePath: string, window: BrowserWindow) => {
  // Simulate audio processing with progress updates
  for (let i = 0; i <= 100; i += 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    window.webContents.send('transcription-progress', i);
  }

  const transcribedText = 'This is the transcribed text...';
  window.webContents.send('transcription-complete', transcribedText);
};

// src/components/Transcriber.tsx
import { useEffect, useState } from 'react';

export const Transcriber = () => {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState('');

  useEffect(() => {
    window.electronAPI.onTranscriptionProgress(setProgress);
    window.electronAPI.onTranscriptionComplete(setResult);

    return () => {
      window.electronAPI.removeAllListeners('transcription-progress');
      window.electronAPI.removeAllListeners('transcription-complete');
    };
  }, []);

  return (
    <div>
      <div>Progress: {progress}%</div>
      <div>Result: {result}</div>
    </div>
  );
};
```

### Pattern 3: Bidirectional Channel

Best for: Complex interactions, streaming data in both directions

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Send command to main
  startRecording: () => ipcRenderer.send('start-recording'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  // Listen for audio chunks
  onAudioChunk: (callback: (chunk: ArrayBuffer) => void) => {
    ipcRenderer.on('audio-chunk', (_event, chunk) => callback(chunk));
  },
});

// electron/main.ts
ipcMain.on('start-recording', (event) => {
  // Start recording and stream chunks back
  const recordAudio = async () => {
    // Simulated audio chunks
    const chunk = new ArrayBuffer(1024);
    event.sender.send('audio-chunk', chunk);
  };

  setInterval(recordAudio, 100);
});
```

## Preload Script Best Practices

### 1. Minimal API Surface
Only expose what's necessary:

```typescript
// BAD: Exposing entire ipcRenderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: ipcRenderer, // NEVER do this!
});

// GOOD: Expose specific, typed methods
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (data: string) => ipcRenderer.invoke('save-file', data),
  loadFile: () => ipcRenderer.invoke('load-file'),
});
```

### 2. Type-Safe API Definitions

```typescript
// types/electron.d.ts
export interface ElectronAPI {
  saveTranscript: (text: string) => Promise<SaveResult>;
  loadSettings: () => Promise<Settings>;
  onTranscriptionProgress: (callback: (progress: number) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

### 3. Input Validation

```typescript
// electron/main.ts
ipcMain.handle('save-transcript', async (_event, text: string) => {
  // Validate input
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Invalid transcript text');
  }

  if (text.length > 1_000_000) {
    throw new Error('Transcript too large');
  }

  // Proceed with save
});
```

## Application Lifecycle Management

### Handling Window State

```typescript
// electron/main.ts
import Store from 'electron-store';

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const store = new Store<{ windowState: WindowState }>();

const createWindow = () => {
  const windowState = store.get('windowState', {
    width: 1200,
    height: 800,
    isMaximized: false,
  });

  const window = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    // other options...
  });

  if (windowState.isMaximized) {
    window.maximize();
  }

  // Save state on close
  const saveWindowState = () => {
    const bounds = window.getBounds();
    store.set('windowState', {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: window.isMaximized(),
    });
  };

  window.on('close', saveWindowState);
  window.on('resize', saveWindowState);
  window.on('move', saveWindowState);

  return window;
};
```

### Graceful Shutdown

```typescript
// electron/main.ts
let isQuitting = false;

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    event.preventDefault();
    isQuitting = true;

    // Cleanup tasks
    await cleanupTempFiles();
    await saveAppState();

    // Close all windows
    BrowserWindow.getAllWindows().forEach((window) => window.close());

    app.quit();
  }
});
```

## Cross-Platform Considerations

### Platform-Specific Behavior

```typescript
// electron/main.ts
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

const createWindow = () => {
  const window = new BrowserWindow({
    // macOS-specific: Traffic light positioning
    ...(isMac && {
      titleBarStyle: 'hiddenInset',
    }),
    // Windows-specific: Custom frame
    ...(isWindows && {
      frame: false,
    }),
  });
};

// macOS: Keep app running when all windows closed
app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});
```

## Key Takeaways

1. **Separation of Concerns**: Keep main process for system operations, renderer for UI
2. **Secure IPC**: Always use `contextBridge` with context isolation enabled
3. **Type Safety**: Define TypeScript interfaces for all IPC communications
4. **Validate Input**: Never trust data from renderer process
5. **Lifecycle Management**: Handle window state, graceful shutdown, platform differences
6. **Minimal Exposure**: Only expose necessary APIs through preload script

## Related Documents
- [02-state-management.md](./02-state-management.md) - Managing state across processes
- [09-security-best-practices.md](./09-security-best-practices.md) - Security considerations
- [08-cross-platform-strategy.md](./08-cross-platform-strategy.md) - Platform-specific patterns
