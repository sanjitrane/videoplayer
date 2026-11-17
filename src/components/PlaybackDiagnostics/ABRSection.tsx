import type { ABRDiagnostics, QualityLevel } from "../../types/player.types";

interface Props {
  abrDiagnostics: ABRDiagnostics;
}

function formatQuality(quality: QualityLevel | null): string {
  if (!quality) return "N/A";
  return `${quality.height}p`;
}

export const ABRSection = ({ abrDiagnostics }: Props) => {
  return (
    <>
      <h3>Adaptive Bitrate (ABR) Diagnostics</h3>
      <div className="diagnostics-grid">
        <div>
          <span>Quality Mode</span>
          <strong>{abrDiagnostics.mode.toUpperCase()}</strong>
        </div>
        <div>
          <span>Current Rendention</span>
          <strong>{formatQuality(abrDiagnostics.currentQuality)}</strong>
        </div>
        <div>
          <span>Selected Bitrate</span>
          <strong>
            {abrDiagnostics.currentQuality
              ? `${(abrDiagnostics.currentQuality.bitrate / 1_000_000).toFixed(2)} Mbps`
              : "N/A"}
          </strong>
        </div>
        <div>
          <span>Quality Switches</span>
          <strong>{abrDiagnostics.qualitySwitches.length}</strong>
        </div>
      </div>
      <h3>Quality Switch History</h3>
      {abrDiagnostics.qualitySwitches.length === 0 ? (
        <p className="diagnostics-unavailable">
          No quality changes recorded yet
        </p>
      ) : (
        <div className="event-log-list">
          {[...abrDiagnostics.qualitySwitches].reverse().map((entry) => (
            <div className="event-log-entry" key={entry.id}>
              <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
              <strong>
                {entry.fromQuality} → {entry.toQuality}
              </strong>
              <span>{entry.mode.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
