# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-platform speech-to-text Electron desktop application built with React, TypeScript, and Vite in a pnpm monorepo using Turborepo for build orchestration.

**Stack:**
- Electron 34.0.1
- React 19.0.0
- TypeScript 5.7.3 (strict mode)
- Vite 6.0.7
- Tailwind CSS 3.x
- Turbo 2.3.3
- pnpm 9.15.4

## Development Commands

```bash
# Development
pnpm dev                    # Run all apps in dev mode via Turbo
cd apps/desktop && pnpm electron:dev  # Run desktop app with Electron

# Building
pnpm build                  # Build all packages and apps
pnpm typecheck              # Type check all packages

# Cleaning
pnpm clean                  # Clean all build artifacts and node_modules
```

## Architecture

### Electron Process Model

This project follows strict **process separation**:

- **Main Process** (`apps/desktop/electron/main.ts`): Node.js backend handling OS integration, file system, IPC handlers
- **Renderer Process** (`apps/desktop/src/`): React frontend with UI and display logic
- **Preload Script** (`apps/desktop/electron/preload.ts`): Security bridge between main and renderer

### Critical Security Pattern

**NEVER expose generic IPC methods.** The preload script must expose only specific, type-safe APIs:

```typescript
// ❌ NEVER DO THIS - Security vulnerability
contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data)
});

// ✅ ALWAYS DO THIS - Specific, typed methods
contextBridge.exposeInMainWorld('electronAPI', {
  saveTranscript: (text: string) => ipcRenderer.invoke('save-transcript', text)
});
```

### IPC Communication Patterns

**Pattern 1 - Request/Response** (one-way async operations):
- Renderer: `window.electronAPI.methodName(args)`
- Preload: `ipcRenderer.invoke('channel', args)`
- Main: `ipcMain.handle('channel', async (_event, args) => { ... })`

**Pattern 2 - Event Streaming** (real-time updates from main to renderer):
- Main: `window.webContents.send('event-name', data)`
- Preload: `ipcRenderer.on('event-name', (_event, data) => callback(data))`
- Renderer: Subscribe via exposed methods, unsubscribe in useEffect cleanup

### Type Safety

All IPC APIs are defined in `apps/desktop/src/types/electron.d.ts`:
- Defines `ElectronAPI` interface
- Augments `Window` interface globally
- Ensures type safety across process boundary

### Styling with Tailwind CSS

The app uses **Tailwind CSS v3** with a utility-first approach:
- Custom colors defined in `tailwind.config.js`:
  - `dark-950`: #1a1a1a (main background)
  - `dark-900`: #2a2a2a (card background)
  - `dark-800`: #3a3a3a (button background)
  - `primary`: #007aff (iOS blue)
  - `recording`: #ff3b30 (recording red)
- Usage: `bg-dark-950`, `bg-dark-900`, `bg-primary`, `bg-recording`
- PostCSS processes Tailwind directives via `postcss.config.js`
- Electron-specific `-webkit-app-region` styles preserved in CSS
- Custom animation: `animate-pulse-recording` for recording button

### Build Configuration

**Vite** builds both renderer and Electron code:
- `vite-plugin-electron`: Compiles main.ts and preload.ts
- `vite-plugin-electron-renderer`: Enables Node.js in renderer during dev
- PostCSS with Tailwind CSS for styling
- Output: `dist/` (renderer), `dist-electron/` (main/preload)

**electron-builder**: Packages the app (config in `apps/desktop/package.json`)

## Monorepo Structure

```
speech-to-text-app/
├── apps/
│   └── desktop/           # Electron app
│       ├── electron/      # Main process & preload
│       └── src/           # React renderer
├── packages/
│   └── ui/               # Shared React components
├── ideas/                # Implementation documentation
├── turbo.json           # Build pipeline config
└── pnpm-workspace.yaml  # Workspace definition
```

Workspaces use `workspace:*` protocol for internal dependencies.

## Key Files

### Electron Entry Points

- `apps/desktop/electron/main.ts`: Main process entry, window creation, IPC handlers, lifecycle management
- `apps/desktop/electron/preload.ts`: Secure API exposure via contextBridge
- `apps/desktop/src/types/electron.d.ts`: TypeScript definitions for Electron APIs

### Window State Management

Window position, size, and maximize state are persisted to `window-state.json` in userData directory and restored on launch.

### Platform-Specific Code

Platform detection is done at the top of main.ts:
```typescript
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';
```

macOS-specific: Traffic light positioning, keep-alive when all windows closed
Windows/Linux: Quit when all windows closed

## Implementation Guidelines

### Adding IPC Handlers

1. Define method in `electron.d.ts` interface
2. Expose in `preload.ts` with `ipcRenderer.invoke()`
3. Implement handler in `main.ts` with `ipcMain.handle()`
4. Always validate inputs in main process
5. Return structured results with error handling

### Input Validation

All IPC handlers must validate inputs:
```typescript
ipcMain.handle('save-transcript', async (_event, text: string) => {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Invalid transcript text');
  }
  // Process validated input
});
```

### Cross-Platform Paths

Always use `path.join()` for file paths, never string concatenation:
```typescript
import path from 'path';
const filePath = path.join(app.getPath('documents'), 'Transcripts', 'file.txt');
```

### React Patterns

- Use functional components with hooks
- Feature-based organization (components, hooks, stores together)
- Event listeners in useEffect with cleanup in return function
- TypeScript strict mode throughout

### Styling Patterns

- Use Tailwind CSS utility classes for all styling
- Custom colors defined in `tailwind.config.js` (JavaScript config)
- Available utilities: `bg-dark-950`, `bg-dark-900`, `bg-dark-800`, `bg-primary`, `bg-recording`
- Preserve Electron draggable regions with `app`, `app-header`, `app-main` classes
- Use `animate-pulse-recording` for recording button animation
- Follow dark theme color scheme throughout
- To add new theme values: extend theme in `tailwind.config.js`

## Ideas Directory

The `ideas/` directory contains comprehensive implementation guides:

1. **01-architecture-patterns.md**: Process separation, IPC patterns, lifecycle management ← **Read this first**
2. **03-project-structure.md**: Monorepo organization, module structure
3. **04-speech-to-text-features.md**: Audio capture, transcription APIs
4. **05-native-integrations.md**: System tray, shortcuts, notifications
5. **08-cross-platform-strategy.md**: Platform differences, testing

These documents provide production-ready code examples following security best practices.

## TODO Items in Codebase

The current implementation includes placeholder TODOs for:
- Actual audio recording implementation (currently simulated)
- Real transcription engine integration (Whisper, OpenAI, etc.)
- Settings persistence using electron-store
- Audio device enumeration via native APIs
- Temporary file cleanup

## TypeScript Configuration

- Root config: ES2022, strict mode, ESNext modules
- Desktop app extends root with React JSX support
- Path aliases: `@/*` maps to `apps/desktop/src/*`
- All packages use `moduleResolution: "bundler"`

## Graceful Shutdown

The app implements before-quit handler to:
- Stop active recordings
- Save window state
- Close database connections (when implemented)
- Clean temporary files (when implemented)
