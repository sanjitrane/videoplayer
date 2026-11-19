import shaka from "shaka-player";

import type {
  PlayerConfig,
  PlayerCapabilities,
  QualityLevel,
  QualitySelection,
  PlaybackStats,
  PlaybackMetrics,
  NetworkStats,
  QualityMode,
  QualitySwitchEvent,
} from "../../types/player.types";

import type {
  PlayerEventData,
  PlayerEventListener,
} from "../../types/events.types";

import type { IPlayerEngine } from "../IPlayerEngine";
import type { RecoveryStatus } from "../../types/errors.types";
import { toFiniteNumber } from "../../utils";

type ShakaPlayerInstance = InstanceType<typeof shaka.Player>;
type ShakaVariantTrack = ReturnType<
  ShakaPlayerInstance["getVariantTracks"]
>[number];

export class ShakaAdapter implements IPlayerEngine {
  private player: ShakaPlayerInstance | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private emit?: PlayerEventListener;

  private sessionStartedAt = 0;
  private hasStartedPlayback = false;
  private bufferingStartedAt: number | null = null;

  private qualityMode: QualityMode = "auto";
  private currentQuality: QualityLevel | null = null;
  private qualitySwitches: QualitySwitchEvent[] = [];

  private playbackMetrics: PlaybackMetrics = {
    startupTimeMs: null,
    rebufferCount: 0,
    totalRebufferingMs: 0,
    errorCount: 0,
    lastError: null,
  };

  async initialize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void> {
    if (this.player) {
      throw new Error("Shaka Player is already initialized");
    }
    if (config.source.format !== "hls" && config.source.format !== "dash") {
      throw new Error(
        `Shaka adapter supports HLS & DASH manifests. Received: ${config.source.format}`,
      );
    }

    if (config.drm) {
      throw new Error("Shaka DRM configuration has not yet integrated");
    }
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      throw new Error("Shaka Player is not supported in this browser");
    }

    this.emit = emit;
    this.videoElement = videoElement;
    this.sessionStartedAt = performance.now();
    this.hasStartedPlayback = false;
    this.bufferingStartedAt = null;

    this.qualityMode = "auto";
    this.currentQuality = null;
    this.qualitySwitches = [];

    this.playbackMetrics = {
      startupTimeMs: null,
      rebufferCount: 0,
      totalRebufferingMs: 0,
      errorCount: 0,
      lastError: null,
    };

    videoElement.controls = config.controls ?? true;
    videoElement.autoplay = config.autoplay ?? false;
    videoElement.muted = config.muted ?? false;
    videoElement.volume = config.volume ?? 1;
    videoElement.preload = "auto";

    const player = new shaka.Player();
    this.player = player;

