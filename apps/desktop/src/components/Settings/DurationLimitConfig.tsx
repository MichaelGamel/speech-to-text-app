import { useState, useEffect } from "react";

// Preset duration options in seconds
const DURATION_OPTIONS = [
  { value: 60, label: "1 minute" },
  { value: 120, label: "2 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
  { value: 0, label: "No limit" },
];

export const DurationLimitConfig = () => {
  const [duration, setDuration] = useState<number>(300); // Default 5 minutes
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await window.electronAPI.getGlobalSettings();
        setDuration(settings.maxRecordingDuration);
      } catch (err) {
        setError("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleDurationChange = async (newDuration: number) => {
    setError(null);
    setSuccess(false);

    try {
      const result = await window.electronAPI.saveGlobalSettings({
        maxRecordingDuration: newDuration,
      });

      if (result.success) {
        setDuration(newDuration);
        setSuccess(true);
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || "Failed to save setting");
      }
    } catch (err) {
      setError("Failed to save setting");
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return "No limit";
    const minutes = Math.floor(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  };

  return (
    <div className="bg-dark-900 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">Recording Duration Limit</h3>
      <p className="text-sm text-gray-400 mb-4">
        Set a maximum duration for recordings. Recording will automatically stop when this limit is
        reached.
      </p>

      <div className="flex items-center gap-4">
        <select
          value={duration}
          onChange={(e) => handleDurationChange(Number(e.target.value))}
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-dark-700 bg-dark-800 text-white font-medium cursor-pointer transition-colors hover:border-dark-600 focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {DURATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="px-4 py-3 bg-dark-800 rounded-lg">
          <span className="text-gray-400 text-sm">Current:</span>{" "}
          <span className="text-white font-mono">{formatDuration(duration)}</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-3 px-4 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
          <p className="text-sm text-green-400">Duration limit updated successfully!</p>
        </div>
      )}

      <div className="mt-4 p-3 bg-dark-800/50 rounded-lg">
        <p className="text-xs text-gray-400">
          <strong>Tips:</strong> Set a duration limit to prevent accidentally leaving recordings
          running. Choose "No limit" if you prefer to manually stop all recordings. The default is 5
          minutes.
        </p>
      </div>
    </div>
  );
};
