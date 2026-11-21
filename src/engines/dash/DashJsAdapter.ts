import * as dashjs from "dashjs";

import type {
  NetworkStats,
  PlayerConfig,
  PlayerCapabilities,
  PlaybackStats,
  PlaybackMetrics,
  QualityLevel,
  QualitySelection,
  QualityMode,
  QualitySwitchEvent,
} from "../../types/player.types";

import type {
  PlayerEventListener,
  PlayerEventData,
} from "../../types/events.types";
import type { IPlayerEngine } from "../IPlayerEngine";
import type { RecoveryStatus } from "../../types/errors.types";

type DashPlayer = dashjs.MediaPlayerClass;
type DashRepresentation = dashjs.Representation;

export class DashJsAdapter implements IPlayerEngine {
  private player: DashPlayer | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private emit?: PlayerEventListener;

  private sessionStartedAt = 0;
  private hasStartedPlayback = false;
  private bufferingStartedAt: number | null = null;

  private qualityMode: QualityMode = "auto";
  private currentQuality: QualityLevel | null = null;
  private qualitySwitches: QualitySwitchEvent[] = [];

  private resolveInitialization?: () => void;
  private rejectInitalization?: (error: Error) => void;

  private initalizationTimeout: ReturnType<typeof setTimeout> | null = null;
  private playbackMetrics: PlaybackMetrics = {
    startupTimeMs: null,
    rebufferCount: 0,
    totalRebufferingMs: 0,
    errorCount: 0,
    lastError: null,
  };

  // Initialization
  async initialize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void> {
    if (this.player) {
      throw new Error("dash.js is already initialized");
    }

    if (config.source.format !== "dash") {
      throw new Error(
        `dash.js adapter supports DASH only. Received ${config.source.format} `,
      );
    }

    if (config.drm) {
      throw new Error(
        "DRM configuration is not implemented in the current dash.js adapter",
      );
    }

    this.videoElement = videoElement;
    this.emit = emit;
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
    videoElement.playsInline = true;

    const player = dashjs.MediaPlayer().create();
    this.player = player;

    player.on(dashjs.MediaPlayer.events.ERROR, this.handleDashError);

    player.on(
      dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED,
      this.handleQualityChange,
    );

    this.registerVideoEvents(videoElement);

    try {
      await new Promise<void>((resolve, reject) => {
        this.resolveInitialization = resolve;
        this.rejectInitalization = reject;

        this.initalizationTimeout = setTimeout(() => {
          this.finishInitalization(
            new Error("Timed out while loading the DASH manifest"),
          );
        }, 3000);

        player.on(
          dashjs.MediaPlayer.events.STREAM_INITIALIZED,
          this.handleStreamInitialized,
        );

        try {
          player.initialize(
            videoElement,
            config.source.url,
            config.autoplay ?? false,
          );
        } catch (error) {
          this.finishInitalization(this.toError(error));
        }
      });

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

  private finishInitalization(error?: Error): void {
    const resolve = this.resolveInitialization;
    const reject = this.rejectInitalization;

    if (!resolve || !reject) {
      return;
    }

    if (this.initalizationTimeout !== null) {
      clearTimeout(this.initalizationTimeout);
      this.initalizationTimeout = null;
    }
    this.player?.off(
      dashjs.MediaPlayer.events.STREAM_INITIALIZED,
      this.handleStreamInitialized,
    );

    this.resolveInitialization = undefined;
    this.rejectInitalization = undefined;

    if (error) {
      reject(error);
    } else {
      resolve();
    }
  }

  private handleStreamInitialized = (event: dashjs.MediaPlayerEvent): void => {
    const streamEvent = event as dashjs.StreamInitializedEvent;
    if (streamEvent.error) {
      this.finishInitalization(streamEvent.error);
      return;
    }

    this.finishInitalization();
  };

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
      this.playbackMetrics.rebufferCount++;
      this.playbackMetrics.totalRebufferingMs += now - this.bufferingStartedAt;
      this.bufferingStartedAt = null;
    }
    this.emitEvent({ type: "playing" });
  };

  private handlePaused = (): void => {
    this.emitEvent({ type: "paused" });
  };

