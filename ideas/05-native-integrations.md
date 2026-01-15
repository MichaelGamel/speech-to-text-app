# Native OS Integrations

## Overview
Electron provides powerful APIs to integrate with native operating system features. This document covers system tray integration, keyboard shortcuts, notifications, file system access, clipboard operations, and platform-specific features for macOS and Windows.

## System Tray Integration

### Basic System Tray

```typescript
// electron/main/tray.ts
import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export const setupTray = (mainWindow: BrowserWindow) => {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath);

  // Resize icon for different platforms
  const trayIcon = process.platform === 'darwin' ? icon.resize({ width: 16, height: 16 }) : icon;

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Start Recording',
      click: () => {
        mainWindow.webContents.send('command:start-recording');
      },
    },
    {
      label: 'Stop Recording',
      click: () => {
        mainWindow.webContents.send('command:stop-recording');
      },
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: 'Hide Window',
      click: () => {
        mainWindow.hide();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Speech to Text App');

  // Click handler - different behavior per platform
  tray.on('click', () => {
    if (process.platform === 'darwin') {
      // macOS: show context menu on click
      tray?.popUpContextMenu();
    } else {
      // Windows/Linux: toggle window visibility
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });

  return tray;
};

// Update tray icon dynamically
export const updateTrayIcon = (isRecording: boolean) => {
  if (!tray) return;

  const iconName = isRecording ? 'tray-icon-recording.png' : 'tray-icon.png';
  const iconPath = path.join(__dirname, '../../assets', iconName);
  const icon = nativeImage.createFromPath(iconPath);

  const trayIcon = process.platform === 'darwin' ? icon.resize({ width: 16, height: 16 }) : icon;

  tray.setImage(trayIcon);
};

// Update tray menu dynamically
export const updateTrayMenu = (isRecording: boolean) => {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isRecording ? 'Stop Recording' : 'Start Recording',
      click: () => {
        // Toggle recording
      },
    },
    // ... other menu items
  ]);

  tray.setContextMenu(contextMenu);
};
```

## Global Keyboard Shortcuts

### Registration and Management

```typescript
// electron/main/shortcuts.ts
import { app, globalShortcut, BrowserWindow } from 'electron';

export class ShortcutManager {
  private shortcuts: Map<string, () => void> = new Map();

  register(accelerator: string, callback: () => void): boolean {
    const success = globalShortcut.register(accelerator, callback);

    if (success) {
      this.shortcuts.set(accelerator, callback);
    }

    return success;
  }

  unregister(accelerator: string): void {
    globalShortcut.unregister(accelerator);
    this.shortcuts.delete(accelerator);
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
  }

  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }
}

// Setup default shortcuts
export const setupShortcuts = (mainWindow: BrowserWindow) => {
  const manager = new ShortcutManager();

  // Global push-to-talk shortcut
  manager.register('CommandOrControl+Shift+R', () => {
    mainWindow.webContents.send('shortcut:toggle-recording');
  });

  // Show/hide window
  manager.register('CommandOrControl+Shift+S', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Quick save transcript
  manager.register('CommandOrControl+S', () => {
    mainWindow.webContents.send('shortcut:save-transcript');
  });

  // Cleanup on app quit
  app.on('will-quit', () => {
    manager.unregisterAll();
  });

  return manager;
};

// Allow users to customize shortcuts
ipcMain.handle('shortcuts:register', (_event, accelerator: string, action: string) => {
  const success = globalShortcut.register(accelerator, () => {
    BrowserWindow.getAllWindows()[0]?.webContents.send(`shortcut:${action}`);
  });

  return success;
});

ipcMain.handle('shortcuts:unregister', (_event, accelerator: string) => {
  globalShortcut.unregister(accelerator);
});
```

### In-App Shortcuts (Renderer)

```typescript
// src/hooks/useKeyboardShortcut.ts
import { useEffect } from 'react';

export const useKeyboardShortcut = (
  keys: string[],
  callback: () => void,
  deps: any[] = []
) => {
  useEffect(() => {
    const pressedKeys = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => {
      pressedKeys.add(e.key.toLowerCase());

      const allKeysPressed = keys.every((key) => pressedKeys.has(key.toLowerCase()));

      if (allKeysPressed) {
        e.preventDefault();
        callback();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, deps);
};

// Usage
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';

export const TranscriptEditor = () => {
  useKeyboardShortcut(['control', 's'], () => {
    console.log('Save triggered');
  });

  return <div>...</div>;
};
```