    try {
      player.addEventListener("error", this.handleShakaError);
      player.addEventListener("adaptation", this.handleQualityChange);
      player.addEventListener("variantchanged", this.handleQualityChange);

      this.registerVideoEvents(videoElement);

      await player.attach(videoElement);
      await player.load(config.source.url);

      this.currentQuality = this.getCurrentQuality();
      this.emitEvent({
        type: "ready",
        currentTime: 0,
      });
    } catch (error) {
      await this.destroy();
      throw error;
    }
  }

  // Video element events
  private registerVideoEvents(videoElement: HTMLVideoElement): void {
    videoElement.addEventListener("playing", this.handlePlaying);
    videoElement.addEventListener("pause", this.handlePaused);
    videoElement.addEventListener("waiting", this.handleWaiting);
    videoElement.addEventListener("ended", this.handleEnded);
    videoElement.addEventListener("timeupdate", this.handleTimeUpdate);
    videoElement.addEventListener("volumeChange", this.handleVolumeChange);
  }

  private removeVideoEvents(videoElement: HTMLVideoElement): void {
    videoElement.removeEventListener("playing", this.handlePlaying);
    videoElement.removeEventListener("pause", this.handlePaused);
    videoElement.removeEventListener("waiting", this.handleWaiting);
    videoElement.removeEventListener("ended", this.handleEnded);
    videoElement.removeEventListener("timeupdate", this.handleTimeUpdate);
    videoElement.removeEventListener("volumeChange", this.handleVolumeChange);
  }

  private handlePlaying = (): void => {
    const now = performance.now();

    if (!this.hasStartedPlayback) {
      this.hasStartedPlayback = true;
      this.playbackMetrics.startupTimeMs = now - this.sessionStartedAt;
    } else if (this.bufferingStartedAt !== null) {
      this.playbackMetrics.totalRebufferingMs += now - this.bufferingStartedAt;
      this.bufferingStartedAt = null;
    }
    this.emitEvent({ type: "playing" });
  };

  private handlePaused = (): void => {
    this.emitEvent({ type: "paused" });
  };

  private handleWaiting = (): void => {
    if (
      this.hasStartedPlayback &&
      this.videoElement &&
      !this.videoElement.paused &&
      this.bufferingStartedAt === null
    ) {
      this.bufferingStartedAt = performance.now();
    }
    this.emitEvent({ type: "buffering" });
  };

  private handleEnded = (): void => {
    this.emitEvent({ type: "ended" });
  };

  private handleTimeUpdate = (): void => {
    this.emitEvent({
      type: "timeupdate",
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    });
  };

  private handleVolumeChange = (): void => {
    this.emitEvent({ type: "volumechange" });
  };

  // Shaka error handling

  private handleShakaError = (event: Event): void => {
    const error = (event as CustomEvent<unknown>).detail;

    const message =
      error instanceof Error ? error.message : "Shaka playback error";

    this.playbackMetrics.errorCount++;
    this.playbackMetrics.lastError = message;
    this.emitEvent({ type: "error", message: message, originalError: error });
  };

  //Quality Selection
  getAvailableQualities(): QualityLevel[] {
    return this.getPlayer()
      .getVariantTracks()
      .filter((track) => track.width && track.height)
      .map((track) => ({
        id: String(track.id),
        width: track.width as number,
        height: track.height as number,
        bitrate: track.bandwidth,
      }));
  }

  getCurrentQuality(): QualityLevel | null {
    const activeTrack = this.getPlayer()
      .getVariantTracks()
      .find((track) => track.active);
    if (!activeTrack) return null;
    return this.mapQuality(activeTrack);
  }

  setQuality(quality: QualitySelection): void {
    const player = this.getPlayer();
    if (quality === "auto") {
      this.qualityMode = "auto";
      player.configure({
        abr: {
          enabled: true,
        },
      });
      return;
    }

    const selectedTrack = player
      .getVariantTracks()
      .find((track) => String(track.id) === quality);
    if (!selectedTrack) return;
    player.configure({
      abr: {
        enabled: false,
      },
    });

    player.selectVariantTrack(selectedTrack);
    this.qualityMode = "manual";
  }

  getQualityMode(): QualityMode {
    return this.qualityMode;
  }

  getQualitySwitches(): QualitySwitchEvent[] {
    return [...this.qualitySwitches];
  }

  private mapQuality(track: ShakaVariantTrack): QualityLevel {
    return {
      id: String(track.id),
      width: track.width as number,
      height: track.height as number,
      bitrate: track.bandwidth,
    };
  }

  private handleQualityChange = (): void => {
    const nextQuality = this.getCurrentQuality();
    if (!nextQuality) return;
    const previousQuality = this.currentQuality;
    this.currentQuality = nextQuality;
    if (!previousQuality || previousQuality.id === nextQuality.id) {
      return;
    }

    const timestamp = Date.now();
    const switchEvent: QualitySwitchEvent = {
      id: timestamp,
      timestamp,
      fromQuality: previousQuality.id,
      toQuality: nextQuality.id,
      mode: this.qualityMode,
    };

    this.qualitySwitches = [...this.qualitySwitches, switchEvent].slice(-20);

    this.emitEvent({
      type: "qualitychange",
      previousQuality,
      currentQuality: nextQuality,
      qualityMode: this.qualityMode,
    });
  };

  //Playback controls
  async play(): Promise<void> {
    await this.getVideoElement().play();
  }

  pause(): void {
    this.getVideoElement().pause();
  }

  seek(time: number): void {
    if (!Number.isFinite(time) || time < 0) {
      throw new RangeError("Seek time must be a non-negative number");
    }
    this.getVideoElement().currentTime = time;
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError("Volume must be between 0 and 1");
    }
    this.getVideoElement().volume = volume;
  }

  setMuted(muted: boolean): void {
    this.getVideoElement().muted = muted;
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError("Playback rate must be greater than zero");
    }
    this.getVideoElement().playbackRate = rate;
  }

  getCurrentTime(): number {
    return this.getVideoElement().currentTime || 0;
  }

  getDuration(): number {
    const duration = this.getVideoElement().duration;
    return Number.isFinite(duration) ? duration : 0;
  }

  getPaused(): boolean {
    return this.getVideoElement().paused;
  }

  //Playback information
  getCapabilities(): PlayerCapabilities {
    return {
      hls: true,
      dash: true,
      drm: false,
      playbackRate: true,
      qualitySelection: true,
      subtitles: false,
      audioTrackSelection: false,
    };
  }

  getPlaybackStats(): PlaybackStats {
    const stats = this.getPlayer().getStats();
    return {
      width: toFiniteNumber(stats.width),
      height: toFiniteNumber(stats.height),
      bitrate: toFiniteNumber(stats.streamBandwidth),
      bandwidth: toFiniteNumber(stats.estimatedBandwidth),
    };
  }

  getPlaybackMetrics(): PlaybackMetrics {
    return { ...this.playbackMetrics };
  }

  getNetworkStats(): NetworkStats | null {
    // Shaka's aggregate statistics do not directly provide
    // the request counters expected by the common NetworkStats type.
    // Do not fabricate those values.
    return null;
  }

  getRecoveryStatus(): RecoveryStatus {
    return {
      isRecovering: false,
      retryCount: 0,
      maxRetries: 0,
      outcome: "idle",
    };
  }

  // Helper functions
  private getVideoElement(): HTMLVideoElement {
    if (!this.videoElement) {
      throw new Error("Video element is not initialized");
    }
    return this.videoElement;
  }

  private getPlayer(): ShakaPlayerInstance {
    if (!this.player) {
      throw new Error("Shaka Player is not initialized");
    }

    return this.player;
  }

  private emitEvent(event: PlayerEventData): void {
    this.emit?.(event);
  }

  async destroy(): Promise<void> {
    const player = this.player;
    const videoElement = this.videoElement;
    this.player = null;
    this.videoElement = null;
    this.emit = undefined;

    if (videoElement) {
      this.removeVideoEvents(videoElement);
    }
    if (player) {
      player.removeEventListener("error", this.handleShakaError);
      player.removeEventListener("adaptation", this.handleQualityChange);
      player.removeEventListener("variantchanged", this.handleQualityChange);
      await player.destroy();
    }
    this.currentQuality = null;
    this.qualitySwitches = [];
    this.qualityMode = "auto";
  }
}
