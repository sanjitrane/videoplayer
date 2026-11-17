import type { ABRDiagnostics, NetworkStats } from "../../types/player.types";

interface Props {
  networkStats: NetworkStats;
  abrDiagnostics: ABRDiagnostics;
}

export const BandwidthSection = ({ networkStats, abrDiagnostics }: Props) => {
  return (
    <>
      <h3>Bandwidth vs Rendition</h3>
      <div>
        <span>Estimated Bandwidth</span>
        <strong>
          {networkStats
            ? `${(networkStats.bandwidth / 1_000_000).toFixed(2)} Mbps`
            : "N/A"}
        </strong>
      </div>
      <div>
        <span>Selected Rendition Bitrate</span>
        <strong>
          {abrDiagnostics.currentQuality
            ? `${(abrDiagnostics.currentQuality.bitrate / 1_000_000).toFixed(2)} Mbps`
            : "N/A"}
        </strong>
      </div>
    </>
  );
};