## Native Notifications

### Cross-Platform Notifications

```typescript
// electron/services/notifications.ts
import { Notification } from 'electron';

export class NotificationService {
  show(title: string, body: string, options?: { silent?: boolean; icon?: string }): void {
    const notification = new Notification({
      title,
      body,
      silent: options?.silent,
      icon: options?.icon,
    });

    notification.show();

    notification.on('click', () => {
      // Handle notification click
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  showTranscriptionComplete(wordCount: number): void {
    this.show('Transcription Complete', `${wordCount} words transcribed successfully`, {
      silent: false,
    });
  }

  showRecordingStarted(): void {
    this.show('Recording Started', 'Your audio is being recorded', {
      silent: true,
    });
  }

  showError(message: string): void {
    this.show('Error', message, {
      silent: false,
    });
  }
}

// IPC handlers
const notificationService = new NotificationService();

ipcMain.handle('notification:show', (_event, title: string, body: string) => {
  notificationService.show(title, body);
});

// Usage from renderer
window.electronAPI.showNotification('Success', 'Transcript saved');
```

### macOS Notification Actions

```typescript
// electron/services/notifications-macos.ts
import { Notification } from 'electron';

export class MacOSNotificationService {
  showWithActions(title: string, body: string, actions: string[]): void {
    if (process.platform !== 'darwin') {
      console.warn('Notification actions only supported on macOS');
      return;
    }

    const notification = new Notification({
      title,
      body,
      // @ts-ignore - macOS specific
      actions: actions.map((label) => ({ type: 'button', text: label })),
    });

    notification.on('action', (_event, index) => {
      console.log('Action clicked:', actions[index]);
      // Handle action
    });

    notification.show();
  }
}
```

## File System Access

### File Dialogs

```typescript
// electron/main/file-manager.ts
import { dialog, BrowserWindow } from 'electron';
import fs from 'fs/promises';
import path from 'path';

export class FileManager {
  async saveTranscript(content: string, defaultFileName?: string): Promise<string | null> {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save Transcript',
      defaultPath: defaultFileName || 'transcript.txt',
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (filePath) {
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    }

    return null;
  }

  async openFile(): Promise<{ content: string; path: string } | null> {
    const { filePaths } = await dialog.showOpenDialog({
      title: 'Open Transcript',
      filters: [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (filePaths.length > 0) {
      const content = await fs.readFile(filePaths[0], 'utf-8');
      return { content, path: filePaths[0] };
    }

    return null;
  }

  async selectFolder(): Promise<string | null> {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });

    return filePaths[0] || null;
  }

  async exportAudio(audioBuffer: Buffer): Promise<string | null> {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Audio',
      defaultPath: `recording-${Date.now()}.webm`,
      filters: [
        { name: 'WebM Audio', extensions: ['webm'] },
        { name: 'WAV Audio', extensions: ['wav'] },
      ],
    });

    if (filePath) {
      await fs.writeFile(filePath, audioBuffer);
      return filePath;
    }

    return null;
  }
}

// IPC handlers
const fileManager = new FileManager();

ipcMain.handle('file:save-transcript', async (_event, content: string) => {
  return await fileManager.saveTranscript(content);
});

ipcMain.handle('file:open', async () => {
  return await fileManager.openFile();
});
```

### Drag and Drop

```typescript
// src/components/FileDropZone.tsx
import { useState } from 'react';

export const FileDropZone = ({ onFileDrop }: { onFileDrop: (file: File) => void }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find((f) => f.type.startsWith('audio/'));

    if (audioFile) {
      onFileDrop(audioFile);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed p-8 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
    >
      Drop audio file here to transcribe
    </div>
  );
};
```

## Clipboard Integration

```typescript
// electron/services/clipboard.ts
import { clipboard, nativeImage } from 'electron';
import { ipcMain } from 'electron';

export class ClipboardService {
  copyText(text: string): void {
    clipboard.writeText(text);
  }

  pasteText(): string {
    return clipboard.readText();
  }

  copyImage(imagePath: string): void {
    const image = nativeImage.createFromPath(imagePath);
    clipboard.writeImage(image);
  }

  hasText(): boolean {
    return clipboard.has('text/plain');
  }

  clear(): void {
    clipboard.clear();
  }
}

const clipboardService = new ClipboardService();

ipcMain.handle('clipboard:copy', (_event, text: string) => {
  clipboardService.copyText(text);
});

ipcMain.handle('clipboard:paste', () => {
  return clipboardService.pasteText();
});

// Usage from renderer
const handleCopy = async () => {
  await window.electronAPI.copyToClipboard(transcript);
  // Show success notification
};
```

