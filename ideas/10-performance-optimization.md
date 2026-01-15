# Performance Optimization

## Overview
Performance is crucial for desktop applications. This document covers startup optimization, memory management, worker threads for CPU-intensive tasks, lazy loading, code splitting, and profiling techniques.

## Application Startup Optimization

### Lazy Main Process Initialization

```typescript
// electron/main/index.ts
import { app, BrowserWindow } from 'electron';

// Fast startup: Minimal initialization
app.whenReady().then(async () => {
  // 1. Create window immediately
  const mainWindow = createMainWindow();

  // 2. Load UI (don't wait for other services)
  mainWindow.loadURL('http://localhost:5173');

  // 3. Initialize heavy services asynchronously
  initializeServicesAsync();
});

const initializeServicesAsync = async () => {
  // Initialize services in background, not blocking UI
  Promise.all([
    initializeDatabase(),
    loadUserPreferences(),
    setupAutoUpdater(),
    warmupTranscriptionAPI(),
  ]).catch((error) => {
    console.error('Background initialization failed:', error);
  });
};

const initializeDatabase = async () => {
  // Lazy load database module
  const { Database } = await import('./services/database');
  const db = new Database();
  await db.initialize();
};
```

### Preload Script Optimization

```typescript
// electron/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

// Minimize preload script size
// Only include essential APIs

// BAD: Loading heavy modules in preload
import someHeavyLibrary from 'heavy-library'; // Slows down window creation

// GOOD: Lazy load when needed
const electronAPI = {
  saveTranscript: (text: string) => ipcRenderer.invoke('save-transcript', text),

  // Lazy load heavy functionality
  transcribeAudio: async (audio: Blob) => {
    // Load transcription logic only when needed
    const { processAudio } = await import('./audio-processor');
    const processed = await processAudio(audio);
    return ipcRenderer.invoke('transcribe', processed);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

## Memory Management

### Efficient State Management

```typescript
// src/stores/transcriptStore.ts
import { create } from 'zustand';

interface TranscriptStore {
  segments: TranscriptSegment[];
  addSegment: (segment: TranscriptSegment) => void;
  clearOldSegments: () => void;
}

export const useTranscriptStore = create<TranscriptStore>((set, get) => ({
  segments: [],

  addSegment: (segment) => {
    set((state) => ({
      segments: [...state.segments, segment],
    }));

    // Clean up old segments to prevent memory bloat
    const { segments } = get();
    if (segments.length > 1000) {
      get().clearOldSegments();
    }
  },

  clearOldSegments: () => {
    set((state) => ({
      // Keep only last 500 segments in memory
      segments: state.segments.slice(-500),
    }));
  },
}));
```

### Memory Leak Prevention

```typescript
// src/hooks/useAudioRecording.ts
import { useEffect, useRef } from 'react';

export const useAudioRecording = () => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();

    // CRITICAL: Clean up media stream
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return { startRecording, stopRecording };
};
```

### Large Data Handling

```typescript
// electron/services/transcription-cache.ts
import { LRUCache } from 'lru-cache';

// Use LRU cache for transcription results
const transcriptCache = new LRUCache<string, string>({
  max: 100, // Maximum 100 items
  maxSize: 50 * 1024 * 1024, // 50MB max
  sizeCalculation: (value) => value.length,
  dispose: (value, key) => {
    console.log('Evicting from cache:', key);
  },
});

export const cacheTranscript = (audioHash: string, transcript: string) => {
  transcriptCache.set(audioHash, transcript);
};

export const getCachedTranscript = (audioHash: string): string | undefined => {
  return transcriptCache.get(audioHash);
};
```

## Worker Threads for CPU-Intensive Tasks

### Worker Thread Setup

```typescript
// electron/workers/audio-processor.ts
import { parentPort, workerData } from 'worker_threads';

// CPU-intensive audio processing in worker thread
const processAudioData = (audioData: Float32Array): Float32Array => {
  // Heavy processing...
  const processed = new Float32Array(audioData.length);

  for (let i = 0; i < audioData.length; i++) {
    // Apply filters, normalization, etc.
    processed[i] = audioData[i] * 0.8;
  }

  return processed;
};

