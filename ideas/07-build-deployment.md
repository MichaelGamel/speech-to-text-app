# Build and Deployment Strategies

## Overview
This document covers building, packaging, code signing, and distributing Electron applications for macOS and Windows. It includes electron-builder configuration, auto-update mechanisms, and CI/CD pipeline setup.

## electron-builder Configuration

### Base Configuration

```json
// package.json
{
  "name": "speech-to-text-app",
  "version": "1.0.0",
  "main": "dist-electron/main/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "build:mac": "npm run build -- --mac",
    "build:win": "npm run build -- --win",
    "build:all": "npm run build -- --mac --win"
  },
  "build": {
    "appId": "com.example.speechtotext",
    "productName": "Speech to Text",
    "copyright": "Copyright © 2026 ${author}",
    "directories": {
      "buildResources": "assets",
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json"
    ],
    "extraResources": [
      {
        "from": "resources",
        "to": "resources",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64", "universal"]
        },
        {
          "target": "zip",
          "arch": ["x64", "arm64", "universal"]
        }
      ],
      "icon": "assets/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "dmg": {
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link",
          "path": "/Applications"
        }
      ],
      "window": {
        "width": 540,
        "height": 380
      }
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "portable",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "artifactName": "${productName}-${version}-${os}-${arch}.${ext}"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Speech to Text"
    },
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "speech-to-text-app"
    }
  }
}
```

### Advanced Build Scripts

```javascript
// scripts/build.js
const builder = require('electron-builder');
const Platform = builder.Platform;

async function build() {
  const platform = process.env.BUILD_PLATFORM || 'current';

  const config = {
    config: {
      appId: 'com.example.speechtotext',
      productName: 'Speech to Text',
      // ... configuration from package.json
    },
  };

  if (platform === 'mac') {
    await builder.build({
      targets: Platform.MAC.createTarget(),
      config: config.config,
    });
  } else if (platform === 'win') {
    await builder.build({
      targets: Platform.WINDOWS.createTarget(),
      config: config.config,
    });
  } else if (platform === 'all') {
    await builder.build({
      targets: Platform.MAC.createTarget().concat(Platform.WINDOWS.createTarget()),
      config: config.config,
    });
  } else {
    // Build for current platform
    await builder.build({
      config: config.config,
    });
  }
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

## Code Signing

### macOS Code Signing

#### Prerequisites
1. Apple Developer Account ($99/year)
2. Developer ID Application certificate
3. Developer ID Installer certificate (for .pkg)

#### Entitlements Configuration

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

#### Notarization Script

```javascript
// scripts/notarize.js
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    tool: 'notarytool',
    appBundleId: 'com.example.speechtotext',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

```json
// package.json - add notarization hook
{
  "build": {
    "afterSign": "scripts/notarize.js",
    "mac": {
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    }
  }
}
```

#### Environment Variables

```bash
# .env.local (DO NOT COMMIT)
APPLE_ID=your-apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX

# Certificate identity
CSC_LINK=/path/to/certificate.p12
CSC_KEY_PASSWORD=your-certificate-password
```

### Windows Code Signing

#### Prerequisites
1. Code signing certificate (from DigiCert, Sectigo, etc.)
2. Certificate in .pfx or .p12 format

#### Configuration

```json
// package.json
{
  "build": {
    "win": {
      "sign": "./scripts/sign-windows.js",
      "signingHashAlgorithms": ["sha256"],
      "certificateFile": "./certs/certificate.pfx",
      "certificatePassword": "env:WIN_CSC_KEY_PASSWORD"
    }
  }
}
```

```javascript
// scripts/sign-windows.js
const { execFile } = require('child_process');
const path = require('path');

exports.default = async function (configuration) {
  const signtoolPath = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe';

  return new Promise((resolve, reject) => {
    execFile(
      signtoolPath,
      [
        'sign',
        '/f',
        configuration.certificateFile,
        '/p',
        process.env.WIN_CSC_KEY_PASSWORD,
        '/tr',
        'http://timestamp.digicert.com',
        '/td',
        'sha256',
        '/fd',
        'sha256',
        configuration.path,
      ],
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
};
```

## Distribution Strategies

### Strategy 1: Direct Download

Host installers on your website or CDN.

```typescript
// electron/main/auto-updater.ts
import { autoUpdater } from 'electron-updater';

export const setupAutoUpdater = () => {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://releases.example.com/speech-to-text',
  });

  autoUpdater.checkForUpdatesAndNotify();
};
```

### Strategy 2: GitHub Releases

```json
// package.json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "your-username",
      "repo": "speech-to-text-app",
      "releaseType": "release"
    }
  }
}
```

