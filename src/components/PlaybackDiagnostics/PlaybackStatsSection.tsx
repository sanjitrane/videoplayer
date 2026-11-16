import type { PlaybackStats } from "../../types/player.types";
import { formatBitrate } from "../../utils";

interface Props {
  playbackStats: PlaybackStats;
}

export const PlaybackStatsSection = ({ playbackStats }: Props) => {
  return (
    <>
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
    </>
  );
};
