import type { PlaybackMetrics } from "../../types/player.types";

interface Props {
  playbackMetrics: PlaybackMetrics;
}

export const PlaybackMetricsSection = ({ playbackMetrics }: Props) => {
  return (
    <>
      <h3>Playback Metrics</h3>
      <div className="diagnostics-grid">
        <div>
          <span>Startup Time</span>
          <strong>
            {playbackMetrics.startupTimeMs !== null
              ? `${playbackMetrics.startupTimeMs.toFixed(0)} ms`
              : "N/A"}
          </strong>
        </div>
        <div>
          <span>Rebuffer duration</span>
          <strong>
            {(playbackMetrics.totalRebufferingMs / 1000).toFixed(1)} sec
          </strong>
        </div>
        <div>
          <span>Error Count</span>
          <strong>{playbackMetrics.errorCount}</strong>
        </div>
      </div>
      {playbackMetrics.lastError && (
        <div className="diagnostics-error">
          Last Error: {playbackMetrics.lastError}
        </div>
      )}
    </>
  );
};
