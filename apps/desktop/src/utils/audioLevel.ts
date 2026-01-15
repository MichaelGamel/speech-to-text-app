/**
 * Audio Level Utility
 * Calculates audio level from raw audio samples for visualization
 */

/**
 * Calculate RMS (Root Mean Square) audio level from Float32Array samples.
 * RMS provides an accurate representation of perceived audio volume.
 *
 * @param samples - Float32Array of audio samples (values typically -1 to 1)
 * @returns Normalized audio level between 0 and 1
 */
export function calculateRMSLevel(samples: Float32Array): number {
  // Handle edge cases
  if (!samples || samples.length === 0) {
    return 0;
  }

  // Calculate sum of squared samples
  let sumOfSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumOfSquares += samples[i] * samples[i];
  }

  // Calculate RMS (Root Mean Square)
  const rms = Math.sqrt(sumOfSquares / samples.length);

  // RMS of audio samples is typically quite low (0.01-0.3 for normal speech)
  // Scale it up for better visual representation while capping at 1
  // A scaling factor of ~3 makes normal speech visible while leaving headroom
  const scaledLevel = Math.min(1, rms * 3);

  return scaledLevel;
}

/**
 * Apply exponential smoothing to audio level for smoother visual transitions.
 * This helps prevent jittery visualization by blending current and previous values.
 *
 * @param currentLevel - Current calculated audio level (0-1)
 * @param previousLevel - Previous smoothed level (0-1)
 * @param smoothingFactor - Smoothing amount (0-1, higher = more smoothing)
 * @returns Smoothed audio level between 0 and 1
 */
export function smoothAudioLevel(
  currentLevel: number,
  previousLevel: number,
  smoothingFactor: number = 0.3
): number {
  // Clamp inputs to valid range
  const clampedCurrent = Math.max(0, Math.min(1, currentLevel));
  const clampedPrevious = Math.max(0, Math.min(1, previousLevel));
  const clampedSmoothing = Math.max(0, Math.min(1, smoothingFactor));

  // Apply exponential smoothing: new = previous * factor + current * (1 - factor)
  return clampedPrevious * clampedSmoothing + clampedCurrent * (1 - clampedSmoothing);
}
