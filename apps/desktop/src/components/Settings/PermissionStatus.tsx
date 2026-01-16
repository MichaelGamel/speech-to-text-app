import { useState, useEffect } from "react";
import type {
  PermissionState,
  PermissionStatus as PermissionStatusType,
} from "../../types/electron";

export const PermissionStatus = () => {
  const [permissions, setPermissions] = useState<PermissionState>({
    microphone: "not-determined",
    accessibility: "not-determined",
  });
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    setIsChecking(true);
    try {
      const perms = await window.electronAPI.getAllPermissions();
      setPermissions(perms);
    } catch (error) {
      console.error("Failed to check permissions:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = (status: PermissionStatusType): string => {
    switch (status) {
      case "granted":
        return "bg-green-500";
      case "denied":
      case "restricted":
        return "bg-red-500";
      case "not-determined":
      default:
        return "bg-yellow-500";
    }
  };

  const getStatusText = (status: PermissionStatusType): string => {
    switch (status) {
      case "granted":
        return "Granted";
      case "denied":
        return "Denied";
      case "restricted":
        return "Restricted";
      case "not-determined":
      default:
        return "Not Determined";
    }
  };

  const handleRequestAccessibility = async () => {
    const result = await window.electronAPI.requestAccessibilityPermission();
    if (!result.granted) {
      // Permission not immediately granted, user needs to manually enable it
      await window.electronAPI.openAccessibilityPreferences();
    }

    // Re-check after a delay
    setTimeout(() => {
      checkPermissions();
    }, 1000);
  };

  const handleOpenMicrophoneSettings = async () => {
    await window.electronAPI.openMicrophonePreferences();

    // Re-check after a delay
    setTimeout(() => {
      checkPermissions();
    }, 1000);
  };

  if (isChecking) {
    return (
      <div className="bg-dark-900 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Permissions</h3>
        <p className="text-sm text-gray-400">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="bg-dark-900 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">Permissions</h3>
      <p className="text-sm text-gray-400 mb-4">
        Required permissions for speech-to-text functionality.
      </p>

      <div className="space-y-4">
        {/* Microphone Permission */}
        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(permissions.microphone)}`} />
              <div>
                <p className="font-medium">Microphone Access</p>
                <p className="text-sm text-gray-400">Required for audio recording</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">{getStatusText(permissions.microphone)}</span>
            {permissions.microphone !== "granted" && (
              <button
                onClick={handleOpenMicrophoneSettings}
                className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 focus-visible:ring-blue-500"
              >
                Configure
              </button>
            )}
          </div>
        </div>

        {/* Accessibility Permission */}
        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${getStatusColor(permissions.accessibility)}`}
              />
              <div>
                <p className="font-medium">Accessibility Access</p>
                <p className="text-sm text-gray-400">
                  Required for text injection (simulating Cmd+V)
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300">
              {getStatusText(permissions.accessibility)}
            </span>
            {permissions.accessibility !== "granted" && (
              <button
                onClick={handleRequestAccessibility}
                className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 focus-visible:ring-blue-500"
              >
                Grant Access
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Warning if accessibility is not granted */}
      {permissions.accessibility !== "granted" && (
        <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <div className="flex gap-3">
            <div className="text-yellow-500 text-xl">⚠️</div>
            <div>
              <p className="text-sm text-yellow-400 font-medium mb-1">
                Accessibility Permission Required
              </p>
              <p className="text-xs text-yellow-400/80">
                To enable text injection, you need to grant Accessibility access. Click "Grant
                Access" above, then enable this app in{" "}
                <strong>System Preferences → Privacy & Security → Accessibility</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info about what happens without accessibility */}
      {permissions.accessibility !== "granted" && (
        <div className="mt-3 p-3 bg-dark-800/50 rounded-lg">
          <p className="text-xs text-gray-400">
            <strong>Without Accessibility permission:</strong> Transcriptions will be copied to
            your clipboard instead of being automatically pasted.
          </p>
        </div>
      )}

      {/* Success state */}
      {permissions.microphone === "granted" && permissions.accessibility === "granted" && (
        <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">
            ✓ All permissions granted! Global speech-to-text is ready to use.
          </p>
        </div>
      )}
    </div>
  );
};
