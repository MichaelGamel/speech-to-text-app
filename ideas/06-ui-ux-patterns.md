# Desktop UI/UX Patterns

## Overview
Desktop applications have unique UI/UX considerations compared to web apps. This document covers window management, native menus, custom title bars, drag-and-drop functionality, and desktop-specific UI patterns.

## Window Management

### Multi-Window Architecture

```typescript
// electron/main/window-manager.ts
import { BrowserWindow, screen } from 'electron';
import path from 'path';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createMainWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const window = new BrowserWindow({
      width: Math.floor(width * 0.8),
      height: Math.floor(height * 0.8),
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
      },
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 10, y: 10 },
    });

    window.loadURL('http://localhost:5173');
    this.windows.set('main', window);

    return window;
  }

  createSettingsWindow(): BrowserWindow {
    const mainWindow = this.windows.get('main');

    const window = new BrowserWindow({
      width: 600,
      height: 500,
      parent: mainWindow, // Modal to main window
      modal: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    window.loadURL('http://localhost:5173/#/settings');

    window.once('ready-to-show', () => {
      window.show();
    });

    this.windows.set('settings', window);

    return window;
  }

  createFloatingWidget(): BrowserWindow {
    const window = new BrowserWindow({
      width: 300,
      height: 100,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
      },
    });

    window.loadURL('http://localhost:5173/#/widget');
    this.windows.set('widget', window);

    return window;
  }

  closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window && !window.isDestroyed()) {
      window.close();
      this.windows.delete(id);
    }
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }
}

// IPC handlers
const windowManager = new WindowManager();

ipcMain.handle('window:create-settings', () => {
  return windowManager.createSettingsWindow();
});

ipcMain.handle('window:create-widget', () => {
  return windowManager.createFloatingWidget();
});
```

### Frameless Window with Custom Title Bar

```typescript
// src/components/TitleBar.tsx
import { X, Minus, Square } from 'lucide-react';

export const TitleBar = () => {
  const handleMinimize = () => {
    window.electronAPI.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI.closeWindow();
  };

  return (
    <div className="flex items-center justify-between h-8 bg-gray-800 text-white select-none drag-region">
      <div className="flex items-center pl-20"> {/* Space for macOS traffic lights */}
        <span className="text-sm font-medium">Speech to Text</span>
      </div>

      <div className="flex no-drag">
        <button
          onClick={handleMinimize}
          className="px-4 hover:bg-gray-700 h-8 flex items-center justify-center"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="px-4 hover:bg-gray-700 h-8 flex items-center justify-center"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="px-4 hover:bg-red-600 h-8 flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

// CSS for draggable regions
// index.css
.drag-region {
  -webkit-app-region: drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}
```

```typescript
// electron/preload.ts - Window controls API
contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});

// electron/main.ts - Window control handlers
ipcMain.on('window:minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.minimize();
});

ipcMain.on('window:maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window?.isMaximized()) {
    window.unmaximize();
  } else {
    window?.maximize();
  }
});

ipcMain.on('window:close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  window?.close();
});
```

### Window State Persistence

```typescript
// src/hooks/useWindowState.ts
import { useEffect, useState } from 'react';

interface WindowState {
  isMaximized: boolean;
  isFullscreen: boolean;
}

export const useWindowState = () => {
  const [state, setState] = useState<WindowState>({
    isMaximized: false,
    isFullscreen: false,
  });

  useEffect(() => {
    window.electronAPI.onWindowStateChanged((newState: WindowState) => {
      setState(newState);
    });

    // Get initial state
    window.electronAPI.getWindowState().then(setState);
  }, []);

  const toggleFullscreen = () => {
    window.electronAPI.toggleFullscreen();
  };

  return { ...state, toggleFullscreen };
};
```

## Application Menu

### Cross-Platform Menu

```typescript
// electron/main/menu.ts
import { Menu, BrowserWindow, app, shell } from 'electron';

export const setupMenu = (mainWindow: BrowserWindow) => {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Preferences',
                accelerator: 'Cmd+,',
                click: () => {
                  mainWindow.webContents.send('menu:open-settings');
                },
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Recording',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu:new-recording');
          },
        },
        {
          label: 'Open Transcript',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            mainWindow.webContents.send('menu:open-transcript');
          },
        },
        {
          label: 'Save Transcript',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu:save-transcript');
          },
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as Text',
              click: () => {
                mainWindow.webContents.send('menu:export-text');
              },
            },
            {
              label: 'Export as Markdown',
              click: () => {
                mainWindow.webContents.send('menu:export-markdown');
              },
            },
          ],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Recording',
      submenu: [
        {
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('menu:start-recording');
          },
        },
        {
          label: 'Stop Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.send('menu:stop-recording');
          },
        },
        { type: 'separator' },
        {
          label: 'Audio Settings',
          click: () => {
            mainWindow.webContents.send('menu:audio-settings');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://docs.example.com');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/example/issues');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// Dynamic menu updates
export const updateRecordingMenu = (isRecording: boolean) => {
  const menu = Menu.getApplicationMenu();
  const recordingMenu = menu?.getMenuItemById('recording');

  if (recordingMenu) {
    // Update menu based on recording state
  }
};
```

### Context Menus

```typescript
// src/components/TranscriptView.tsx
import { useEffect } from 'react';

export const TranscriptView = ({ text }: { text: string }) => {
  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();

    const selectedText = window.getSelection()?.toString();

    await window.electronAPI.showContextMenu({
      items: [
        {
          label: 'Copy',
          enabled: !!selectedText,
          click: () => {
            navigator.clipboard.writeText(selectedText || '');
          },
        },
        {
          label: 'Copy All',
          click: () => {
            navigator.clipboard.writeText(text);
          },
        },
        { type: 'separator' },
        {
          label: 'Search Selected Text',
          enabled: !!selectedText,
          click: () => {
            window.electronAPI.searchText(selectedText);
          },
        },
      ],
    });
  };

  return (
    <div onContextMenu={handleContextMenu} className="p-4">
      {text}
    </div>
  );
};

// electron/main.ts - Context menu handler
ipcMain.handle('context-menu:show', (_event, items) => {
  const menu = Menu.buildFromTemplate(items);
  menu.popup();
});
```

