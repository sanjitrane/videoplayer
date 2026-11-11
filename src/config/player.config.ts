import type { PlayerConfig } from "../types/player.types";

//MP4
/*export const playerConfig: PlayerConfig = {
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
};*/

//hls
export const playerConfig: PlayerConfig = {
  engine: "videojs",
  source: {
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    format: "hls",
    mimeType: "application/x-mpegURL",
  },
  hls: {
    withCredentials: false,
    limitRenditionByPlayerDimensions: true,
  },
  autoplay: false,
  muted: false,
  controls: true,
  volume: 0.8,
};
