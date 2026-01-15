import { systemPreferences, shell } from "electron";

export type PermissionStatus = "granted" | "denied" | "not-determined" | "restricted";

export interface PermissionState {
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
}

const isMac = process.platform === "darwin";

class PermissionManager {
  /**
   * Check microphone permission status
   */
  checkMicrophonePermission(): PermissionStatus {
    if (!isMac) {
      return "granted"; // Windows/Linux handle permissions differently
    }

    const status = systemPreferences.getMediaAccessStatus("microphone");
    return this.mapMediaAccessStatus(status);
  }

  /**
   * Request microphone permission (macOS only)
   * Returns true if permission was granted
   */
  async requestMicrophonePermission(): Promise<boolean> {
    if (!isMac) {
      return true;
    }

    const currentStatus = this.checkMicrophonePermission();
    if (currentStatus === "granted") {
      return true;
    }

    if (currentStatus === "denied" || currentStatus === "restricted") {
      // Cannot re-request, user must manually enable in System Preferences
      return false;
    }

    // Request permission
    return systemPreferences.askForMediaAccess("microphone");
  }

  /**
   * Check accessibility permission status (required for text injection)
   * This is needed to simulate keystrokes via AppleScript
   */
  checkAccessibilityPermission(): PermissionStatus {
    if (!isMac) {
      return "granted"; // Only macOS requires explicit accessibility permission
    }

    // Check without prompting the user
    const isTrusted = systemPreferences.isTrustedAccessibilityClient(false);
    return isTrusted ? "granted" : "denied";
  }

  /**
   * Request accessibility permission
   * This shows a system dialog prompting the user to grant accessibility access
   * Returns true if permission is already granted, false if user needs to grant it
   */
  requestAccessibilityPermission(): boolean {
    if (!isMac) {
      return true;
    }

    // This will show a system prompt if not already trusted
    // The prompt asks the user to go to System Preferences
    return systemPreferences.isTrustedAccessibilityClient(true);
  }

  /**
   * Open System Preferences to the Accessibility privacy pane
   * This is useful when the user needs to manually grant permission
   */
  async openAccessibilityPreferences(): Promise<void> {
    if (!isMac) {
      return;
    }

    // Open directly to the Accessibility section of Privacy & Security
    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    );
  }

  /**
   * Open System Preferences to the Microphone privacy pane
   */
  async openMicrophonePreferences(): Promise<void> {
    if (!isMac) {
      return;
    }

    await shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
    );
  }

  /**
   * Get the current state of all permissions
   */
  getAllPermissions(): PermissionState {
    return {
      microphone: this.checkMicrophonePermission(),
      accessibility: this.checkAccessibilityPermission(),
    };
  }

  /**
   * Check if all required permissions are granted
   */
  hasAllRequiredPermissions(): boolean {
    const state = this.getAllPermissions();
    return state.microphone === "granted" && state.accessibility === "granted";
  }

  /**
   * Map Electron's media access status to our permission status type
   */
  private mapMediaAccessStatus(
    status: "not-determined" | "granted" | "denied" | "restricted" | "unknown"
  ): PermissionStatus {
    switch (status) {
      case "granted":
        return "granted";
      case "denied":
        return "denied";
      case "restricted":
        return "restricted";
      case "not-determined":
      case "unknown":
      default:
        return "not-determined";
    }
  }
}

// Singleton instance
let permissionManagerInstance: PermissionManager | null = null;

export function getPermissionManager(): PermissionManager {
  if (!permissionManagerInstance) {
    permissionManagerInstance = new PermissionManager();
  }
  return permissionManagerInstance;
}

export type { PermissionManager };
