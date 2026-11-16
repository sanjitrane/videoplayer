import type { QualityLevel } from "../../types/player.types";
import { formatBitrate } from "../../utils";

interface Props {
  availableQualities: QualityLevel[];
}

export const AvailableQualities = ({ availableQualities }: Props) => {
  return (
    <>
      <h3>Available Qualities</h3>
      {availableQualities.length === 0 ? (
        <p>No quality information available</p>
      ) : (
        <ul>
          {availableQualities.map((quality) => (
            <li key={quality.id}>
              {quality.width} x {quality.height} -{" "}
              {formatBitrate(quality.bitrate)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
