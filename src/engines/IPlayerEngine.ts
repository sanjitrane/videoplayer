import type {
  PlayerConfig,
  PlayerCapabilities,
  QualityLevel,
  QualitySelection,
  PlaybackStats,
} from "../types/player.types";
import type { PlayerEventListener } from "../types/events.types";

export interface IPlayerEngine {
  initialize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void>;

  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPaused(): boolean;
  getCapabilities(): PlayerCapabilities;
  destroy(): Promise<void>;
  getAvailableQualities(): QualityLevel[];
  setQuality(quality: QualitySelection): void;
  getPlaybackStats(): PlaybackStats;
}