## Platform-Specific Features

### macOS: Touch Bar Support

```typescript
// electron/main/touchbar-macos.ts
import { TouchBar, BrowserWindow } from 'electron';

const { TouchBarButton, TouchBarSpacer } = TouchBar;

export const setupTouchBar = (mainWindow: BrowserWindow) => {
  if (process.platform !== 'darwin') return;

  const recordButton = new TouchBarButton({
    label: '🎤 Record',
    backgroundColor: '#ef4444',
    click: () => {
      mainWindow.webContents.send('command:toggle-recording');
    },
  });

  const saveButton = new TouchBarButton({
    label: '💾 Save',
    click: () => {
      mainWindow.webContents.send('command:save');
    },
  });

  const touchBar = new TouchBar({
    items: [recordButton, new TouchBarSpacer({ size: 'small' }), saveButton],
  });

  mainWindow.setTouchBar(touchBar);

  // Update button state
  ipcMain.on('recording-state-changed', (_event, isRecording: boolean) => {
    recordButton.label = isRecording ? '⏹ Stop' : '🎤 Record';
    recordButton.backgroundColor = isRecording ? '#22c55e' : '#ef4444';
  });
};
```

### Windows: Taskbar Progress

```typescript
// electron/main/taskbar-windows.ts
import { BrowserWindow } from 'electron';

export class WindowsTaskbar {
  setProgress(window: BrowserWindow, progress: number): void {
    if (process.platform !== 'win32') return;

    // progress: 0 to 1
    window.setProgressBar(progress);
  }

  setIndeterminate(window: BrowserWindow): void {
    if (process.platform !== 'win32') return;

    window.setProgressBar(2); // Indeterminate mode
  }

  clearProgress(window: BrowserWindow): void {
    if (process.platform !== 'win32') return;

    window.setProgressBar(-1); // Clear progress
  }

  showError(window: BrowserWindow): void {
    if (process.platform !== 'win32') return;

    window.setProgressBar(1, { mode: 'error' });
  }
}

// Usage
const taskbar = new WindowsTaskbar();

ipcMain.on('transcription-progress', (_event, progress: number) => {
  const window = BrowserWindow.getAllWindows()[0];
  taskbar.setProgress(window, progress);
});
```

### Windows: Jump List

```typescript
// electron/main/jumplist-windows.ts
import { app } from 'electron';

export const setupJumpList = () => {
  if (process.platform !== 'win32') return;

  app.setJumpList([
    {
      type: 'custom',
      name: 'Recent Transcripts',
      items: [
        {
          type: 'task',
          title: 'New Recording',
          description: 'Start a new recording',
          program: process.execPath,
          args: '--new-recording',
          iconPath: process.execPath,
          iconIndex: 0,
        },
      ],
    },
    {
      type: 'frequent',
    },
  ]);
};
```

## App Badge (macOS/Linux)

```typescript
// electron/services/badge.ts
import { app } from 'electron';

export class BadgeService {
  setBadge(count: number): void {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      app.setBadgeCount(count);
    }
  }

  clearBadge(): void {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      app.setBadgeCount(0);
    }
  }
}

// Usage: Show number of pending transcriptions
const badgeService = new BadgeService();
badgeService.setBadge(3);
```

## Key Takeaways

1. **System Tray**: Essential for background operation, update dynamically
2. **Global Shortcuts**: Use for quick access, allow customization
3. **Notifications**: Keep users informed, use native APIs for best experience
4. **File Dialogs**: Provide familiar native file selection
5. **Platform-Specific**: Leverage unique features (Touch Bar, Jump List)
6. **Clipboard**: Enable easy copy/paste workflows

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - IPC for native features
- [08-cross-platform-strategy.md](./08-cross-platform-strategy.md) - Platform differences
- [06-ui-ux-patterns.md](./06-ui-ux-patterns.md) - UI integration with native features
