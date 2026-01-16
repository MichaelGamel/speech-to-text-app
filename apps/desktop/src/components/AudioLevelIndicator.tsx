import { useMemo } from "react";

interface AudioLevelIndicatorProps {
  /** Audio level from 0 (silence) to 1 (max volume) */
  audioLevel: number;
  /** Number of bars to display */
  barCount?: number;
}

/**
 * Displays audio level as an animated bar visualization.
 * Each bar animates based on the audio level with slight variation
 * to create a natural waveform-like effect.
 */
export const AudioLevelIndicator = ({
  audioLevel,
  barCount = 5,
}: AudioLevelIndicatorProps) => {
  // Generate multipliers for each bar to create variation
  // Center bars are more responsive, outer bars less so
  const barMultipliers = useMemo(() => {
    const multipliers: number[] = [];
    const center = (barCount - 1) / 2;

    for (let i = 0; i < barCount; i++) {
      // Distance from center (0 at center, increases outward)
      const distanceFromCenter = Math.abs(i - center);
      // Center bars get higher multiplier, outer bars lower
      const multiplier = 1 - (distanceFromCenter / barCount) * 0.6;
      multipliers.push(multiplier);
    }

    return multipliers;
  }, [barCount]);

  // Calculate height for each bar based on audio level
  const getBarHeight = (multiplier: number): number => {
    // Apply non-linear scaling for better visual response
    // Power 0.65 provides good balance: quiet sounds are visible but loud doesn't max out
    const scaledLevel = Math.pow(audioLevel, 0.65);

    // Minimum height thresholds for visual distinction
    // Active state: 25% min height for clear indication
    // Idle state: 15% min height for subtle baseline
    const minHeight = audioLevel > 0.02 ? 0.25 : 0.15;
    const maxHeight = 1;

    // Calculate height with per-bar variation
    const height = minHeight + (maxHeight - minHeight) * scaledLevel * multiplier;

    return Math.min(maxHeight, Math.max(minHeight, height));
  };

  return (
    <div
      className="flex items-center gap-0.5 h-4"
      role="meter"
      aria-label="Audio level"
      aria-valuenow={Math.round(audioLevel * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {barMultipliers.map((multiplier, index) => {
        const height = getBarHeight(multiplier);
        // Threshold for "active" coloring - slightly above noise floor
        const isActive = audioLevel > 0.03;

        return (
          <div
            key={index}
            className={`
              w-1 rounded-full transition-all duration-75 ease-out
              ${isActive ? "bg-recording" : "bg-dark-700"}
            `}
            style={{
              height: `${height * 100}%`,
              // Higher base opacity (0.75) for better visibility
              // Scale up to full opacity with height
              opacity: isActive ? 0.75 + height * 0.25 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
};
