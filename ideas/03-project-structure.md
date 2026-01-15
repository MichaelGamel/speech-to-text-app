# Project Structure for Electron Monorepos

## Overview
A well-organized project structure is crucial for maintainability, especially in monorepos with multiple packages. This guide covers best practices for structuring Electron applications with shared code, clear separation of concerns, and scalable architecture.

## Recommended Monorepo Structure

```
speech-to-text-app/
├── apps/
│   ├── desktop/                    # Main Electron desktop app
│   │   ├── electron/               # Electron-specific code
│   │   │   ├── main/              # Main process code
│   │   │   │   ├── index.ts       # Entry point
│   │   │   │   ├── window.ts      # Window management
│   │   │   │   ├── menu.ts        # Application menu
│   │   │   │   ├── tray.ts        # System tray
│   │   │   │   └── ipc/           # IPC handlers
│   │   │   │       ├── audio.ts
│   │   │   │       ├── file.ts
│   │   │   │       └── settings.ts
│   │   │   ├── preload/           # Preload scripts
│   │   │   │   └── index.ts
│   │   │   └── types/             # Electron-specific types
│   │   │       └── electron.d.ts
│   │   ├── src/                   # React renderer app
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── utils/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/                # Static assets
│   │   ├── dist/                  # Built renderer
│   │   ├── dist-electron/         # Built main/preload
│   │   ├── release/               # Packaged apps
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── web/                       # Optional: Web version
│       └── ...
├── packages/
│   ├── shared/                    # Shared business logic
│   │   ├── src/
│   │   │   ├── types/            # Shared TypeScript types
│   │   │   ├── utils/            # Utility functions
│   │   │   ├── constants/        # App constants
│   │   │   └── validators/       # Validation logic
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                        # Shared React components
│   │   ├── src/
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── audio/                     # Audio processing library
│   │   ├── src/
│   │   │   ├── capture.ts
│   │   │   ├── processing.ts
│   │   │   └── types.ts
│   │   └── package.json
│   └── transcription/             # Transcription services
│       ├── src/
│       │   ├── providers/
│       │   │   ├── openai.ts
│       │   │   ├── google.ts
│       │   │   └── local.ts
│       │   ├── types.ts
│       │   └── index.ts
│       └── package.json
├── scripts/                       # Build and dev scripts
│   ├── build.js
│   └── notarize.js               # macOS notarization
├── .github/
│   └── workflows/                # CI/CD workflows
│       ├── build.yml
│       └── release.yml
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── tsconfig.json
```

## Main Process Organization

### Modular Main Process Structure

```typescript
// electron/main/index.ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { setupMenu } from './menu';
import { setupTray } from './tray';
import { registerIPCHandlers } from './ipc';
import { initializeDatabase } from './database';

class Application {
  private mainWindow: BrowserWindow | null = null;

  async initialize() {
    await app.whenReady();

    // Initialize services
    await initializeDatabase();

    // Setup UI
    this.mainWindow = createMainWindow();
    setupMenu();
    setupTray();

    // Setup IPC
    registerIPCHandlers();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.mainWindow = createMainWindow();
      }
    });
  }

  async cleanup() {
    // Cleanup logic
  }
}

const application = new Application();
application.initialize();
```

### Window Management Module

```typescript
// electron/main/window.ts
import { BrowserWindow, screen } from 'electron';
import path from 'path';
import Store from 'electron-store';

interface WindowConfig {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const store = new Store<{ windowConfig: WindowConfig }>();

export const createMainWindow = (): BrowserWindow => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const savedConfig = store.get('windowConfig', {
    width: Math.floor(width * 0.8),
    height: Math.floor(height * 0.8),
  });

  const window = new BrowserWindow({
    ...savedConfig,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1e1e1e',
  });

  // Save window state on changes
  const saveWindowState = () => {
    const bounds = window.getBounds();
    store.set('windowConfig', bounds);
  };

  window.on('resize', saveWindowState);
  window.on('move', saveWindowState);

  // Load app
  if (process.env.NODE_ENV === 'development') {
    window.loadURL('http://localhost:5173');
    window.webContents.openDevTools();
  } else {
    window.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  return window;
};
```

### IPC Handler Organization