parentPort?.on('message', (audioData: Float32Array) => {
  const processed = processAudioData(audioData);
  parentPort?.postMessage(processed);
});
```

```typescript
// electron/services/audio-processor.ts
import { Worker } from 'worker_threads';
import path from 'path';

export class AudioProcessor {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(path.join(__dirname, '../workers/audio-processor.js'));
  }

  async processAudio(audioData: Float32Array): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      this.worker.once('message', resolve);
      this.worker.once('error', reject);
      this.worker.postMessage(audioData);
    });
  }

  destroy() {
    this.worker.terminate();
  }
}

// Usage
const processor = new AudioProcessor();
const processedAudio = await processor.processAudio(rawAudioData);
```

### Web Workers in Renderer

```typescript
// src/workers/transcript-analyzer.worker.ts
self.onmessage = (event: MessageEvent<string>) => {
  const transcript = event.data;

  // CPU-intensive analysis
  const wordCount = transcript.split(/\s+/).length;
  const sentences = transcript.split(/[.!?]+/).length;
  const avgWordLength = transcript.length / wordCount;

  // Sentiment analysis, keyword extraction, etc.
  const analysis = {
    wordCount,
    sentences,
    avgWordLength,
  };

  self.postMessage(analysis);
};

// src/hooks/useTranscriptAnalysis.ts
import { useEffect, useState } from 'react';

export const useTranscriptAnalysis = (transcript: string) => {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/transcript-analyzer.worker.ts', import.meta.url));

    worker.onmessage = (event) => {
      setAnalysis(event.data);
    };

    worker.postMessage(transcript);

    return () => {
      worker.terminate();
    };
  }, [transcript]);

  return analysis;
};
```

## Code Splitting and Lazy Loading

### Route-Based Code Splitting

```typescript
// src/App.tsx
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

// Lazy load route components
const RecordingView = lazy(() => import('./views/RecordingView'));
const TranscriptsView = lazy(() => import('./views/TranscriptsView'));
const SettingsView = lazy(() => import('./views/SettingsView'));

export const App = () => {
  return (
    <HashRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<RecordingView />} />
          <Route path="/transcripts" element={<TranscriptsView />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
};
```

### Component-Level Lazy Loading

```typescript
// src/components/TranscriptEditor.tsx
import { lazy, Suspense, useState } from 'react';

// Heavy editor component loaded only when needed
const RichTextEditor = lazy(() => import('./RichTextEditor'));

export const TranscriptEditor = () => {
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      {!showEditor && (
        <button onClick={() => setShowEditor(true)}>Open Editor</button>
      )}

      {showEditor && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <RichTextEditor />
        </Suspense>
      )}
    </div>
  );
};
```

### Dynamic Imports for Large Libraries

```typescript
// src/services/export.ts
export const exportToPDF = async (content: string) => {
  // Only load PDF library when user exports
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF();
  doc.text(content, 10, 10);
  doc.save('transcript.pdf');
};

