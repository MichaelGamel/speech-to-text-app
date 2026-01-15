# Cross-Platform Strategy

## Overview
Building truly cross-platform Electron apps requires handling differences between macOS and Windows. This document covers platform detection, conditional code patterns, path handling, keyboard shortcuts, and testing strategies.

## Platform Detection

### Runtime Platform Detection

```typescript
// packages/shared/src/utils/platform.ts
export const Platform = {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',

  get current(): 'mac' | 'windows' | 'linux' | 'unknown' {
    if (this.isMac) return 'mac';
    if (this.isWindows) return 'windows';
    if (this.isLinux) return 'linux';
    return 'unknown';
  },

  is(platform: 'mac' | 'windows' | 'linux'): boolean {
    return this.current === platform;
  },
};

// Usage
import { Platform } from '@shared/utils/platform';

if (Platform.isMac) {
  console.log('Running on macOS');
}

console.log('Current platform:', Platform.current);
```

### Build-Time Platform Detection

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __PLATFORM__: JSON.stringify(process.platform),
    __IS_MAC__: process.platform === 'darwin',
    __IS_WINDOWS__: process.platform === 'win32',
  },
});

// Usage in code
if (__IS_MAC__) {
  // This code will be tree-shaken on Windows builds
  setupMacFeatures();
}
```

## Path Handling

### Cross-Platform Paths

```typescript
// packages/shared/src/utils/paths.ts
import path from 'path';
import { app } from 'electron';

export class AppPaths {
  static getUserDataPath(): string {
    return app.getPath('userData');
  }

  static getDocumentsPath(): string {
    return app.getPath('documents');
  }

  static getTempPath(): string {
    return app.getPath('temp');
  }

  static getTranscriptsPath(): string {
    const docsPath = this.getDocumentsPath();
    return path.join(docsPath, 'SpeechToText', 'Transcripts');
  }

  static getResourcePath(filename: string): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'resources', filename);
    }
    return path.join(process.resourcesPath, filename);
  }

  // Convert platform-specific path to universal format
  static normalize(filePath: string): string {
    return path.normalize(filePath);
  }

  // Join paths safely across platforms
  static join(...segments: string[]): string {
    return path.join(...segments);
  }
}

// Usage
const transcriptsDir = AppPaths.getTranscriptsPath();
// macOS: /Users/username/Documents/SpeechToText/Transcripts
// Windows: C:\Users\username\Documents\SpeechToText\Transcripts
```

### File Extensions

```typescript
// packages/shared/src/utils/files.ts
export class FileUtils {
  static getExecutableExtension(): string {
    return Platform.isWindows ? '.exe' : '';
  }

  static getScriptExtension(): string {
    return Platform.isWindows ? '.bat' : '.sh';
  }

  static makeExecutable(filePath: string): string {
    return Platform.isWindows ? filePath : `chmod +x ${filePath}`;
  }
}
```

## Keyboard Shortcuts

### Cross-Platform Shortcut Handling

```typescript
// packages/shared/src/utils/shortcuts.ts
export class Shortcuts {
  static getModifierKey(): 'Cmd' | 'Ctrl' {
    return Platform.isMac ? 'Cmd' : 'Ctrl';
  }

  static format(shortcut: string): string {
    // Replace 'Mod' with platform-specific modifier
    return shortcut.replace('Mod', this.getModifierKey());
  }

  static getShortcutLabel(accelerator: string): string {
    if (Platform.isMac) {
      return accelerator
        .replace('CommandOrControl', '⌘')
        .replace('Command', '⌘')
        .replace('Cmd', '⌘')
        .replace('Control', '⌃')
        .replace('Alt', '⌥')
        .replace('Shift', '⇧');
    }

    return accelerator
      .replace('CommandOrControl', 'Ctrl')
      .replace('Command', 'Ctrl')
      .replace('Cmd', 'Ctrl');
  }
}

// Usage
const saveShortcut = Shortcuts.format('Mod+S'); // 'Cmd+S' on Mac, 'Ctrl+S' on Windows
const label = Shortcuts.getShortcutLabel('CommandOrControl+S'); // '⌘S' on Mac, 'Ctrl+S' on Windows
```

### Platform-Specific Shortcuts

```typescript
// electron/main/shortcuts.ts
import { globalShortcut } from 'electron';
import { Platform } from '@shared/utils/platform';