  private handleWaiting = (): void => {
    const video = this.videoElement;
    if (
      this.hasStartedPlayback &&
      video &&
      !video.paused &&
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

  // dash.js error handling
  private handleDashError = (event: dashjs.MediaPlayerEvent): void => {
    const message = this.getDashErrorMessage(event);
    this.playbackMetrics.errorCount++;
    this.playbackMetrics.lastError = message;

    this.emitEvent({
      type: "error",
      message,
      originalError: event,
    });
    this.finishInitalization(new Error(message));
  };

  private getDashErrorMessage(event: dashjs.MediaPlayerEvent): string {
    const detail = event as unknown as {
      error?: unknown;
      event?: unknown;
    };

    if (
      detail.event &&
      typeof detail.event === "object" &&
      "message" in detail.event &&
      typeof detail.event.message === "string"
    ) {
      return detail.event.message;
    }

    if (
      detail.error &&
      typeof detail.error === "object" &&
      "message" in detail.error &&
      typeof detail.error.message === "string"
    ) {
      return detail.error.message;
    }

    if (typeof detail.error === "string") {
      return `DASH playback error: ${detail.error}`;
    }
    return "Unknown dash.js playback error";
  }

  // Quality selection and ABR
  getAvailableQualities(): QualityLevel[] {
    return this.getPlayer()
      .getRepresentationsByType("video")
      .map((representation) => this.mapRepresentation(representation));
  }

  getCurrentQuality(): QualityLevel | null {
    const representation =
      this.getPlayer().getCurrentRepresentationForType("video");

    return representation ? this.mapRepresentation(representation) : null;
  }

  setQuality(quality: QualitySelection): void {
    const player = this.getPlayer();
    if (quality === "auto") {
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: true,
            },
          },
        },
      });
      this.qualityMode = "auto";
      return;
    }
    const representation = player
      .getRepresentationsByType("video")
      .find((item) => String(item.id) === quality);

    if (!representation) return;
    player.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            video: false,
          },
        },
      },
    });

    player.setRepresentationForTypeById("video", representation.id, true);
    this.qualityMode = "manual";
  }

  getQualityMode(): QualityMode {
    return this.qualityMode;
  }

  getQualitySwitches(): QualitySwitchEvent[] {
    return [...this.qualitySwitches];
  }

  private mapRepresentation(representation: DashRepresentation): QualityLevel {
    return {
      id: String(representation.id),
      width: representation.width,
      height: representation.height,
      bitrate: representation.bandwidth,
    };
  }

  private handleQualityChange = (event: dashjs.MediaPlayerEvent): void => {
    const qualityEvent = event as dashjs.QualityChangeRenderedEvent;

    if (qualityEvent.mediaType !== "video" || !qualityEvent.newRepresentation) {
      return;
    }

    const nextQuality = this.mapRepresentation(qualityEvent.newRepresentation);
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
    if (Number.isFinite(rate) || rate <= 0) {
      throw new RangeError("Playback rate must be greater than zero");
    }
    this.getVideoElement().playbackRate = rate;
  }

  getCurrentTime(): number {
    return this.getVideoElement().currentTime || 0;
  }

  getDuration(): number {
    const duration = this.getPlayer().duration();
    return Number.isFinite(duration) ? duration : 0;
  }

  getPaused(): boolean {
    return this.getVideoElement().paused;
  }

  // Capabilities
  getCapabilities(): PlayerCapabilities {
    return {
      hls: false,
      dash: true,
      drm: false,
      playbackRate: true,
      qualitySelection: true,
      subtitles: false,
      audioTrackSelection: false,
    };
  }

  // Playback Stats
  getPlaybackStats(): PlaybackStats {
    const player = this.getPlayer();
    const video = this.getVideoElement();
    const representation = player.getCurrentRepresentationForType("video");

    // dash.js reports average throughput in kbit/s.
    // Convert to bit/s to match the common player statistics.
    const throughputKbps = player.getAverageThroughput("video");
    return {
      width: representation?.width ?? video.videoWidth ?? 0,
      height: representation?.height ?? video.videoHeight ?? 0,
      bitrate: representation?.bandwidth ?? 0,
      bandwidth: Number.isFinite(throughputKbps) ? throughputKbps * 1000 : 0,
    };
  }

  getPlaybackMetrics(): PlaybackMetrics {
    return { ...this.playbackMetrics };
  }

  getNetworkStats(): NetworkStats | null {
    // Detailed request counters are not mapped to the
    // common NetworkStats contract in this implementation.
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

  //Helpers
  private emitEvent(event: PlayerEventData): void {
    this.emit?.(event);
  }

  private getPlayer(): DashPlayer {
    if (!this.player) {
      throw new Error("dash.js is not initialized");
    }
    return this.player;
  }

  private getVideoElement(): HTMLVideoElement {
    if (!this.videoElement) {
      throw new Error("Video element is not initialized");
    }
    return this.videoElement;
  }

  private toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  //Cleanup
  async destroy(): Promise<void> {
    const player = this.player;
    const videoElement = this.videoElement;

    if (this.resolveInitialization || this.rejectInitalization) {
      this.finishInitalization(
        new Error("dash.js player was destroyed during initalization"),
      );
    }
    this.player = null;
    this.videoElement = null;
    this.emit = undefined;
    if (this.initalizationTimeout !== null) {
      clearTimeout(this.initalizationTimeout);
      this.initalizationTimeout = null;
    }

    if (videoElement) {
      this.removeVideoEvents(videoElement);
    }

    if (player) {
      player.off(dashjs.MediaPlayer.events.ERROR, this.handleDashError);
      player.off(
        dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED,
        this.handleQualityChange,
      );
      player.off(
        dashjs.MediaPlayer.events.STREAM_INITIALIZED,
        this.handleStreamInitialized,
      );
      player.destroy();
    }

    this.currentQuality = null;
    this.qualitySwitches = [];
    this.qualityMode = "auto";
    this.bufferingStartedAt = null;
    this.hasStartedPlayback = false;
  }
}
