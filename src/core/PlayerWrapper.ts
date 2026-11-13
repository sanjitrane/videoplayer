import type {
  PlayerConfig,
  PlayerCapabilities,
  PlaybackStats,
  PlaybackMetrics,
  PlaybackDiagnosticsSnapshot,
  QualityLevel,
  QualitySelection,
} from "../types/player.types";

import type { PlayerEvent, PlayerEventListener } from "../types/events.types";

import type { IPlayerEngine } from "../engines/IPlayerEngine";

import { EngineFactory } from "./EngineFactory";
import { EventManager } from "./EventManager";

export class PlayerWrapper {
  private engine?: IPlayerEngine;
  private videoElement?: HTMLVideoElement;
  private config: PlayerConfig;
  private engineFactory: EngineFactory;
  private events = new EventManager();

  constructor(config: PlayerConfig, engineFactory: EngineFactory) {
    this.config = config;
    this.engineFactory = engineFactory;
  }

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    if (this.engine) {
      throw new Error("Player is already initalized");
    }
    this.videoElement = videoElement;

    this.engine = this.engineFactory.create(this.config.engine);

    await this.engine.initialize(videoElement, this.config, (event) =>
      this.events.emit(event),
    );
  }

  async switchEngine(config: PlayerConfig): Promise<void> {
    if (!this.videoElement) {
      throw new Error("Player not initialized");
    }
    const videoElement = this.videoElement;
    await this.destroyEngine();
    this.config = config;
    await this.initialize(videoElement);
  }

  on(event: PlayerEvent, listener: PlayerEventListener): void {
    this.events.on(event, listener);
  }

  off(event: PlayerEvent, listener: PlayerEventListener): void {
    this.events.off(event, listener);
  }

  async play(): Promise<void> {
    this.ensureInitalized();
    await this.engine!.play();
  }

  pause(): void {
    this.ensureInitalized();
    this.engine!.pause();
  }

  seekTime(time: number): void {
    this.ensureInitalized();
    this.engine!.seek(time);
  }

  setVolume(volume: number): void {
    this.ensureInitalized();
    if (volume < 0 || volume > 1) {
      throw new RangeError("Volume must be between 0 and 1");
    }
    this.engine!.setVolume(volume);
  }

  setMuted(muted: boolean): void {
    this.ensureInitalized();
    this.engine!.setMuted(muted);
  }

  setPlaybackRate(rate: number): void {
    this.ensureInitalized();
    this.engine!.setPlaybackRate(rate);
  }

  getCurrentTime(): number {
    this.ensureInitalized();
    return this.engine!.getCurrentTime();
  }

  getDuration(): number {
    this.ensureInitalized();
    return this.engine!.getDuration();
  }

  getCapabilities(): PlayerCapabilities {
    this.ensureInitalized();
    return this.engine!.getCapabilities();
  }

  getAvailableQualities(): QualityLevel[] {
    this.ensureInitalized();
    return this.engine?.getAvailableQualities() ?? [];
  }

  setQuality(quality: QualitySelection): void {
    this.engine?.setQuality(quality);
  }

  getPlaybackStats(): PlaybackStats {
    this.ensureInitalized();
    return this.engine!.getPlaybackStats();
  }

  getPlaybackMetrics(): PlaybackMetrics {
    this.ensureInitalized();
    return this.engine!.getPlaybackMetrics();
  }

  getDiagnosticsSnapshot(): PlaybackDiagnosticsSnapshot {
    this.ensureInitalized();
    const currentTime = this.engine!.getCurrentTime();
    const duration = this.engine!.getDuration();
    let bufferedSeconds = 0;

    if (this.videoElement) {
      const buffered = this.videoElement.buffered;
      for (let i = 0; i < buffered.length; i++) {
        const start = buffered.start(i);
        const end = buffered.end(i);

        if (currentTime >= start && currentTime <= end) {
          bufferedSeconds = Math.max(0, end - currentTime);
          break;
        }
      }
    }
    return {
      currentTime,
      duration,
      bufferedSeconds,
      playbackStats: this.engine!.getPlaybackStats(),
      playbackMetrics: this.engine!.getPlaybackMetrics(),
      availableQualities: this.engine!.getAvailableQualities(),
    };
  }

  private ensureInitalized(): void {
    if (!this.engine) {
      throw new Error("Player not initialized");
    }
  }

  private async destroyEngine(): Promise<void> {
    if (this.engine) {
      const currentEngine = this.engine;
      //Clear the reference before destruction to prevent additional commands from using a shutting-down engine
      this.engine = undefined;
      await currentEngine.destroy();
    }
  }

  async destroy(): Promise<void> {
    await this.destroyEngine();
    this.videoElement = undefined;
    this.events.removeAllListener();
  }
}
