import type { PlayerConfig, PlayerCapabilities } from "../types/player.types";
import type { PlayerEventListener } from "../types/events.types";

export interface IPlayerEngine {
  initalize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void>;

  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>;
  getCurrentTime(): number;
  getDuration(): number;
  getPaused(): boolean;
  getCapabilities(): PlayerCapabilities;
  destroy(): Promise<void>;
}
