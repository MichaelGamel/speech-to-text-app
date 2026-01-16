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
  // Use a scaling factor of 2.5 with soft clipping for better dynamic range:
  // - Normal speech (RMS 0.05-0.15) maps to 0.125-0.375, showing clear activity
  // - Louder speech (RMS 0.2-0.4) maps to 0.5-0.85, without immediately maxing out
  // - Very loud sounds approach but don't harshly clip at 1.0
  const scaled = rms * 2.5;
  // Apply soft clipping using tanh for natural limiting
  const scaledLevel = scaled < 0.8 ? scaled : 0.8 + 0.2 * Math.tanh((scaled - 0.8) * 5);

  return Math.min(1, scaledLevel);
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

/**
 * Apply asymmetric smoothing to audio level for natural envelope following.
 * Uses faster attack (quick response to louder sounds) and slower decay
 * (gradual fade-out) which feels more natural to the eye.
 *
 * @param currentLevel - Current calculated audio level (0-1)
 * @param previousLevel - Previous smoothed level (0-1)
 * @param attackFactor - Smoothing for rising levels (0-1, lower = faster attack)
 * @param decayFactor - Smoothing for falling levels (0-1, higher = slower decay)
 * @returns Smoothed audio level between 0 and 1
 */
export function smoothAudioLevelAsymmetric(
  currentLevel: number,
  previousLevel: number,
  attackFactor: number = 0.15,
  decayFactor: number = 0.4
): number {
  // Clamp inputs to valid range
  const clampedCurrent = Math.max(0, Math.min(1, currentLevel));
  const clampedPrevious = Math.max(0, Math.min(1, previousLevel));

  // Use different smoothing factors for attack vs decay
  const isRising = clampedCurrent > clampedPrevious;
  const factor = isRising ? attackFactor : decayFactor;

  // Apply exponential smoothing with chosen factor
  return clampedPrevious * factor + clampedCurrent * (1 - factor);
}
