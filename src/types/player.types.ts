export type PlayerEngine = "videojs" | "shaka" | "hlsjs" | "dashjs";

export type StreamingFormat = "mp4" | "hls" | "dash";

export interface DRMConfig {
  type: "widevine" | "playready" | "fairplay";
  licenseUrl: string;
  certificateUrl?: string;
  requestHeaders?: Record<string, string>;
}

export interface VideoSource {
  url: string;
  format: StreamingFormat;
  mimeType?: string;
}

export interface PlayerConfig {
  engine: PlayerEngine;
  source: VideoSource;
  drm?: DRMConfig;
  hls?: HLSConfig;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  volume?: number;
}

export interface PlayerCapabilities {
  hls: boolean;
  dash: boolean;
  drm: boolean;
  playbackRate: boolean;
  qualitySelection: boolean;
  subtitles: boolean;
  audioTrackSelection: boolean;
}

export interface HLSConfig {
  withCredentials?: boolean;
  overrideNative?: boolean;
  bandwidth?: number;
  limitRenditionByPlayerDimensions?: boolean;
}

export interface QualityLevel {
  id: string;
  width: number;
  height: number;
  bitrate: number;
}

export type QualitySelection = "auto" | string;

export interface VHSRepresentation {
  id: string;
  width: number;
  height: number;
  bandwidth: number;
  enabled: (enabled?: boolean) => boolean;
}

export interface PlaybackStats {
  width: number;
  height: number;
  bitrate: number;
  bandwidth: number;
}

/**
 * Metric	Meaning
Startup time:	Initialization start to first playing event
Rebuffer count:	Number of post-start buffering interruptions that recover
Total rebuffering:	Cumulative duration of those interruptions
Error count:	Number of Video.js error events
Last error:	Most recent error message
 */

export interface PlaybackMetrics {
  startupTimeMs: number | null;
  rebufferCount: number;
  totalRebufferingMs: number;
  errorCount: number;
  lastError: string | null;
}

export interface PlaybackDiagnosticsSnapshot {
  currentTime: number;
  duration: number;
  bufferedSeconds: number;
  playbackStats: PlaybackStats;
  playbackMetrics: PlaybackMetrics;
  availableQualities: QualityLevel[];
}
