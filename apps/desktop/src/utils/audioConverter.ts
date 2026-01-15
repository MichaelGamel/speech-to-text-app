/**
 * Audio Converter Utility
 * Converts audio from various formats to 16kHz mono Float32Array for Whisper
 */

const TARGET_SAMPLE_RATE = 16000;

/**
 * Convert an audio Blob to Float32Array at 16kHz mono
 * @param blob - Audio blob from MediaRecorder or file
 * @returns Float32Array of audio samples at 16kHz
 */
export async function convertBlobToFloat32Array(blob: Blob): Promise<Float32Array> {
  // Create audio context for decoding
  const audioContext = new AudioContext({
    sampleRate: TARGET_SAMPLE_RATE,
  });

  try {
    // Convert blob to ArrayBuffer
    const arrayBuffer = await blob.arrayBuffer();

    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get the audio data (convert to mono if needed)
    let audioData: Float32Array;

    if (audioBuffer.numberOfChannels === 1) {
      // Already mono
      audioData = audioBuffer.getChannelData(0);
    } else {
      // Convert to mono by averaging channels
      const channels: Float32Array[] = [];
      for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
      }

      audioData = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        let sum = 0;
        for (const channel of channels) {
          sum += channel[i];
        }
        audioData[i] = sum / channels.length;
      }
    }

    // Resample if needed
    if (audioBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
      audioData = resample(audioData, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
    }

    console.log(
      `Audio converted: ${audioBuffer.duration.toFixed(2)}s, ` +
      `${audioBuffer.sampleRate}Hz -> ${TARGET_SAMPLE_RATE}Hz, ` +
      `${audioBuffer.numberOfChannels} channels -> mono, ` +
      `${audioData.length} samples`
    );

    return audioData;
  } finally {
    await audioContext.close();
  }
}

/**
 * Resample audio data to a different sample rate using linear interpolation
 */
function resample(
  audioData: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array {
  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;

    if (index + 1 < audioData.length) {
      // Linear interpolation
      result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
    } else {
      result[i] = audioData[index];
    }
  }

  return result;
}

/**
 * Convert Float32Array to ArrayBuffer for IPC transfer
 */
export function float32ArrayToBuffer(audioData: Float32Array): ArrayBuffer {
  // Create a new ArrayBuffer and copy the data
  const buffer = new ArrayBuffer(audioData.byteLength);
  const view = new Float32Array(buffer);
  view.set(audioData);
  return buffer;
}

/**
 * Convert ArrayBuffer back to Float32Array after IPC transfer
 */
export function bufferToFloat32Array(buffer: ArrayBuffer): Float32Array {
  return new Float32Array(buffer);
}
