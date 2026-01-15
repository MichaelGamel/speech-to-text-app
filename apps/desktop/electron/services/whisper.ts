import { pipeline, env, Pipeline } from "@xenova/transformers";
import { app } from "electron";
import path from "path";

// Configure transformers.js to use local cache
env.cacheDir = path.join(app.getPath("userData"), "models");
env.allowLocalModels = true;
env.allowRemoteModels = true;

// Whisper model to use - tiny is fastest, base is more accurate
const WHISPER_MODEL = "Xenova/whisper-tiny";

// Singleton instance
let transcriber: Pipeline | null = null;
let isLoading = false;

export interface TranscriptionResult {
  text: string;
  duration?: number;
}

export interface TranscriptionProgress {
  status: "loading" | "transcribing" | "completed" | "error";
  progress: number;
  message: string;
}

type ProgressCallback = (progress: TranscriptionProgress) => void;

/**
 * Initialize the Whisper transcription pipeline
 * Downloads the model on first use (~150MB for tiny model)
 */
export async function initializeWhisper(
  onProgress?: ProgressCallback
): Promise<void> {
  if (transcriber) {
    return; // Already initialized
  }

  if (isLoading) {
    // Wait for existing initialization
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return;
  }

  isLoading = true;

  try {
    onProgress?.({
      status: "loading",
      progress: 0,
      message: "Loading Whisper model...",
    });

    console.log("Initializing Whisper model:", WHISPER_MODEL);
    console.log("Cache directory:", env.cacheDir);

    // Create the pipeline with progress callback
    transcriber = await pipeline("automatic-speech-recognition", WHISPER_MODEL, {
      progress_callback: (data: { status: string; progress?: number; file?: string }) => {
        if (data.status === "progress" && data.progress !== undefined) {
          onProgress?.({
            status: "loading",
            progress: Math.round(data.progress),
            message: `Downloading model: ${Math.round(data.progress)}%`,
          });
        } else if (data.status === "done") {
          onProgress?.({
            status: "loading",
            progress: 100,
            message: "Model loaded successfully",
          });
        }
      },
    });

    console.log("Whisper model loaded successfully");
  } catch (error) {
    console.error("Failed to initialize Whisper:", error);
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Transcribe audio data using Whisper
 * @param audioData - Float32Array of audio samples at 16kHz
 * @param onProgress - Optional callback for progress updates
 * @returns Transcription result with text
 */
export async function transcribeAudio(
  audioData: Float32Array,
  onProgress?: ProgressCallback
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  // Initialize if needed
  if (!transcriber) {
    await initializeWhisper(onProgress);
  }

  if (!transcriber) {
    throw new Error("Failed to initialize Whisper transcriber");
  }

  onProgress?.({
    status: "transcribing",
    progress: 0,
    message: "Transcribing audio...",
  });

  try {
    console.log("Starting transcription, audio length:", audioData.length, "samples");

    // Run transcription
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "english",
      task: "transcribe",
      return_timestamps: false,
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log("Transcription completed in", duration.toFixed(2), "seconds");

    // Handle result - it can be an object or array
    let text = "";
    if (Array.isArray(result)) {
      text = result.map((r: { text: string }) => r.text).join(" ");
    } else if (result && typeof result === "object" && "text" in result) {
      text = (result as { text: string }).text;
    }

    onProgress?.({
      status: "completed",
      progress: 100,
      message: "Transcription complete",
    });

    return {
      text: text.trim(),
      duration,
    };
  } catch (error) {
    console.error("Transcription failed:", error);
    onProgress?.({
      status: "error",
      progress: 0,
      message: `Transcription failed: ${(error as Error).message}`,
    });
    throw error;
  }
}

/**
 * Check if Whisper is ready for transcription
 */
export function isWhisperReady(): boolean {
  return transcriber !== null;
}

/**
 * Unload the Whisper model to free memory
 */
export async function unloadWhisper(): Promise<void> {
  if (transcriber) {
    transcriber = null;
    console.log("Whisper model unloaded");
  }
}
