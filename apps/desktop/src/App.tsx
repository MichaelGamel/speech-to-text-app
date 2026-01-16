import { useState, useEffect, useCallback, useMemo } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useKeyboardShortcuts, KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import { convertBlobToFloat32Array, float32ArrayToBuffer } from "./utils/audioConverter";
import { TranscriptionProgress } from "./types/electron";
import { GlobalRecordingHandler } from "./components/GlobalRecordingHandler";

function App() {
  // Global recording handler (Phase 6 - always active in background)
  // This component handles hotkey-triggered recording/transcription/injection
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Audio recording hook
  const {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    error: recordingError,
  } = useAudioRecorder();

  // Listen for transcription progress from main process
  useEffect(() => {
    const handleProgress = (progress: TranscriptionProgress) => {
      setTranscriptionProgress(progress);
      if (progress.status === "error") {
        setError(progress.message);
        setIsTranscribing(false);
      }
    };

    window.electronAPI.onTranscriptionProgress(handleProgress);

    return () => {
      window.electronAPI.removeListener("transcription-progress");
    };
  }, []);

  // Combined error state
  const errorMessage = error || recordingError;

  const handleSelectFile = async () => {
    const result = await window.electronAPI.selectAudioFile();
    if (!result.cancelled && result.filePath) {
      setSelectedFile(result.filePath);
      setTranscript("");
      setError(null);
    }
  };

  const handleStartRecording = async () => {
    // Check microphone permission on macOS
    const permissionStatus = await window.electronAPI.checkMicrophonePermission();
    console.log("Microphone permission status:", permissionStatus);

    if (permissionStatus.platform === "darwin" && permissionStatus.status !== "granted") {
      // Request permission on macOS
      const result = await window.electronAPI.requestMicrophonePermission();
      if (!result.granted) {
        setError(
          "Microphone permission is required for recording. " +
          "Please go to: System Preferences > Security & Privacy > Privacy > Microphone " +
          "and enable access for this application."
        );
        return;
      }
    }

    // Reset state
    setTranscript("");
    setError(null);
    setTranscriptionProgress(null);

    // Start recording
    await startRecording();
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) {
      setError("No audio to transcribe. Please record something first.");
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscriptionProgress({
      status: "loading",
      progress: 0,
      message: "Preparing audio...",
    });

    try {
      // Convert audio blob to Float32Array
      console.log("Converting audio blob:", audioBlob.size, "bytes");
      const audioData = await convertBlobToFloat32Array(audioBlob);
      console.log("Audio converted to Float32Array:", audioData.length, "samples");

      // Convert to ArrayBuffer for IPC transfer
      const buffer = float32ArrayToBuffer(audioData);
      console.log("Sending audio buffer to main process:", buffer.byteLength, "bytes");

      // Send to main process for transcription
      const result = await window.electronAPI.transcribeAudio(buffer);

      if (result.success && result.text) {
        setTranscript(result.text);
        setTranscriptionProgress({
          status: "completed",
          progress: 100,
          message: `Transcription complete in ${result.duration?.toFixed(2)}s`,
        });
      } else {
        throw new Error(result.error || "Transcription failed");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setError(err instanceof Error ? err.message : "Transcription failed");
      setTranscriptionProgress(null);
    } finally {
      setIsTranscribing(false);
    }
  }, [audioBlob]);

  const handleSave = async () => {
    if (!transcript) {
      setError("No transcript to save");
      return;
    }

    const result = await window.electronAPI.saveTranscript(transcript);
    if (result.success) {
      alert(`Transcript saved to:\n${result.filePath}`);
    } else {
      setError(`Failed to save: ${result.error}`);
    }
  };

  const getFileName = (filePath: string) => {
    return filePath.split("/").pop() || filePath;
  };

  // Get progress bar color based on status
  const getProgressColor = () => {
    switch (transcriptionProgress?.status) {
      case "loading":
        return "bg-yellow-500";
      case "transcribing":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-blue-500";
    }
  };

  // Toggle recording handler for keyboard shortcut
  // Only allows toggling when not transcribing (to prevent conflicts)
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    } else if (!isTranscribing) {
      handleStartRecording();
    }
    // If isTranscribing is true, do nothing - user must wait for transcription to complete
  }, [isRecording, isTranscribing]);

  // State-aware transcribe handler for keyboard shortcut
  // Only triggers when conditions are met (has audio, not recording, not already transcribing)
  const handleTranscribeShortcut = useCallback(() => {
    // Don't transcribe if currently recording - user should stop recording first
    if (isRecording) return;

    // Don't transcribe if already transcribing
    if (isTranscribing) return;

    // Don't transcribe if no audio blob exists
    if (!audioBlob) return;

    // All conditions met, proceed with transcription
    handleTranscribe();
  }, [isRecording, isTranscribing, audioBlob, handleTranscribe]);

  // Keyboard shortcuts for in-app recording controls
  // Space: Toggle recording (when not transcribing)
  // Enter: Transcribe (when audio exists and not recording/transcribing)
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: "Space",
        handler: toggleRecording,
      },
      {
        key: "Enter",
        handler: handleTranscribeShortcut,
      },
    ],
    [toggleRecording, handleTranscribeShortcut]
  );

  // Enable keyboard shortcuts when window is focused
  useKeyboardShortcuts(keyboardShortcuts);

  return (
    <div className="app min-h-screen flex flex-col pt-[60px] px-8 pb-8">
      {/* Global recording handler - always active, listens to hotkeys */}
      <GlobalRecordingHandler />

      <header className="app-header text-center mb-8">
        <h1 className="text-4xl font-semibold mb-2">Speech to Text</h1>
        <p className="text-lg text-gray-400">
          Record your voice and get it transcribed using local AI
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Powered by Whisper - runs completely offline after first model download
        </p>

        {/* Global hotkey status indicator */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-900/20 border border-blue-500/30 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-blue-400 font-medium">
            Global Hotkey Active: <kbd className="px-2 py-1 bg-dark-800 rounded text-xs">Cmd+Shift+Space</kbd>
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press the hotkey from any app to start voice-to-text
        </p>
      </header>

      <main className="app-main max-w-4xl w-full mx-auto">
        <section className="bg-dark-900 rounded-xl p-6 mb-6">
          <div className="flex gap-4 mb-4 flex-wrap">
            <button
              onClick={handleSelectFile}
              disabled={isRecording || isTranscribing}
              className="px-6 py-3 font-medium rounded-lg bg-dark-800 text-white transition-all duration-200 hover:bg-dark-700 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Audio File
            </button>

            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isTranscribing}
              className={`px-6 py-3 font-medium rounded-lg text-white transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                isRecording
                  ? "bg-recording animate-pulse-recording"
                  : "bg-primary hover:bg-primary-hover"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                {isRecording ? "Stop Recording" : "Start Recording"}
                <kbd className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-normal opacity-80">Space</kbd>
              </span>
            </button>

            {audioBlob && !isRecording && (
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="px-6 py-3 font-medium rounded-lg bg-green-600 text-white transition-all duration-200 hover:bg-green-700 hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-2">
                  {isTranscribing ? "Transcribing..." : "Transcribe"}
                  {!isTranscribing && <kbd className="px-1.5 py-0.5 bg-black/30 rounded text-xs font-normal opacity-80">Enter</kbd>}
                </span>
              </button>
            )}
          </div>

          {selectedFile && (
            <div className="p-3 bg-dark-950 rounded-md text-sm">
              <strong className="text-gray-400 mr-2">Selected file:</strong>
              {getFileName(selectedFile)}
            </div>
          )}

          {isRecording && (
            <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse-recording"></div>
                <span className="text-blue-400 font-medium">
                  Recording... Click "Stop Recording" when done
                </span>
              </div>
            </div>
          )}

          {audioBlob && !isRecording && !isTranscribing && !transcript && (
            <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎵</span>
                <span className="text-green-400 font-medium">
                  Audio recorded ({(audioBlob.size / 1024).toFixed(1)} KB). Click "Transcribe" to convert to text.
                </span>
              </div>
            </div>
          )}

          {transcriptionProgress && (
            <div className="mt-4 p-4 bg-dark-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">
                  {transcriptionProgress.message}
                </span>
                <span className="text-sm text-gray-400">
                  {transcriptionProgress.progress}%
                </span>
              </div>
              <div className="w-full bg-dark-950 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${transcriptionProgress.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="text-red-400 font-semibold mb-1">Error</h3>
                  <p className="text-red-300 text-sm">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {transcript && (
          <section className="bg-dark-900 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold">Transcription Result</h2>
              <button
                onClick={handleSave}
                className="px-6 py-3 font-medium rounded-lg bg-dark-800 text-white transition-all duration-200 hover:bg-dark-700 hover:-translate-y-px active:translate-y-0"
              >
                Save Transcript
              </button>
            </div>
            <textarea
              className="w-full min-h-[300px] p-4 font-inherit text-base leading-relaxed bg-dark-950 text-white border border-dark-800 rounded-lg resize-y outline-none focus:border-blue-600 transition-colors"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcription will appear here..."
              rows={15}
            />
          </section>
        )}

        {!transcript && !isRecording && !audioBlob && (
          <section className="bg-dark-900 rounded-xl p-6 text-center">
            <div className="py-12">
              <div className="text-6xl mb-4">🎤</div>
              <h3 className="text-xl font-semibold mb-2">Ready to transcribe</h3>
              <p className="text-gray-400">
                Click "Start Recording" to begin, then "Transcribe" to convert your speech to text
              </p>
              <p className="text-gray-500 text-sm mt-4">
                First transcription will download the AI model (~150MB)
              </p>

              {/* Keyboard shortcuts info */}
              <div className="mt-6 pt-6 border-t border-dark-800">
                <p className="text-sm text-gray-500 mb-3">Keyboard shortcuts (when app is focused):</p>
                <div className="flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-dark-800 rounded text-xs text-gray-300 font-mono">Space</kbd>
                    <span className="text-gray-400 text-sm">Start/Stop Recording</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-dark-800 rounded text-xs text-gray-300 font-mono">Enter</kbd>
                    <span className="text-gray-400 text-sm">Transcribe</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