export const exportToDocx = async (content: string) => {
  // Only load DOCX library when user exports
  const { Document, Packer, Paragraph } = await import('docx');

  const doc = new Document({
    sections: [
      {
        children: [new Paragraph(content)],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  // Save blob...
};
```

## Rendering Performance

### Virtualized Lists

```typescript
// src/components/TranscriptList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export const TranscriptList = ({ transcripts }: { transcripts: Transcript[] }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transcripts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 5, // Render 5 extra items
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <TranscriptItem transcript={transcripts[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```

### React Performance Optimization

```typescript
// src/components/TranscriptSegment.tsx
import { memo } from 'react';

// Memoize expensive components
export const TranscriptSegment = memo(
  ({ segment }: { segment: TranscriptSegment }) => {
    return (
      <div className="p-2 border-b">
        <p>{segment.text}</p>
        <span className="text-xs text-gray-500">
          {new Date(segment.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    return prevProps.segment.id === nextProps.segment.id;
  }
);

// Use useMemo for expensive calculations
import { useMemo } from 'react';

export const TranscriptStats = ({ transcript }: { transcript: string }) => {
  const stats = useMemo(() => {
    // Expensive calculation
    return {
      wordCount: transcript.split(/\s+/).length,
      charCount: transcript.length,
      readingTime: Math.ceil(transcript.split(/\s+/).length / 200), // minutes
    };
  }, [transcript]); // Only recalculate when transcript changes

  return <div>Words: {stats.wordCount}</div>;
};
```

## Database Performance

### Indexed Storage

```typescript
// src/db/database.ts
import Dexie from 'dexie';

class TranscriptDatabase extends Dexie {
  transcripts!: Dexie.Table<TranscriptRecord, number>;

  constructor() {
    super('TranscriptDB');

    this.version(1).stores({
      // Index frequently queried fields
      transcripts: '++id, createdAt, *tags, language',
    });
  }
}

export const db = new TranscriptDatabase();

// Efficient queries using indexes
export const getRecentTranscripts = async (limit: number = 50) => {
  return await db.transcripts
    .orderBy('createdAt') // Uses index
    .reverse()
    .limit(limit)
    .toArray();
};

export const searchByTag = async (tag: string) => {
  return await db.transcripts
    .where('tags') // Uses multi-entry index
    .equals(tag)
    .toArray();
};
```

### Batch Operations

```typescript
// Efficient bulk inserts
export const importTranscripts = async (transcripts: TranscriptRecord[]) => {
  // Batch insert instead of individual operations
  await db.transcripts.bulkAdd(transcripts);
};

// Efficient bulk updates
export const updateMultipleTranscripts = async (updates: Array<{ id: number; changes: any }>) => {
  await db.transaction('rw', db.transcripts, async () => {
    await Promise.all(updates.map((update) => db.transcripts.update(update.id, update.changes)));
  });
};
```

## Profiling and Monitoring

### Electron Performance Monitoring

```typescript
// electron/services/performance-monitor.ts
import { app, BrowserWindow } from 'electron';

export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();

  startMeasure(label: string) {
    this.metrics.set(label, performance.now());
  }

  endMeasure(label: string) {
    const start = this.metrics.get(label);
    if (start) {
      const duration = performance.now() - start;
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
      this.metrics.delete(label);
    }
  }

  measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasure(label);
    return fn().finally(() => this.endMeasure(label));
  }

  getMemoryUsage() {
    return {
      heap: process.memoryUsage(),
      system: process.getSystemMemoryInfo?.(),
    };
  }

  logMemoryUsage() {
    const usage = this.getMemoryUsage();
    console.log('Memory Usage:', {
      heapUsed: `${(usage.heap.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(usage.heap.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    });
  }
}

// Usage
const monitor = new PerformanceMonitor();

await monitor.measureAsync('transcription', async () => {
  return await transcribeAudio(audioData);
});

// Periodic monitoring
setInterval(() => {
  monitor.logMemoryUsage();
}, 60000); // Every minute
```

### React DevTools Profiler

```typescript
// src/App.tsx
import { Profiler } from 'react';

const onRenderCallback = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number
) => {
  if (actualDuration > 16) {
    // Slower than 60fps
    console.warn(`Slow render: ${id} took ${actualDuration}ms`);
  }
};

export const App = () => {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <MainContent />
    </Profiler>
  );
};
```

## Build Optimization

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@ui/components'],
        },
      },
    },
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
      },
    },
    // Source maps only in development
    sourcemap: process.env.NODE_ENV === 'development',
  },
});
```

## Key Takeaways

1. **Lazy Initialization**: Don't block app startup, initialize services asynchronously
2. **Memory Management**: Clean up resources, use LRU caches, limit data in memory
3. **Worker Threads**: Offload CPU-intensive tasks to workers
4. **Code Splitting**: Lazy load routes and heavy components
5. **Virtualization**: Use virtual lists for large datasets
6. **Profiling**: Measure performance, identify bottlenecks
7. **Database**: Use indexes, batch operations for efficiency

## Related Documents
- [02-state-management.md](./02-state-management.md) - Efficient state patterns
- [03-project-structure.md](./03-project-structure.md) - Code organization for splitting
- [04-speech-to-text-features.md](./04-speech-to-text-features.md) - Audio processing performance
