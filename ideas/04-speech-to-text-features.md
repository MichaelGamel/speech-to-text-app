# Speech-to-Text Features and Implementation

## Overview
This document covers various approaches to implementing speech-to-text functionality in an Electron desktop app, including audio capture methods, transcription APIs, real-time vs batch processing, and UI patterns for speech input.

## Audio Capture Methods

### Method 1: Web Audio API (getUserMedia)

Best for: Simple recording, cross-platform compatibility

```typescript
// src/services/AudioCapture.ts
export class AudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async getDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === 'audioinput');
  }

  async startRecording(deviceId?: string): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 48000,
            },
      });

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Capture in 1s chunks
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        throw new Error('No recording in progress');
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// Usage
const capture = new AudioCapture();
await capture.startRecording();
// ... record ...
const audioBlob = await capture.stopRecording();
```

### Method 2: Native Audio with Electron

Best for: System audio capture, loopback recording

```typescript
// electron/services/audio-capture.ts
import { desktopCapturer } from 'electron';

export class NativeAudioCapture {
  async getSystemAudioSources() {
    const sources = await desktopCapturer.getSources({
      types: ['audio'],
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
    }));
  }

  async captureSystemAudio(sourceId: string): Promise<MediaStream> {
    // Request audio capture from specific source
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as any,
    });

    return stream;
  }
}

// IPC handler
ipcMain.handle('audio:get-system-sources', async () => {
  const capture = new NativeAudioCapture();
  return await capture.getSystemAudioSources();
});
```

### Method 3: Real-Time Audio Streaming

Best for: Live transcription, voice commands

```typescript
// src/services/AudioStreamer.ts
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;

  async startStreaming(onAudioData: (data: Float32Array) => void): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(stream);

    // Process audio in chunks
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      onAudioData(inputData);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Usage for streaming transcription
const streamer = new AudioStreamer();
await streamer.startStreaming((audioData) => {
  // Send to transcription service
  window.electronAPI.transcribeChunk(audioData);
});
```

## Speech Recognition APIs

### Option 1: Web Speech API (Free, Browser-Based)

Best for: Simple apps, proof of concept, offline support

```typescript
// src/services/WebSpeechRecognition.ts
export class WebSpeechRecognition {
  private recognition: SpeechRecognition | null = null;

  constructor(
    private onResult: (text: string, isFinal: boolean) => void,
    private onError: (error: string) => void
  ) {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      throw new Error('Speech Recognition not supported');
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this.recognition) return;

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;

      this.onResult(transcript, isFinal);
    };

    this.recognition.onerror = (event) => {
      this.onError(event.error);
    };

    this.recognition.onend = () => {
      // Auto-restart for continuous recognition
      if (this.recognition) {
        this.recognition.start();
      }
    };
  }

  start() {
    this.recognition?.start();
  }

  stop() {
    this.recognition?.stop();
  }

  setLanguage(lang: string) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

// Usage in component
import { useEffect, useState } from 'react';

export const LiveTranscription = () => {
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');

  useEffect(() => {
    const recognition = new WebSpeechRecognition(
      (text, isFinal) => {
        if (isFinal) {
          setTranscript((prev) => prev + ' ' + text);
          setInterimText('');
        } else {
          setInterimText(text);
        }
      },
      (error) => console.error('Recognition error:', error)
    );

    recognition.start();

    return () => recognition.stop();
  }, []);

  return (
    <div>
      <p>{transcript}</p>
      <p style={{ opacity: 0.5 }}>{interimText}</p>
    </div>
  );
};
```

### Option 2: OpenAI Whisper API (Cloud-Based)

Best for: High accuracy, multiple languages, professional apps

```typescript
// electron/services/transcription/openai.ts
import OpenAI from 'openai';
import fs from 'fs';

export class OpenAITranscription {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribeFile(audioPath: string, options?: TranscriptionOptions): Promise<string> {
    const audioFile = fs.createReadStream(audioPath);

    const response = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: options?.language || 'en',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    return response.text;
  }

  async transcribeWithTimestamps(
    audioPath: string
  ): Promise<Array<{ text: string; start: number; end: number }>> {
    const audioFile = fs.createReadStream(audioPath);

    const response = await this.client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    return (response as any).segments.map((segment: any) => ({
      text: segment.text,
      start: segment.start,
      end: segment.end,
    }));
  }
}

// IPC handler
ipcMain.handle('transcribe:openai', async (_event, audioBuffer: Buffer) => {
  const tempPath = path.join(app.getPath('temp'), `audio-${Date.now()}.webm`);
  await fs.promises.writeFile(tempPath, audioBuffer);

  const transcription = new OpenAITranscription(process.env.OPENAI_API_KEY!);
  const result = await transcription.transcribeFile(tempPath);

  // Cleanup
  await fs.promises.unlink(tempPath);

  return result;
});
```

### Option 3: Google Cloud Speech-to-Text

Best for: Real-time streaming, speaker diarization

