import type { PlayerConfig } from "../types/player.types";

const mp4 = false;
const useShakaHls = true;
const player: string = "dashjs";

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
    url: "http://sample.vodobox.net/skate_phantom_flex_4k/skate_phantom_flex_4k.m3u8", //"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
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

const shakaPlayerConfig: PlayerConfig = {
  engine: "shaka",
  source: {
    url: "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd",
    format: "dash",
  },
  autoplay: false,
  muted: false,
  controls: true,
  volume: 0.8,
};

const shakaHlsPlayerConfig: PlayerConfig = {
  ...hlsplayerConfig,
  engine: "shaka",
};

const hlsJsPlayerConfig: PlayerConfig = {
  ...hlsplayerConfig,
  engine: "hlsjs",
};

const dashJsPlayerConfig: PlayerConfig = {
  engine: "dashjs",
  source: {
    url: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
    format: "dash",
  },
  autoplay: false,
  muted: false,
  controls: true,
  volume: 0.8,
};

const getPlayerConfig = (): PlayerConfig => {
  let playerConfig: PlayerConfig;
  switch (player) {
    case "videojs":
      playerConfig = mp4 ? mp4playerConfig : hlsplayerConfig;
      break;
    case "shaka":
      playerConfig = useShakaHls ? shakaHlsPlayerConfig : shakaPlayerConfig;
      break;
    case "hlsjs":
      playerConfig = hlsJsPlayerConfig;
      break;
    case "dashjs":
      playerConfig = dashJsPlayerConfig;
      break;
    default:
      playerConfig = mp4playerConfig;
  }
  return playerConfig;
};

export const playerConfig: PlayerConfig = getPlayerConfig();

// export const playerConfig = useShaka
//   ? useShakaHls
//     ? shakaHlsPlayerConfig
//     : shakaPlayerConfig
//   : mp4
//     ? mp4playerConfig
//     : hlsplayerConfig;
