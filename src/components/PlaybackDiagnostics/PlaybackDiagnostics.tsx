import { PlaybackEventLog } from "./PlaybackEventLog";
import type {
  PlaybackDiagnosticsSnapshot,
  PlaybackLogEntry,
} from "../../types/player.types";
import "./PlaybackDiagnostics.css";
import { NetworkDiagnostics } from "./NetworkDiagnostics";
import { AvailableQualities } from "./AvailableQualities";
import { PlaybackMetricsSection } from "./PlaybackMetricsSection";
import { PlaybackStatsSection } from "./PlaybackStatsSection";
import { formatTime } from "../../utils";
import { ABRSection } from "./ABRSection";
import { BandwidthSection } from "./BandwidthSection";
import { RecoverySection } from "./RecoverySection";

interface PlaybackDiagnosticsProps {
  status: string;
  snapShot: PlaybackDiagnosticsSnapshot | null;
  events: PlaybackLogEntry[];
}

export function PlaybackDiagnostics({
  status,
  snapShot,
  events,
}: PlaybackDiagnosticsProps) {
  if (!snapShot) {
    return <section className="diagnostics">Waiting for player...</section>;
  }

  const {
    playbackStats,
    playbackMetrics,
    networkStats,
    availableQualities,
    abrDiagnostics,
    recoveryStatus,
  } = snapShot;
  return (
    <>
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
              {formatTime(snapShot.currentTime)} /{" "}
              {formatTime(snapShot.duration)}
            </strong>
          </div>
          {playbackStats && (
            <PlaybackStatsSection playbackStats={playbackStats} />
          )}
          <span>Buffer health</span>
          <strong>{snapShot.bufferedSeconds.toFixed(1)} sec</strong>
        </div>
        {playbackMetrics && (
          <PlaybackMetricsSection playbackMetrics={playbackMetrics} />
        )}
        {availableQualities && (
          <AvailableQualities availableQualities={availableQualities} />
        )}
        <PlaybackEventLog events={events} />
        {networkStats && <NetworkDiagnostics networkStats={networkStats} />}
        {abrDiagnostics && <ABRSection abrDiagnostics={abrDiagnostics} />}
        {networkStats && abrDiagnostics && (
          <BandwidthSection
            networkStats={networkStats}
            abrDiagnostics={abrDiagnostics}
          />
        )}
      </section>
      {recoveryStatus && <RecoverySection recoveryStatus={recoveryStatus} />}
    </>
  );
}
