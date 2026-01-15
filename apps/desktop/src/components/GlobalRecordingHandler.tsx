import { useEffect, useRef } from "react";
import type { StreamingResult } from "../types/electron";

/**
 * Invisible component that handles global recording triggered by hotkeys
 * Manages audio capture, streaming transcription, and text injection
 */
export const GlobalRecordingHandler = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const currentTranscriptRef = useRef<string>("");

  useEffect(() => {
    // Listen for global recording start
    const unsubscribeStart = window.electronAPI.onGlobalRecordingStarted(async () => {
      console.log("Global recording started - starting audio capture");
      await startAudioCapture();
    });

    // Listen for global recording stop
    const unsubscribeStop = window.electronAPI.onGlobalRecordingStopped(async () => {
      console.log("Global recording stopped - stopping audio capture");
      await stopAudioCapture();
    });

    // Listen for streaming transcript updates
    const unsubscribeTranscript = window.electronAPI.onStreamingTranscript(
      (result: StreamingResult) => {
        currentTranscriptRef.current = result.text;
        // The transcript preview is automatically updated in the overlay
        // by the StreamingSTTService via globalHotkeyService.updateTranscriptPreview()
      }
    );

    // Listen for streaming errors
    const unsubscribeError = window.electronAPI.onStreamingError((error: string) => {
      console.error("Streaming error:", error);
    });

    return () => {
      unsubscribeStart();
      unsubscribeStop();
      unsubscribeTranscript();
      unsubscribeError();
      cleanup();
    };
  }, []);

  const startAudioCapture = async () => {
    try {
      // Start streaming transcription in main process
      const result = await window.electronAPI.startStreamingTranscription();
      if (!result.success) {
        console.error("Failed to start streaming:", result.error);
        return;
      }

      console.log(`Streaming started in ${result.mode} mode`);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Create AudioContext at 16kHz (required by Deepgram/Whisper)
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Create MediaStreamSource
      const source = audioContext.createMediaStreamSource(stream);

      // Create ScriptProcessor for capturing audio chunks
      // 4096 buffer size = ~256ms latency at 16kHz
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

      console.log("Audio capture started successfully");
    } catch (error) {
      console.error("Failed to start audio capture:", error);
    }
  };

  const stopAudioCapture = async () => {
    try {
      // Cleanup audio resources
      cleanup();

      // Stop streaming transcription and get final transcript
      const result = await window.electronAPI.stopStreamingTranscription();
      const finalTranscript = result.transcript || currentTranscriptRef.current;

      console.log("Final transcript:", finalTranscript);

      // Inject text into focused field
      if (finalTranscript && finalTranscript.trim().length > 0) {
        const settings = await window.electronAPI.getGlobalSettings();
        await window.electronAPI.injectText(finalTranscript, settings.preserveClipboard);
        console.log("Text injected successfully");
      }

      // Reset transcript
      currentTranscriptRef.current = "";
    } catch (error) {
      console.error("Failed to stop audio capture:", error);
    }
  };

  const cleanup = () => {
    // Stop audio processor
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    // Close audio context
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

  // Invisible component - renders nothing
  return null;
};