## Drag and Drop

### File Drop Zone

```typescript
// src/components/AudioDropZone.tsx
import { useState } from 'react';
import { Upload } from 'lucide-react';

export const AudioDropZone = () => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter((f) => f.type.startsWith('audio/'));

    for (const file of audioFiles) {
      const arrayBuffer = await file.arrayBuffer();
      await window.electronAPI.transcribeAudio(new Uint8Array(arrayBuffer));
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center
        transition-colors
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
      `}
    >
      <Upload className="mx-auto mb-4" size={48} />
      <p className="text-lg font-medium">Drop audio files here</p>
      <p className="text-sm text-gray-500">Supports MP3, WAV, M4A, WebM</p>
    </div>
  );
};
```

### Draggable Window Regions

```typescript
// src/components/FloatingWidget.tsx
export const FloatingWidget = () => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Draggable header */}
      <div className="drag-region bg-gray-800 text-white p-2 cursor-move">
        <span className="text-sm">Recording...</span>
      </div>

      {/* Non-draggable content */}
      <div className="p-4 no-drag">
        <button className="px-4 py-2 bg-red-500 text-white rounded">Stop</button>
      </div>
    </div>
  );
};
```

## Native Look and Feel

### macOS-Style Interface

```typescript
// src/components/MacOSToolbar.tsx
export const MacOSToolbar = () => {
  return (
    <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-2">
      <button className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">
        Record
      </button>
      <button className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50">
        Stop
      </button>

      <div className="flex-1" />

      <input
        type="search"
        placeholder="Search"
        className="px-3 py-1 border border-gray-300 rounded-full text-sm w-48"
      />
    </div>
  );
};
```

### Windows-Style Ribbon

```typescript
// src/components/WindowsRibbon.tsx
export const WindowsRibbon = () => {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="bg-white border-b">
      {/* Tabs */}
      <div className="flex gap-1 px-2 pt-1">
        <button
          onClick={() => setActiveTab('home')}
          className={`px-4 py-1 ${activeTab === 'home' ? 'bg-white border-t border-x' : ''}`}
        >
          Home
        </button>
        <button
          onClick={() => setActiveTab('recording')}
          className={`px-4 py-1 ${activeTab === 'recording' ? 'bg-white border-t border-x' : ''}`}
        >
          Recording
        </button>
      </div>

      {/* Ribbon content */}
      <div className="p-2 flex gap-4">
        {activeTab === 'home' && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">File</span>
              <div className="flex gap-1">
                <button className="px-3 py-2 hover:bg-gray-100 rounded">New</button>
                <button className="px-3 py-2 hover:bg-gray-100 rounded">Open</button>
                <button className="px-3 py-2 hover:bg-gray-100 rounded">Save</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

## Responsive Desktop Layouts

### Sidebar Navigation

```typescript
// src/layouts/MainLayout.tsx
import { useState } from 'react';
import { Mic, FileText, Settings, History } from 'lucide-react';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`bg-gray-900 text-white ${collapsed ? 'w-16' : 'w-64'} transition-all`}>
        <div className="p-4">
          <button onClick={() => setCollapsed(!collapsed)} className="w-full text-left">
            ☰
          </button>
        </div>

        <nav className="flex flex-col gap-2 p-2">
          <NavItem icon={<Mic />} label="Record" collapsed={collapsed} />
          <NavItem icon={<FileText />} label="Transcripts" collapsed={collapsed} />
          <NavItem icon={<History />} label="History" collapsed={collapsed} />
          <NavItem icon={<Settings />} label="Settings" collapsed={collapsed} />
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};

const NavItem = ({ icon, label, collapsed }: any) => (
  <button className="flex items-center gap-3 px-4 py-2 hover:bg-gray-800 rounded">
    {icon}
    {!collapsed && <span>{label}</span>}
  </button>
);
```

### Resizable Panels

```typescript
// src/components/ResizablePanel.tsx
import { useState, useRef, useEffect } from 'react';

export const ResizablePanel = () => {
  const [leftWidth, setLeftWidth] = useState(300);
  const isDraggingRef = useRef(false);

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingRef.current) {
      setLeftWidth(e.clientX);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div style={{ width: leftWidth }} className="bg-gray-100 overflow-auto">
        <p className="p-4">Left Panel</p>
      </div>

      {/* Divider */}
      <div
        onMouseDown={() => (isDraggingRef.current = true)}
        className="w-1 bg-gray-300 cursor-col-resize hover:bg-blue-500"
      />

      {/* Right panel */}
      <div className="flex-1 bg-white overflow-auto">
        <p className="p-4">Right Panel</p>
      </div>
    </div>
  );
};
```

## Key Takeaways

1. **Multi-Window**: Use for complex workflows, settings dialogs, floating widgets
2. **Custom Title Bar**: Provides consistent branding, requires careful implementation
3. **Native Menus**: Essential for desktop feel, follow platform conventions
4. **Drag and Drop**: Improve workflow efficiency, support file operations
5. **Platform Style**: Match OS design language or create consistent custom design
6. **Responsive**: Support window resizing, collapsible sidebars, resizable panels

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - Window communication patterns
- [05-native-integrations.md](./05-native-integrations.md) - Native features integration
- [08-cross-platform-strategy.md](./08-cross-platform-strategy.md) - Platform-specific UI