```typescript
// electron/main/auto-updater.ts
import { autoUpdater } from 'electron-updater';

export const setupAutoUpdater = () => {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'your-username',
    repo: 'speech-to-text-app',
  });

  autoUpdater.checkForUpdatesAndNotify();
};
```

### Strategy 3: Mac App Store

```json
// package.json
{
  "build": {
    "mac": {
      "target": ["mas", "mas-dev"],
      "category": "public.app-category.productivity",
      "provisioningProfile": "build/embedded.provisionprofile",
      "entitlements": "build/entitlements.mas.plist",
      "entitlementsInherit": "build/entitlements.mas.inherit.plist"
    }
  }
}
```

```xml
<!-- build/entitlements.mas.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
```

### Strategy 4: Microsoft Store

```json
// package.json
{
  "build": {
    "win": {
      "target": ["appx"]
    },
    "appx": {
      "applicationId": "YourCompany.SpeechToText",
      "backgroundColor": "#1e1e1e",
      "displayName": "Speech to Text",
      "identityName": "12345YourCompany.SpeechToText",
      "publisher": "CN=12345678-1234-1234-1234-123456789012",
      "publisherDisplayName": "Your Company"
    }
  }
}
```

## Auto-Update Implementation

### electron-updater Setup

```typescript
// electron/main/auto-updater.ts
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

export class AutoUpdater {
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupLogging();
    this.setupEventHandlers();
  }

  private setupLogging() {
    autoUpdater.logger = log;
    log.transports.file.level = 'info';
  }

  private setupEventHandlers() {
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus('Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      this.sendStatus('Update available');
      this.mainWindow.webContents.send('update-available', info);
    });

    autoUpdater.on('update-not-available', () => {
      this.sendStatus('App is up to date');
    });

    autoUpdater.on('error', (err) => {
      this.sendStatus('Error in auto-updater: ' + err);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.mainWindow.webContents.send('download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.showUpdateDialog(info);
    });
  }

  private sendStatus(text: string) {
    log.info(text);
    this.mainWindow.webContents.send('update-status', text);
  }

  private async showUpdateDialog(info: any) {
    const { response } = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available`,
      detail: 'The update will be installed after you restart the application.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  }

  checkForUpdates() {
    if (process.env.NODE_ENV === 'development') {
      log.info('Skipping update check in development');
      return;
    }

    autoUpdater.checkForUpdatesAndNotify();
  }

  checkForUpdatesManually() {
    autoUpdater.checkForUpdates();
  }
}

// Usage in main.ts
const updater = new AutoUpdater(mainWindow);

// Check on app start
app.whenReady().then(() => {
  updater.checkForUpdates();
});

// Check every 4 hours
setInterval(() => {
  updater.checkForUpdates();
}, 4 * 60 * 60 * 1000);
```

### Update UI in Renderer

```typescript
// src/components/UpdateNotification.tsx
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseDate: string;
}

export const UpdateNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    window.electronAPI.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateAvailable(true);
      setUpdateInfo(info);
    });

    window.electronAPI.onDownloadProgress((progress: { percent: number }) => {
      setDownloadProgress(progress.percent);
    });
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg">
      <div className="flex items-center gap-3">
        <Download size={24} />
        <div>
          <p className="font-medium">Update available: v{updateInfo?.version}</p>
          {downloadProgress > 0 && (
            <div className="mt-2">
              <div className="w-48 h-2 bg-blue-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-sm mt-1">{Math.floor(downloadProgress)}% downloaded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-macos:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Sign and Notarize
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
        run: pnpm electron-builder --mac --publish never

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: macos-build
          path: release/*.dmg

  build-windows:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - name: Sign
        env:
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
        run: pnpm electron-builder --win --publish never

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: windows-build
          path: release/*.exe

  release:
    needs: [build-macos, build-windows]
    runs-on: ubuntu-latest

    steps:
      - uses: actions/download-artifact@v3

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            macos-build/*
            windows-build/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Key Takeaways

1. **electron-builder**: Powerful, configure for all platforms in one place
2. **Code Signing**: Mandatory for macOS (notarization), recommended for Windows
3. **Auto-Updates**: Use electron-updater for seamless updates
4. **Distribution**: Choose based on audience (direct, stores, enterprise)
5. **CI/CD**: Automate builds and releases with GitHub Actions
6. **Testing**: Test signed builds before release, can't test in development

## Related Documents
- [08-cross-platform-strategy.md](./08-cross-platform-strategy.md) - Platform-specific builds
- [09-security-best-practices.md](./09-security-best-practices.md) - Secure update mechanism
