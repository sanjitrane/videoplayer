import Hls, {
  Events,
  type ErrorData,
  type Level,
  type LevelSwitchedData,
} from "hls.js";

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

export class HlsJsAdapter implements IPlayerEngine {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private emit?: PlayerEventListener;

  private sessionStartedAt = 0;
  private hasStartedPlayback = false;
  private bufferingStartedAt: number | null = null;

  private qualityMode: QualityMode = "auto";
  private currentQuality: QualityLevel | null = null;
  private qualitySwitches: QualitySwitchEvent[] = [];
  private rejectInitialization?: (error: Error) => void;

  private playbackMetrics: PlaybackMetrics = {
    startupTimeMs: null,
    rebufferCount: 0,
    totalRebufferingMs: 0,
    errorCount: 0,
    lastError: null,
  };

  //Initialization
  async initialize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void> {
    if (this.hls) {
      throw new Error("hls.js is already initialized");
    }

    if (config.source.format !== "hls") {
      throw new Error(
        `hls.js adapter supports HLS only. Received: ${config.source.format}`,
      );
    }

    if (config.drm) {
      throw new Error(
        "DRM configuration is not implemented in the hls.js adapter",
      );
    }

    if (!Hls.isSupported()) {
      throw new Error(
        "hls.js requires Media Source Extensions support in this browser",
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

    const withCredentials = config.hls?.withCredentials;
    const hls = new Hls({
      ...(withCredentials !== undefined && {
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = withCredentials;
        },
      }),
    });

    this.hls = hls;
    hls.on(Events.ERROR, this.handleError);
    hls.on(Events.LEVEL_SWITCHED, this.handleLevelSwitched);
    this.registerVideoEvents(videoElement);

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        // eslint-disable-next-line prefer-const
        let timeout: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          hls.off(Events.MANIFEST_PARSED, onManifestParsed);
          clearTimeout(timeout);
          this.rejectInitialization = undefined;
        };

        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          cleanup();

          if (error) {
            reject(error);
          } else {
            this.currentQuality = this.getCurrentQuality();
            this.emitEvent({ type: "ready", currentTime: 0 });
            resolve();
          }
        };
        const onManifestParsed = (): void => {
          finish();
        };

        this.rejectInitialization = (error) => {
          finish(error);
        };

        timeout = setTimeout(() => {
          finish(new Error("Time out while loading the HLS manifest"));
        }, 3000);

        hls.once(Events.MANIFEST_PARSED, onManifestParsed);
        try {
          hls.attachMedia(videoElement);
          hls.loadSource(config.source.url);
        } catch (error) {
          finish(
            error instanceof Error
              ? error
              : new Error("Unable to initialize hls.js"),
          );
        }
      });
    } catch (error) {
      await this.destroy();
      throw error;
    }
  }

  //HTML video events

  private registerVideoEvents(videoElement: HTMLVideoElement): void {
    videoElement.addEventListener("playing", this.handlePlaying);
    videoElement.addEventListener("pause", this.handlePaused);
    videoElement.addEventListener("waiting", this.handleWaiting);
    videoElement.addEventListener("ended", this.handleEnded);
    videoElement.addEventListener("timeupdate", this.handleTimeUpdate);
    videoElement.addEventListener("volumechange", this.handleVolumeChange);
  }

  private removeVideoEvents(videoElement: HTMLVideoElement): void {
    videoElement.removeEventListener("playing", this.handlePlaying);
    videoElement.removeEventListener("pause", this.handlePaused);
    videoElement.removeEventListener("waiting", this.handleWaiting);
    videoElement.removeEventListener("ended", this.handleEnded);
    videoElement.removeEventListener("timeupdate", this.handleTimeUpdate);
    videoElement.removeEventListener("volumechange", this.handleVolumeChange);
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

  //hls.js errors
  private handleError = (_event: Events.ERROR, data: ErrorData): void => {
    const message = data.error?.message ?? `${data.type}: ${data.details}`;
    this.playbackMetrics.errorCount++;
    this.playbackMetrics.lastError = message;

    this.emitEvent({
      type: "error",
      message,
      originalError: data.error ?? data,
    });
    if (data.fatal) {
      this.rejectInitialization?.(new Error(message));
    }
  };

  // Quality selection and ABR
  getAvailableQualities(): QualityLevel[] {
    return this.getHls().levels.map((level, index) =>
      this.mapLevel(level, index),
    );
  }

  getCurrentQuality(): QualityLevel | null {
    const hls = this.getHls();
    const currentLevel = hls.currentLevel;
    if (currentLevel < 0 || !hls.levels[currentLevel]) {
      return null;
    }

    return this.mapLevel(hls.levels[currentLevel], currentLevel);
  }

  setQuality(quality: QualitySelection): void {
    const hls = this.getHls();
    if (quality === "auto") {
      hls.currentLevel = -1;
      this.qualityMode = "auto";
      return;
    }

    const levelIndex = Number(quality);
    if (
      !Number.isInteger(levelIndex) ||
      levelIndex < 0 ||
      levelIndex >= hls.levels.length
    ) {
      return;
    }
    //Explicitly select a level and disable ABR
    hls.currentLevel = levelIndex;
    this.qualityMode = "manual";
  }

  getQualityMode(): QualityMode {
    return this.qualityMode;
  }

  getQualitySwitches(): QualitySwitchEvent[] {
    return [...this.qualitySwitches];
  }

  private mapLevel(level: Level, index: number): QualityLevel {
    return {
      id: String(index),
      width: level.width,
      height: level.height,
      bitrate: level.bitrate,
    };
  }

  private handleLevelSwitched = (
    _event: Events.LEVEL_SWITCHED,
    data: LevelSwitchedData,
  ): void => {
    const hls = this.hls;
    if (!hls || !hls.levels[data.level]) {
      return;
    }

    const nextQuality = this.mapLevel(hls.levels[data.level], data.level);
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

  //Player capabilities
  getCapabilities(): PlayerCapabilities {
    return {
      hls: true,
      dash: false,
      drm: false,
      playbackRate: true,
      qualitySelection: true,
      subtitles: false,
      audioTrackSelection: false,
    };
  }

  //Playback stats

  getPlaybackStats(): PlaybackStats {
    const video = this.getVideoElement();
    const hls = this.getHls();
    const quality = this.getCurrentQuality();

    return {
      width: quality?.width ?? video.videoWidth ?? 0,
      height: quality?.height ?? video.videoHeight ?? 0,
      bitrate: quality?.bitrate ?? 0,
      bandwidth: Number.isFinite(hls.bandwidthEstimate)
        ? hls.bandwidthEstimate
        : 0,
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

  // helpers
  private emitEvent(event: PlayerEventData): void {
    this.emit?.(event);
  }

  private getHls(): Hls {
    if (!this.hls) {
      throw new Error("hls.js is not initialized");
    }
    return this.hls;
  }

  private getVideoElement(): HTMLVideoElement {
    if (!this.videoElement) {
      throw new Error("Video Element  is not initialized");
    }
    return this.videoElement;
  }

  //cleanup
  async destroy(): Promise<void> {
    const hls = this.hls;
    const videoElement = this.videoElement;

    this.hls = null;
    this.videoElement = null;
    this.emit = undefined;
    this.rejectInitialization = undefined;
    if (videoElement) {
      this.removeVideoEvents(videoElement);
    }
    if (hls) {
      hls.off(Events.ERROR, this.handleError);
      hls.off(Events.LEVEL_SWITCHED, this.handleLevelSwitched);
      hls.destroy();
    }
    this.currentQuality = null;
    this.qualitySwitches = [];
    this.qualityMode = "auto";
  }
}
