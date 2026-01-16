import { useState, useEffect } from "react";

export const HotkeyConfig = () => {
  const [hotkey, setHotkey] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadHotkey = async () => {
      const settings = await window.electronAPI.getGlobalSettings();
      setHotkey(settings.hotkey);
    };
    loadHotkey();
  }, []);

  const handleRecordHotkey = () => {
    setIsRecording(true);
    setError(null);
    setSuccess(false);
  };

  const handleCancel = () => {
    setIsRecording(false);
    setError(null);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();

    const modifiers: string[] = [];

    // Collect modifiers
    if (e.metaKey) modifiers.push("Command");
    if (e.ctrlKey && !e.metaKey) modifiers.push("Control");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");

    // Get key (excluding modifiers)
    let key = e.key;

    // Map special keys
    if (key === " ") key = "Space";
    else if (key === "ArrowUp") key = "Up";
    else if (key === "ArrowDown") key = "Down";
    else if (key === "ArrowLeft") key = "Left";
    else if (key === "ArrowRight") key = "Right";
    else if (key === "Escape") {
      handleCancel();
      return;
    }
    // For regular keys, uppercase single characters
    else if (key.length === 1) key = key.toUpperCase();

    // Validate: must have at least one modifier
    if (modifiers.length === 0) {
      setError("Please include at least one modifier key (Cmd, Ctrl, Alt, Shift)");
      return;
    }

    // Don't allow just modifier keys
    if (["Meta", "Control", "Alt", "Shift"].includes(key)) {
      return;
    }

    // Build accelerator string
    const newHotkey = [...modifiers, key].join("+");

    // Try to register the hotkey
    const result = await window.electronAPI.registerGlobalHotkey(newHotkey);

    if (result.success) {
      setHotkey(newHotkey);
      await window.electronAPI.saveGlobalSettings({ hotkey: newHotkey });
      setIsRecording(false);
      setSuccess(true);
      setError(null);

      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(
        result.error ||
          "This hotkey conflicts with another application or system shortcut. Please try a different combination."
      );
    }
  };

  return (
    <div className="bg-dark-900 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">Global Hotkey</h3>
      <p className="text-sm text-gray-400 mb-4">
        Press the hotkey to start recording, press again to stop and paste the transcription.
      </p>

      <div className="flex items-center gap-4">
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onClick={handleRecordHotkey}
          className={`flex-1 px-4 py-3 rounded-lg border-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 ${
            isRecording
              ? "border-primary bg-primary/10 animate-pulse focus-visible:ring-blue-500"
              : "border-dark-700 bg-dark-800 hover:border-dark-600 focus-visible:ring-gray-400"
          }`}
        >
          {isRecording ? (
            <span className="text-primary font-medium">
              Press your desired hotkey combination...
            </span>
          ) : (
            <span className="text-white font-mono text-lg">{hotkey}</span>
          )}
        </div>

        {isRecording ? (
          <button
            onClick={handleCancel}
            className="px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-lg text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-950 focus-visible:ring-gray-400"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={handleRecordHotkey}
            className="px-4 py-3 bg-primary hover:bg-primary/80 rounded-lg text-white transition-colors"
          >
            Change
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-3 px-4 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">Hotkey updated successfully!</p>
        </div>
      )}

      <div className="mt-4 p-3 bg-dark-800/50 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong>Tips:</strong> Use combinations like Cmd+Shift+Space or Ctrl+Alt+R. Avoid
          single keys or combinations that conflict with system shortcuts.
        </p>
      </div>
    </div>
  );
};
