import WebSocket from "ws";
import { BrowserWindow } from "electron";
import { transcribeAudio } from "./whisper";

export interface StreamingResult {
  text: string;
  isFinal: boolean;
  confidence?: number;
}

interface DeepgramResponse {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  };
  is_final: boolean;
  speech_final?: boolean;
}

type TranscriptionMode = "deepgram" | "whisper";

export class StreamingSTTService {
  private ws: WebSocket | null = null;
  private mainWindow: BrowserWindow;
  private apiKey: string | null = null;
  private fullTranscript = "";
  private isConnected = false;
  private mode: TranscriptionMode = "whisper";

  // Whisper fallback
  private audioChunks: Float32Array[] = [];
  private whisperProcessing = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Start streaming transcription
   * Attempts Deepgram first, falls back to Whisper if no API key or connection fails
   */
  async start(apiKey?: string): Promise<{ success: boolean; mode: TranscriptionMode; error?: string }> {
    // Determine mode based on API key availability
    if (apiKey && apiKey.trim().length > 0) {
      this.apiKey = apiKey;
      const deepgramResult = await this.startDeepgram();
      if (deepgramResult.success) {
        return { success: true, mode: "deepgram" };
      }
      // If Deepgram fails, fall back to Whisper
      console.warn("Deepgram connection failed, falling back to Whisper");
    }

    // Use Whisper fallback
    this.startWhisperMode();
    return { success: true, mode: "whisper" };
  }

  /**
   * Start Deepgram WebSocket connection
   */
  private async startDeepgram(): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      return { success: false, error: "No API key provided" };
    }

    return new Promise((resolve) => {
      try {
        const url =
          "wss://api.deepgram.com/v1/listen?" +
          "model=nova-2&" +
          "punctuate=true&" +
          "interim_results=true&" +
          "encoding=linear16&" +
          "sample_rate=16000&" +
          "channels=1";

        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        });

        // Set timeout for connection
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close();
            resolve({ success: false, error: "Connection timeout" });
          }
        }, 10000);

        this.ws.on("open", () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.mode = "deepgram";
          console.log("Deepgram WebSocket connected");
          resolve({ success: true });
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const response: DeepgramResponse = JSON.parse(data.toString());
            this.handleDeepgramMessage(response);
          } catch (error) {
            console.error("Failed to parse Deepgram message:", error);
          }
        });

        this.ws.on("error", (error) => {
          console.error("Deepgram WebSocket error:", error);
          clearTimeout(timeout);
          if (!this.isConnected) {
            resolve({ success: false, error: error.message });
          }
          this.sendError(`Connection error: ${error.message}`);
        });

        this.ws.on("close", (code, reason) => {
          console.log(`Deepgram WebSocket closed: ${code} - ${reason}`);
          this.isConnected = false;
          this.ws = null;
        });
      } catch (error) {
        resolve({ success: false, error: (error as Error).message });
      }
    });
  }

  /**
   * Start Whisper fallback mode (chunked processing)
   */
  private startWhisperMode(): void {
    this.mode = "whisper";
    this.audioChunks = [];
    console.log("Using Whisper fallback mode");
  }

  /**
   * Handle Deepgram message
   */
  private handleDeepgramMessage(response: DeepgramResponse): void {
    const transcript = response.channel.alternatives[0]?.transcript || "";
    const confidence = response.channel.alternatives[0]?.confidence;

    if (!transcript) return;

    // Update full transcript if final
    if (response.is_final) {
      this.fullTranscript += transcript + " ";
    }

    // Send result to renderer
    const result: StreamingResult = {
      text: response.is_final ? this.fullTranscript.trim() : this.fullTranscript + transcript,
      isFinal: response.is_final,
      confidence,
    };

    this.sendResult(result);
  }

  /**
   * Send audio data for transcription
   * @param audioData - Int16Array or Float32Array audio data at 16kHz
   */
  sendAudio(audioData: Int16Array | Float32Array): void {
    if (this.mode === "deepgram") {
      this.sendAudioToDeepgram(audioData);
    } else {
      this.bufferAudioForWhisper(audioData);
    }
  }

  /**
   * Send audio to Deepgram WebSocket
   */
  private sendAudioToDeepgram(audioData: Int16Array | Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("Deepgram WebSocket not open, cannot send audio");
      return;
    }

    try {
      // Convert Float32Array to Int16Array if needed
      let buffer: Buffer;
      if (audioData instanceof Float32Array) {
        const int16Data = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        buffer = Buffer.from(int16Data.buffer);
      } else {
        buffer = Buffer.from(audioData.buffer);
      }

      this.ws.send(buffer);
    } catch (error) {
      console.error("Failed to send audio to Deepgram:", error);
    }
  }

  /**
   * Buffer audio for Whisper processing
   */
  private bufferAudioForWhisper(audioData: Int16Array | Float32Array): void {
    // Convert to Float32Array if needed
    let float32Data: Float32Array;
    if (audioData instanceof Int16Array) {
      float32Data = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        float32Data[i] = audioData[i] / 32768;
      }
    } else {
      float32Data = audioData;
    }

    this.audioChunks.push(float32Data);

    // Process in ~5 second chunks
    const totalSamples = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const fiveSeconds = 16000 * 5; // 5 seconds at 16kHz

    if (totalSamples >= fiveSeconds && !this.whisperProcessing) {
      this.processWhisperChunk();
    }
  }

  /**
   * Process accumulated audio with Whisper
   */
  private async processWhisperChunk(): Promise<void> {
    if (this.whisperProcessing || this.audioChunks.length === 0) {
      return;
    }

    this.whisperProcessing = true;

    try {
      // Combine chunks
      const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.audioChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      // Clear processed chunks
      this.audioChunks = [];

      // Transcribe with Whisper
      const result = await transcribeAudio(combined);

      if (result.text && result.text.trim().length > 0) {
        this.fullTranscript += result.text + " ";

        this.sendResult({
          text: this.fullTranscript.trim(),
          isFinal: false,
        });
      }
    } catch (error) {
      console.error("Whisper processing error:", error);
      this.sendError(`Transcription error: ${(error as Error).message}`);
    } finally {
      this.whisperProcessing = false;
    }
  }

  /**
   * Stop streaming transcription and return final transcript
   */
  async stop(): Promise<string> {
    // Close Deepgram connection
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Process remaining Whisper chunks
    if (this.mode === "whisper" && this.audioChunks.length > 0) {
      await this.processWhisperChunk();
    }

    const result = this.fullTranscript.trim();

    // Reset state
    this.fullTranscript = "";
    this.audioChunks = [];
    this.isConnected = false;
    this.whisperProcessing = false;

    return result;
  }

  /**
   * Send streaming result to renderer
   */
  private sendResult(result: StreamingResult): void {
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("streaming-transcript", result);
    }
  }

  /**
   * Send error to renderer
   */
  private sendError(error: string): void {
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("streaming-error", error);
    }
  }

  /**
   * Get current transcription mode
   */
  getMode(): TranscriptionMode {
    return this.mode;
  }

  /**
   * Check if currently connected and streaming
   */
  isStreaming(): boolean {
    return this.isConnected || this.mode === "whisper";
  }
}
