import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderReturn {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  error: string | null;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create MediaRecorder instance
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Collect audio data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // When recording stops, create the audio blob
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start recording";
      setError(errorMessage);
      console.error("Recording error:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    error,
  };
};
