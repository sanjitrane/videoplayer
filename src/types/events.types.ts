import type { PlayerError } from "./errors.types";
import type { QualityLevel, QualityMode } from "./player.types";

export type PlayerEvent =
  | "ready"
  | "playing"
  | "paused"
  | "buffering"
  | "ended"
  | "timeupdate"
  | "volumechange"
  | "qualitychange"
  | "error";

export interface PlayerEventData {
  type: PlayerEvent;
  currentTime?: number;
  duration?: number;
  message?: string;
  originalError?: unknown;
  previousQuality?: QualityLevel | null;
  currentQuality?: QualityLevel | null;
  qualityMode?: QualityMode;
  playerError?: PlayerError;
}

export type PlayerEventListener = (event: PlayerEventData) => void;