```typescript
// electron/services/transcription/google.ts
import speech from '@google-cloud/speech';
import { Readable } from 'stream';

export class GoogleSpeechTranscription {
  private client: speech.SpeechClient;

  constructor() {
    this.client = new speech.SpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  async transcribeStreaming(
    onTranscript: (text: string, isFinal: boolean) => void
  ): Promise<Readable> {
    const request = {
      config: {
        encoding: 'WEBM_OPUS' as const,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
      },
      interimResults: true,
    };

    const recognizeStream = this.client
      .streamingRecognize(request)
      .on('data', (data) => {
        const result = data.results[0];
        if (result) {
          const transcript = result.alternatives[0].transcript;
          onTranscript(transcript, result.isFinal);
        }
      })
      .on('error', console.error);

    return recognizeStream;
  }

  async transcribeFile(audioPath: string): Promise<string> {
    const audioBytes = await fs.promises.readFile(audioPath);

    const [response] = await this.client.recognize({
      audio: { content: audioBytes.toString('base64') },
      config: {
        encoding: 'WEBM_OPUS' as const,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
      },
    });

    return response.results?.map((result) => result.alternatives?.[0]?.transcript).join('\n') || '';
  }
}
```

### Option 4: Local Whisper (Offline)

Best for: Privacy-sensitive apps, offline use

```typescript
// electron/services/transcription/local-whisper.ts
import { spawn } from 'child_process';
import path from 'path';

export class LocalWhisperTranscription {
  private whisperPath: string;

  constructor(whisperExecutablePath: string) {
    this.whisperPath = whisperExecutablePath;
  }

  async transcribe(audioPath: string, modelSize: 'tiny' | 'base' | 'small' | 'medium' = 'base'): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputDir = path.dirname(audioPath);

      const whisper = spawn(this.whisperPath, [
        audioPath,
        '--model', modelSize,
        '--output_dir', outputDir,
        '--output_format', 'txt',
      ]);

      let output = '';
      whisper.stdout.on('data', (data) => {
        output += data.toString();
      });

      whisper.on('close', async (code) => {
        if (code === 0) {
          const outputFile = path.join(outputDir, path.basename(audioPath, path.extname(audioPath)) + '.txt');
          const transcript = await fs.promises.readFile(outputFile, 'utf-8');
          resolve(transcript);
        } else {
          reject(new Error(`Whisper exited with code ${code}`));
        }
      });
    });
  }
}
```

## Real-Time vs Batch Processing

### Real-Time Pattern (Streaming)

```typescript
// src/features/transcription/hooks/useRealtimeTranscription.ts
import { useEffect, useState } from 'react';

export const useRealtimeTranscription = () => {
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    window.electronAPI.onTranscriptChunk((text: string, isFinal: boolean) => {
      if (isFinal) {
        setTranscript((prev) => prev + ' ' + text);
        setInterimText('');
      } else {
        setInterimText(text);
      }
    });

    return () => {
      window.electronAPI.removeTranscriptListener();
    };
  }, [isRecording]);

  const startRecording = async () => {
    await window.electronAPI.startRealtimeTranscription();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    await window.electronAPI.stopRealtimeTranscription();
    setIsRecording(false);
  };

  return {
    transcript,
    interimText,
    isRecording,
    startRecording,
    stopRecording,
  };
};
```

### Batch Processing Pattern

```typescript
// src/features/transcription/hooks/useBatchTranscription.ts
import { useState } from 'react';

export const useBatchTranscription = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const transcribeFile = async (filePath: string) => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Monitor progress
      window.electronAPI.onTranscriptionProgress((percent: number) => {
        setProgress(percent);
      });

      const result = await window.electronAPI.transcribeFile(filePath);
      return result;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return {
    transcribeFile,
    isProcessing,
    progress,
  };
};
```

## UI Patterns for Speech Input

### Voice Command Button

```typescript
// src/components/VoiceCommandButton.tsx
import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

export const VoiceCommandButton = ({ onCommand }: { onCommand: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);

  const handleClick = async () => {
    if (isListening) {
      const result = await window.electronAPI.stopListening();
      onCommand(result.text);
      setIsListening(false);
    } else {
      await window.electronAPI.startListening();
      setIsListening(true);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-4 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}
    >
      {isListening ? <MicOff size={24} /> : <Mic size={24} />}
    </button>
  );
};
```

### Waveform Visualization

```typescript
// src/components/AudioWaveform.tsx
import { useEffect, useRef } from 'react';

export const AudioWaveform = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    let animationId: number;

    window.electronAPI.onAudioLevel((level: number) => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      const barWidth = canvas.width / 50;
      const barHeight = level * canvas.height;

      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(canvas.width / 2 - barWidth / 2, canvas.height / 2 - barHeight / 2, barWidth, barHeight);
    });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} width={400} height={100} />;
};
```

## Comparison of Transcription Services

| Service | Cost | Accuracy | Real-Time | Offline | Languages |
|---------|------|----------|-----------|---------|-----------|
| Web Speech API | Free | Medium | Yes | No | 50+ |
| OpenAI Whisper | $0.006/min | High | No | No | 97 |
| Google Cloud | $0.024/min | High | Yes | No | 125+ |
| Local Whisper | Free | High | No | Yes | 97 |

## Key Takeaways

1. **Choose the right API**: Web Speech for simple, OpenAI for quality, Local for privacy
2. **Audio quality matters**: Use proper settings (sample rate, noise suppression)
3. **Handle errors gracefully**: Network issues, API limits, permission denials
4. **Provide visual feedback**: Waveforms, progress indicators, interim results
5. **Consider offline mode**: Local Whisper for privacy-sensitive applications

## Related Documents
- [01-architecture-patterns.md](./01-architecture-patterns.md) - IPC for audio streaming
- [05-native-integrations.md](./05-native-integrations.md) - System audio capture
- [09-security-best-practices.md](./09-security-best-practices.md) - API key management
