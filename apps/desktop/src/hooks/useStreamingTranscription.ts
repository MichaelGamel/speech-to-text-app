import { useState, useEffect, useRef, useCallback } from "react";
import type { StreamingResult, TranscriptionMode } from "../types/electron";

interface UseStreamingTranscriptionOptions {
  onTranscriptUpdate?: (transcript: string) => void;
  onError?: (error: string) => void;
  onComplete?: (finalTranscript: string) => void;
}

export const useStreamingTranscription = (options?: UseStreamingTranscriptionOptions) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<TranscriptionMode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Listen to streaming transcript events
  useEffect(() => {
    const unsubscribeTranscript = window.electronAPI.onStreamingTranscript(
      (result: StreamingResult) => {
        setTranscript(result.text);
        options?.onTranscriptUpdate?.(result.text);
      }
    );

    const unsubscribeError = window.electronAPI.onStreamingError((error: string) => {
      setError(error);
      options?.onError?.(error);
    });

    return () => {
      unsubscribeTranscript();
      unsubscribeError();
    };
  }, [options?.onTranscriptUpdate, options?.onError]);

  /**
   * Start streaming transcription
   */
  const start = useCallback(async (apiKey?: string) => {
    try {
      setError(null);
      setTranscript("");

      // Start streaming transcription service
      const result = await window.electronAPI.startStreamingTranscription(apiKey);

      if (!result.success) {
        throw new Error(result.error || "Failed to start streaming");
      }

      setMode(result.mode);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create AudioContext for processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Create MediaStreamSource
      const source = audioContext.createMediaStreamSource(stream);

      // Create ScriptProcessor for capturing audio chunks
      // Using 4096 buffer size for reasonable latency
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Send audio chunk to main process
        const buffer = new Float32Array(inputData);
        window.electronAPI.sendAudioChunk(buffer.buffer);
      };

      // Connect nodes
      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsStreaming(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start streaming";
      setError(errorMessage);
      options?.onError?.(errorMessage);
      cleanup();
    }
  }, [options?.onError]);

  /**
   * Stop streaming transcription
   */
  const stop = useCallback(async () => {
    try {
      // Stop audio processing
      cleanup();

      // Stop streaming service and get final transcript
      const result = await window.electronAPI.stopStreamingTranscription();
      const finalTranscript = result.transcript;

      setTranscript(finalTranscript);
      setIsStreaming(false);

      options?.onComplete?.(finalTranscript);

      return finalTranscript;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to stop streaming";
      setError(errorMessage);
      options?.onError?.(errorMessage);
      return transcript;
    }
  }, [transcript, options?.onComplete, options?.onError]);

  /**
   * Cleanup audio resources
   */
  const cleanup = () => {
    // Stop audio context
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return {
    isStreaming,
    transcript,
    error,
    mode,
    start,
    stop,
  };
};
