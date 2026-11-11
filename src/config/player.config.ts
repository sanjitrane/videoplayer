import type { PlayerConfig } from "../types/player.types";

export const playerConfig: PlayerConfig = {
  engine: "videojs",
  source: {
    url: "/videos/sample.mp4",
    format: "mp4",
    mimeType: "video/mp4",
  },
  autoplay: false,
  muted: false,
  controls: true,
  volume: 0.8,
};
