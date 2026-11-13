import type { PlaybackDiagnosticsSnapshot } from "../../types/player.types";
import "./PlaybackDiagnostics.css";

interface PlaybackDiagnosticsProps {
  status: string;
  snapShot: PlaybackDiagnosticsSnapshot | null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatBitrate(bitrate: number): string {
  return bitrate > 0 ? `${(bitrate / 1_00_000).toFixed(2)} Mbps` : "N/A";
}

export function PlaybackDiagnostics({
  status,
  snapShot,
}: PlaybackDiagnosticsProps) {
  if (!snapShot) {
    return <section className="diagnostics">Waiting for player...</section>;
  }

  const { playbackStats, playbackMetrics } = snapShot;
  return (
    <section className="diagnostics">
      <div className="diagnostics-header">
        <h2>Player Diagnostics</h2>
        <span className="diagnostics-live">LIVE</span>
      </div>
      <div className="diagnostics-grid">
        <div>
          <span>Status</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>Playback time</span>
          <strong>
            {formatTime(snapShot.currentTime)} / {formatTime(snapShot.duration)}
          </strong>
        </div>
        <div>
          <span>Resolution</span>
          <strong>
            {playbackStats.width || 0} x {playbackStats.height || 0}
          </strong>
        </div>
        <div>
          <span>Bitrate</span>
          <strong>{formatBitrate(playbackStats.bitrate)}</strong>
        </div>
        <div>Bandwidth</div>
        <strong>{formatBitrate(playbackStats.bandwidth)}</strong>
      </div>
      <div>
        <span>Buffer health</span>
        <strong>{snapShot.bufferedSeconds.toFixed(1)} sec</strong>
      </div>
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
      <h3>Available Qualities</h3>
      {snapShot.availableQualities.length === 0 ? (
        <p>No quality information available</p>
      ) : (
        <ul>
          {snapShot.availableQualities.map((quality) => (
            <li key={quality.id}>
              {quality.width} x {quality.height} -{" "}
              {formatBitrate(quality.bitrate)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
