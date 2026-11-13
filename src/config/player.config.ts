import type { PlayerConfig } from "../types/player.types";

const mp4 = true;

//MP4
const mp4playerConfig: PlayerConfig = {
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

//hls
const hlsplayerConfig: PlayerConfig = {
  engine: "videojs",
  source: {
    url: "https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8", //"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
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

export const playerConfig = mp4 ? mp4playerConfig : hlsplayerConfig;