export const setupPlatformShortcuts = (mainWindow: BrowserWindow) => {
  if (Platform.isMac) {
    // macOS-specific shortcuts
    globalShortcut.register('Cmd+Option+R', () => {
      mainWindow.webContents.send('quick-record');
    });

    // Hide window (macOS convention)
    globalShortcut.register('Cmd+H', () => {
      mainWindow.hide();
    });
  } else if (Platform.isWindows) {
    // Windows-specific shortcuts
    globalShortcut.register('Ctrl+Alt+R', () => {
      mainWindow.webContents.send('quick-record');
    });

    // Minimize window (Windows convention)
    globalShortcut.register('Ctrl+M', () => {
      mainWindow.minimize();
    });
  }

  // Universal shortcuts
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    mainWindow.webContents.send('start-recording');
  });
};
```

## UI Adaptations

### Platform-Specific Styles

```typescript
// src/utils/platformStyles.ts
import { Platform } from '@shared/utils/platform';

export const platformStyles = {
  titleBar: {
    height: Platform.isMac ? 28 : 32,
    paddingLeft: Platform.isMac ? 70 : 10, // Space for macOS traffic lights
  },

  button: {
    borderRadius: Platform.isMac ? 6 : 4,
    padding: Platform.isMac ? '6px 16px' : '8px 16px',
  },

  window: {
    backgroundColor: Platform.isMac ? '#f5f5f5' : '#ffffff',
  },
};

// Usage in components
export const CustomButton = ({ children }: { children: React.ReactNode }) => (
  <button
    style={{
      borderRadius: platformStyles.button.borderRadius,
      padding: platformStyles.button.padding,
    }}
  >
    {children}
  </button>
);
```

### Conditional Components

```typescript
// src/components/PlatformSpecific.tsx
import { Platform } from '@shared/utils/platform';

export const TitleBar = () => {
  if (Platform.isMac) {
    return <MacOSTitleBar />;
  }

  if (Platform.isWindows) {
    return <WindowsTitleBar />;
  }

  return <DefaultTitleBar />;
};

const MacOSTitleBar = () => (
  <div className="h-7 bg-gray-100 drag-region">
    <div className="pl-20 pt-1 text-sm text-gray-700">Speech to Text</div>
  </div>
);

