import { BrowserWindow, screen } from "electron";
import path from "path";

const isDev = process.env.NODE_ENV === "development" || !require("electron").app.isPackaged;
const isMac = process.platform === "darwin";

export interface OverlayState {
  isRecording: boolean;
  transcriptPreview?: string;
  duration?: number;
  audioLevel?: number; // 0-1 normalized audio level for waveform visualization
}

let overlayWindow: BrowserWindow | null = null;

/**
 * Create the overlay window
 * This is a transparent, always-on-top window that shows recording status
 */
export function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 380,
    height: 70,
    x: screenWidth - 400, // 20px padding from right edge
    y: 20, // 20px padding from top
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false, // Don't steal focus from active app
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // macOS specific
    ...(isMac && {
      vibrancy: "under-window",
      visualEffectState: "active",
    }),
  });

  // Load overlay HTML
  if (isDev) {
    overlayWindow.loadURL("http://localhost:5173/overlay.html");
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../dist/overlay.html"));
  }

  // Start hidden
  overlayWindow.hide();

  // Prevent closing, just hide instead
  overlayWindow.on("close", (event) => {
    event.preventDefault();
    overlayWindow?.hide();
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
}

/**
 * Get the overlay window instance
 */
export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}

/**
 * Show the overlay window
 */
export function showOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
  }
}

/**
 * Hide the overlay window
 */
export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

/**
 * Update the overlay position based on user settings
 */
export function positionOverlay(
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left"
): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowBounds = overlayWindow.getBounds();
  const padding = 20;

  let x: number, y: number;

  switch (position) {
    case "top-left":
      x = padding;
      y = padding;
      break;
    case "top-right":
      x = screenWidth - windowBounds.width - padding;
      y = padding;
      break;
    case "bottom-left":
      x = padding;
      y = screenHeight - windowBounds.height - padding;
      break;
    case "bottom-right":
      x = screenWidth - windowBounds.width - padding;
      y = screenHeight - windowBounds.height - padding;
      break;
  }

  overlayWindow.setPosition(x, y);
}

/**
 * Update overlay state and send to renderer
 */
export function updateOverlayState(state: OverlayState): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay-state-update", state);
  }
}

/**
 * Destroy the overlay window
 */
export function destroyOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
}
