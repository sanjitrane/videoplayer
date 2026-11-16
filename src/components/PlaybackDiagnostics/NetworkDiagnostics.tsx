import type { NetworkStats } from "../../types/player.types";

interface Props {
  networkStats: NetworkStats | null;
}

export const NetworkDiagnostics = ({ networkStats }: Props) => {
  return (
    <>
      <h3>Network Diagnostics</h3>
      {networkStats ? (
        <div className="diagnostics-grid">
          <div>
            <span>Download Bandwidth</span>
            <strong>
              {(networkStats.bandwidth / 1_000_000).toFixed(2)} Mbps
            </strong>
          </div>
          <div>
            <span>Media Requests</span>
            <strong>{networkStats.mediaRequests}</strong>
          </div>
          <div>
            <span>Aborted Requests</span>
            <strong>{networkStats.mediaRequestAborted}</strong>
          </div>
          <div>
            <span>Timed Out Requests</span>
            <strong>{networkStats.mediaRequestsTimedout}</strong>
          </div>
          <div>
            <span>Failed Requests</span>
            <strong>{networkStats.mediaRequestsErrored}</strong>
          </div>
          <div>
            <span>Transferred Data</span>
            <strong>
              {(networkStats.mediaBytesTransferred / (1024 * 1024)).toFixed(2)}{" "}
              MB
            </strong>
          </div>
          <div>
            <span>Transfer Duration</span>
            <strong>
              {(networkStats.mediaTransferDuration / 1000).toFixed(2)} sec
            </strong>
          </div>
          <div>
            <span>Media Seconds Loaded</span>
            <strong>{networkStats.mediaSecondsLoaded.toFixed(2)} sec</strong>
          </div>
        </div>
      ) : (
        <div>
          <p className="diagnostics-unavailable">
            Network statistics unavailable for this playback engine or source.
          </p>
        </div>
      )}
    </>
  );
};