const WindowsTitleBar = () => (
  <div className="h-8 bg-white border-b flex items-center justify-between drag-region">
    <div className="pl-3 text-sm">Speech to Text</div>
    <WindowControls />
  </div>
);
```

### Platform-Specific Rendering

```tsx
// src/components/PlatformRenderer.tsx
interface PlatformRendererProps {
  mac?: React.ReactNode;
  windows?: React.ReactNode;
  linux?: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PlatformRenderer = ({ mac, windows, linux, fallback }: PlatformRendererProps) => {
  if (Platform.isMac && mac) return <>{mac}</>;
  if (Platform.isWindows && windows) return <>{windows}</>;
  if (Platform.isLinux && linux) return <>{linux}</>;
  return <>{fallback}</>;
};

// Usage
<PlatformRenderer
  mac={<div className="rounded-lg">macOS UI</div>}
  windows={<div className="rounded-sm">Windows UI</div>}
  fallback={<div>Default UI</div>}
/>
```

## Application Menu Differences

### Platform-Specific Menus

```typescript
// electron/main/menu.ts
import { Menu, app } from 'electron';
import { Platform } from '@shared/utils/platform';

export const createApplicationMenu = (mainWindow: BrowserWindow) => {
  const template: Electron.MenuItemConstructorOptions[] = [];

  // macOS: App menu
  if (Platform.isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => mainWindow.webContents.send('open-settings'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  // File menu
  template.push({
    label: 'File',
    submenu: [
      {
        label: 'New Recording',
        accelerator: 'CommandOrControl+N',
        click: () => mainWindow.webContents.send('new-recording'),
      },
      { type: 'separator' },
      // Windows: Settings in File menu
      ...(!Platform.isMac
        ? [
            {
              label: 'Settings',
              accelerator: 'Ctrl+,',
              click: () => mainWindow.webContents.send('open-settings'),
            },
            { type: 'separator' },
          ]
        : []),
      // macOS: Close window, Windows: Exit app
      Platform.isMac ? { role: 'close' as const } : { role: 'quit' as const },
    ],
  });

  // Window menu (macOS only)
  if (Platform.isMac) {
    template.push({
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
```

## Window Behavior

### Platform-Specific Window Management

```typescript
// electron/main/window-behavior.ts
import { BrowserWindow, app } from 'electron';
import { Platform } from '@shared/utils/platform';

export class WindowBehavior {
  static setupCloseHandler(window: BrowserWindow) {
    window.on('close', (event) => {
      if (Platform.isMac) {
        // macOS: Hide instead of close
        event.preventDefault();
        window.hide();
      } else {
        // Windows: Actually close and quit
        app.quit();
      }
    });
  }

  static setupMinimizeToTray(window: BrowserWindow) {
    if (Platform.isWindows) {
      window.on('minimize', (event) => {
        event.preventDefault();
        window.hide(); // Minimize to tray on Windows
      });
    }
    // macOS: Use dock minimize
  }

  static setupActivation() {
    app.on('activate', () => {
      if (Platform.isMac) {
        // macOS: Restore window when clicking dock icon
        const windows = BrowserWindow.getAllWindows();
        if (windows.length === 0) {
          createMainWindow();
        } else {
          windows[0].show();
        }
      }
    });
  }

  static setupQuitHandler() {
    app.on('window-all-closed', () => {
      if (!Platform.isMac) {
        // Windows/Linux: Quit when all windows closed
        app.quit();
      }
      // macOS: Keep app running
    });
  }
}
```

## Native Module Handling

### Platform-Specific Native Dependencies

```json
// package.json
{
  "optionalDependencies": {
    "macos-audio-devices": "^1.0.0",
    "windows-audio-api": "^1.0.0"
  }
}
```

```typescript
// electron/services/audio/audio-devices.ts
import { Platform } from '@shared/utils/platform';

let audioDeviceAPI: any;

if (Platform.isMac) {
  try {
    audioDeviceAPI = require('macos-audio-devices');
  } catch (error) {
    console.warn('macOS audio module not available');
  }
} else if (Platform.isWindows) {
  try {
    audioDeviceAPI = require('windows-audio-api');
  } catch (error) {
    console.warn('Windows audio module not available');
  }
}

export const getAudioDevices = async () => {
  if (audioDeviceAPI) {
    return await audioDeviceAPI.getDevices();
  }

  // Fallback to web API
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'audioinput');
};
```

## Testing Strategy

### Cross-Platform Testing

```typescript
// tests/platform.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Platform } from '../src/utils/platform';

describe('Platform Detection', () => {
  it('should detect macOS', () => {
    vi.stubGlobal('process', { platform: 'darwin' });
    expect(Platform.current).toBe('mac');
  });

  it('should detect Windows', () => {
    vi.stubGlobal('process', { platform: 'win32' });
    expect(Platform.current).toBe('windows');
  });
});

describe('Path Handling', () => {
  it('should handle macOS paths', () => {
    vi.stubGlobal('process', { platform: 'darwin' });
    const path = AppPaths.getDocumentsPath();
    expect(path).toContain('/Users/');
  });

  it('should handle Windows paths', () => {
    vi.stubGlobal('process', { platform: 'win32' });
    const path = AppPaths.getDocumentsPath();
    expect(path).toContain('C:\\Users\\');
  });
});
```

### Manual Testing Checklist

```markdown
## Cross-Platform Testing Checklist

### macOS
- [ ] App launches correctly
- [ ] Menu bar shows app name
- [ ] Cmd+Q quits the app
- [ ] Cmd+H hides the app
- [ ] Clicking dock icon shows hidden window
- [ ] Traffic lights work correctly
- [ ] All shortcuts use Cmd key
- [ ] File dialogs use macOS style
- [ ] Notifications work correctly

### Windows
- [ ] App launches correctly
- [ ] Title bar shows correctly
- [ ] Alt+F4 closes the app
- [ ] System tray icon appears
- [ ] All shortcuts use Ctrl key
- [ ] File dialogs use Windows style
- [ ] Notifications work correctly
- [ ] Installer works correctly
- [ ] Auto-update works correctly

### Both Platforms
- [ ] Audio recording works
- [ ] File save/open works
- [ ] Settings persist correctly
- [ ] Keyboard shortcuts work
- [ ] Drag and drop works
- [ ] Copy/paste works
- [ ] Window state persists
```

## Configuration Management

### Platform-Specific Configs

```typescript
// electron/config/platform-config.ts
import { Platform } from '@shared/utils/platform';

interface PlatformConfig {
  audioBufferSize: number;
  maxFileSize: number;
  defaultTheme: 'light' | 'dark' | 'system';
}

const macConfig: PlatformConfig = {
  audioBufferSize: 4096,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  defaultTheme: 'system',
};

const windowsConfig: PlatformConfig = {
  audioBufferSize: 2048,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  defaultTheme: 'light',
};

export const platformConfig: PlatformConfig = Platform.isMac ? macConfig : windowsConfig;
```

## Key Takeaways

1. **Abstract Platform Differences**: Use utility functions for platform detection
2. **Path Handling**: Always use path.join(), never string concatenation
3. **Keyboard Shortcuts**: Use CommandOrControl for universal shortcuts
4. **UI Adaptation**: Respect platform conventions (menu placement, window behavior)
5. **Testing**: Test on both platforms before release
6. **Graceful Degradation**: Provide fallbacks when platform-specific features unavailable

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - Platform-specific IPC
- [05-native-integrations.md](./05-native-integrations.md) - Platform-specific features
- [07-build-deployment.md](./07-build-deployment.md) - Platform-specific builds
