import { useState, useEffect } from "react";

export const ApiKeyConfig = () => {
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const hasKey = await window.electronAPI.hasApiKey();
    setHasApiKey(hasKey);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError("API key cannot be empty");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await window.electronAPI.saveApiKey(apiKey);

      if (result.success) {
        setSuccess(true);
        setHasApiKey(true);
        setIsEditing(false);
        setApiKey(""); // Clear the input

        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError(result.error || "Failed to save API key");
      }
    } catch (err) {
      setError("Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Are you sure you want to remove the API key? You'll need to re-enter it to use Deepgram.")) {
      return;
    }

    try {
      await window.electronAPI.clearApiKey();
      setHasApiKey(false);
      setApiKey("");
      setIsEditing(false);
    } catch (err) {
      setError("Failed to clear API key");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setApiKey("");
    setError(null);
  };

  return (
    <div className="bg-dark-900 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-2">Deepgram API Key</h3>
      <p className="text-sm text-gray-400 mb-4">
        For real-time streaming transcription. Leave empty to use offline Whisper mode.
      </p>

      {!isEditing ? (
        // Display mode
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${hasApiKey ? "bg-green-500" : "bg-gray-500"}`}
                role="status"
                aria-label={hasApiKey ? "API key configured" : "No API key configured"}
              />
              <div>
                <p className="font-medium">{hasApiKey ? "API Key Saved" : "No API Key"}</p>
                <p className="text-sm text-gray-400">
                  {hasApiKey
                    ? "Streaming mode enabled"
                    : "Will use offline Whisper fallback"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasApiKey ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded transition-colors"
                  >
                    Update
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded transition-colors"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/80 text-white text-sm rounded transition-colors"
                >
                  Add API Key
                </button>
              )}
            </div>
          </div>

          {/* Info about getting an API key */}
          <div className="p-3 bg-dark-800/50 rounded-lg">
            <p className="text-xs text-gray-400 mb-2">
              <strong>Don't have an API key?</strong>
            </p>
            <p className="text-xs text-gray-400">
              Sign up at{" "}
              <a
                href="https://deepgram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                deepgram.com
              </a>{" "}
              to get started with real-time transcription. Free tier includes $200 credit.
            </p>
          </div>
        </div>
      ) : (
        // Edit mode
        <div className="space-y-4">
          <div>
            <label htmlFor="api-key-input" className="block text-sm font-medium mb-2">API Key</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Deepgram API key"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
              autoFocus
              aria-describedby="api-key-description"
              aria-label="Deepgram API key (password field - characters are hidden)"
            />
            <p id="api-key-description" className="text-xs text-gray-400 mt-2">
              Your API key is stored securely and encrypted on your device.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="px-4 py-2 bg-red-900/20 border border-red-500/30 rounded-lg"
            >
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save API Key"}
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {success && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 px-4 py-2 bg-green-900/20 border border-green-500/30 rounded-lg"
        >
          <p className="text-sm text-green-400">
            <span aria-hidden="true">✓ </span>
            API key saved successfully!
          </p>
        </div>
      )}
    </div>
  );
};