```typescript
// electron/main/ipc/index.ts
import { registerAudioHandlers } from './audio';
import { registerFileHandlers } from './file';
import { registerSettingsHandlers } from './settings';

export const registerIPCHandlers = () => {
  registerAudioHandlers();
  registerFileHandlers();
  registerSettingsHandlers();
};

// electron/main/ipc/audio.ts
import { ipcMain } from 'electron';
import { AudioCapture } from '../../services/audio-capture';

const audioCapture = new AudioCapture();

export const registerAudioHandlers = () => {
  ipcMain.handle('audio:start-recording', async () => {
    return await audioCapture.start();
  });

  ipcMain.handle('audio:stop-recording', async () => {
    return await audioCapture.stop();
  });

  ipcMain.handle('audio:get-devices', async () => {
    return await audioCapture.getDevices();
  });
};

// electron/main/ipc/file.ts
import { ipcMain, dialog } from 'electron';
import fs from 'fs/promises';

export const registerFileHandlers = () => {
  ipcMain.handle('file:save-transcript', async (_event, text: string) => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'transcript.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (filePath) {
      await fs.writeFile(filePath, text, 'utf-8');
      return { success: true, path: filePath };
    }

    return { success: false };
  });

  ipcMain.handle('file:open-transcript', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (filePaths.length > 0) {
      const content = await fs.readFile(filePaths[0], 'utf-8');
      return { success: true, content, path: filePaths[0] };
    }

    return { success: false };
  });
};
```

## Renderer Process Organization

### Feature-Based Structure

```typescript
// src/features/transcription/
├── components/
│   ├── TranscriptionView.tsx
│   ├── RecordButton.tsx
│   └── ProgressIndicator.tsx
├── hooks/
│   ├── useTranscription.ts
│   └── useAudioRecording.ts
├── stores/
│   └── transcriptionStore.ts
├── types/
│   └── transcription.types.ts
└── index.ts

// src/features/settings/
├── components/
│   ├── SettingsPanel.tsx
│   └── ThemeSelector.tsx
├── hooks/
│   └── useSettings.ts
└── index.ts
```

### Example Feature Module

```typescript
// src/features/transcription/hooks/useTranscription.ts
import { useState, useCallback } from 'react';
import { useTranscriptionStore } from '../stores/transcriptionStore';

export const useTranscription = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const addSegment = useTranscriptionStore((state) => state.addSegment);

  const startTranscription = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const result = await window.electronAPI.transcribeAudio(audioBlob);
      addSegment(result);
    } catch (error) {
      console.error('Transcription failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [addSegment]);

  return {
    isProcessing,
    startTranscription,
  };
};

// src/features/transcription/components/TranscriptionView.tsx
import { useTranscription } from '../hooks/useTranscription';
import { useTranscriptionStore } from '../stores/transcriptionStore';
import { RecordButton } from './RecordButton';

export const TranscriptionView = () => {
  const segments = useTranscriptionStore((state) => state.segments);
  const { isProcessing } = useTranscription();

  return (
    <div>
      <RecordButton />
      {isProcessing && <div>Processing...</div>}
      <div>
        {segments.map((segment) => (
          <p key={segment.id}>{segment.text}</p>
        ))}
      </div>
    </div>
  );
};
```

## Shared Packages

### Shared Types Package

```typescript
// packages/shared/src/types/transcription.ts
export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
  speaker?: string;
}

export interface TranscriptionOptions {
  language: string;
  punctuation: boolean;
  diarization: boolean;
}

export interface AudioDevice {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

// packages/shared/src/types/settings.ts
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  autoSave: boolean;
  audioDevice?: string;
  transcriptionProvider: 'openai' | 'google' | 'local';
}
```

### Shared Utilities

```typescript
// packages/shared/src/utils/format.ts
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatFileSize = (bytes: number): string => {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

// Usage in both main and renderer
import { formatDuration } from '@speech-to-text/shared';
```

## Package Dependencies

### Package.json Configuration

```json
// apps/desktop/package.json
{
  "name": "@speech-to-text/desktop",
  "dependencies": {
    "@speech-to-text/ui": "workspace:*",
    "@speech-to-text/shared": "workspace:*",
    "@speech-to-text/audio": "workspace:*",
    "react": "^19.0.0",
    "electron": "^34.0.1"
  }
}

// packages/ui/package.json
{
  "name": "@speech-to-text/ui",
  "dependencies": {
    "@speech-to-text/shared": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}

// packages/audio/package.json
{
  "name": "@speech-to-text/audio",
  "dependencies": {
    "@speech-to-text/shared": "workspace:*"
  }
}
```

### Turbo Configuration for Monorepo

```json
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "dist-electron/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

## TypeScript Configuration

### Root TypeScript Config

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true
  }
}

// apps/desktop/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../packages/shared/src/*"],
      "@ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["src/**/*", "electron/**/*"]
}
```

## Key Takeaways

1. **Separation by Concern**: Organize main process by functionality (IPC, window, menu)
2. **Feature-Based Renderer**: Group related components, hooks, and stores together
3. **Shared Packages**: Extract reusable logic into workspace packages
4. **Clear Dependencies**: Use workspace protocol and define peer dependencies
5. **Type Safety**: Share types across packages to ensure consistency
6. **Build Pipeline**: Use Turbo for efficient builds with proper dependencies

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - IPC and process patterns
- [02-state-management.md](./02-state-management.md) - State organization
- [10-performance-optimization.md](./10-performance-optimization.md) - Code splitting strategies
