interface AudioPlaybackProps {
  audioUrl: string | null;
}

/**
 * Audio playback component for previewing recorded audio
 * Renders an HTML5 audio element with native controls
 */
export const AudioPlayback = ({ audioUrl }: AudioPlaybackProps) => {
  // Don't render anything if no audio URL is available
  if (!audioUrl) {
    return null;
  }

  return (
    <div className="mt-3">
      <audio
        controls
        src={audioUrl}
        className="w-full h-10 rounded-lg"
        style={{
          filter: "invert(1) hue-rotate(180deg)",
          opacity: 0.9,
        }}
      >
        Your browser does not support the audio element.
      </audio>
    </div>
  );
};
