import videojs from "video.js";
import "video.js/dist/video-js.css";

import type {
  PlayerConfig,
  PlayerCapabilities,
  QualitySelection,
  VHSRepresentation,
  QualityLevel,
} from "../../types/player.types";
import type {
  PlayerEventData,
  PlayerEventListener,
} from "../../types/events.types";

import type { IPlayerEngine } from "../IPlayerEngine";

type VideoJSPlayer = ReturnType<typeof videojs>;

type VHSCompatibleTech = {
  vhs?: {
    representations: () => VHSRepresentation[];
  };
};

export class VideoJsAdapter implements IPlayerEngine {
  private player: VideoJSPlayer | null = null;

  private emit?: PlayerEventListener;
  private supportedFormats = ["mp4", "hls"];

  async initialize(
    videoElement: HTMLVideoElement,
    config: PlayerConfig,
    emit: PlayerEventListener,
  ): Promise<void> {
    if (this.player) {
      throw new Error("Video.js is already initialized");
    }

    if (!this.supportedFormats.includes(config.source.format)) {
      throw new Error(
        `Video.js adapter currently supports MP4 and HLS. Received: ${config.source.format}`,
      );
    }

    if (config.drm) {
      throw new Error(`DRM is not implemented in the current Video.js adapter`);
    }

    this.emit = emit;

    const player = videojs(videoElement, {
      controls: config.controls ?? true,
      autoplay: config.autoplay ?? false,
      muted: config.muted ?? false,
      fluid: true,
      responsive: true,
      preload: "auto",
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      html5: {
        vhs: {
          ...(config.hls?.withCredentials !== undefined && {
            withCredentials: config.hls.withCredentials,
          }),

          ...(config.hls?.overrideNative !== undefined && {
            overrideNative: config.hls.overrideNative,
          }),

          ...(config.hls?.bandwidth !== undefined && {
            bandwidth: config.hls.bandwidth,
          }),
          ...(config.hls?.limitRenditionByPlayerDimensions !== undefined && {
            limitRenditionByPlayerDimensions:
              config.hls.limitRenditionByPlayerDimensions,
          }),
        },
      },
    });

    this.player = player;
    this.registerEvents();

    await new Promise<void>((resolve, reject) => {
      player.ready(() => {
        if (player.isDisposed()) {
          reject(
            new Error("Video.js player was disposed during initialization"),
          );
          return;
        }
        try {
          const mimeType =
            config.source.mimeType ??
            (config.source.format === "hls"
              ? "application/x-mpegURL"
              : "video/mp4");
          player.src({
            src: config.source.url,
            type: mimeType,
          });

          player.volume(config.volume ?? 1);

          this.emitEvent({
            type: "ready",
            currentTime: 0,
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private registerEvents(): void {
    const player = this.player;
    if (!player) return;

    player.on("playing", () => {
      this.emitEvent({ type: "playing" });
    });

    player.on("pause", () => {
      this.emitEvent({ type: "paused" });
    });

    player.on("waiting", () => {
      this.emitEvent({ type: "buffering" });
    });

    player.on("ended", () => {
      this.emitEvent({ type: "ended" });
    });

    player.on("timeupdate", () => {
      this.emitEvent({
        type: "timeupdate",
        currentTime: this.getCurrentTime(),
        duration: this.getDuration(),
      });
    });

    player.on("volumechange", () => {
      this.emitEvent({ type: "volumechange" });
    });

    player.on("error", () => {
      const error = player.error();
      this.emitEvent({
        type: "error",
        message: error?.message ?? "Unknown Video.js playback error",
        originalError: error,
      });
    });
  }

  private emitEvent(event: PlayerEventData): void {
    this.emit?.(event);
  }

  private getVHSRepresentations(): VHSRepresentation[] {
    const player = this.player;
    if (!player || player.isDisposed()) {
      return [];
    }
    const tech = player.tech() as unknown as VHSCompatibleTech;
    return tech.vhs?.representations() ?? [];
  }

  async play(): Promise<void> {
    await this.getPlayer().play();
  }

  pause(): void {
    this.getPlayer().pause();
  }

  seek(time: number): void {
    if (!Number.isFinite(time) || time < 0) {
      throw new RangeError("Seek time must be a non-negative number");
    }
    this.getPlayer().currentTime(time);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError("Volume must be between 0 and 1");
    }
    this.getPlayer().volume(volume);
  }

  setMuted(muted: boolean): void {
    this.getPlayer().muted(muted);
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError("Playback rate must be greater than zero");
    }
    this.getPlayer().playbackRate(rate);
  }

  getCurrentTime(): number {
    return this.getPlayer().currentTime() || 0;
  }

  getDuration(): number {
    const duration = this.getPlayer().duration();
    return duration != null && Number.isFinite(duration) ? duration : 0;
  }

  getPaused(): boolean {
    return this.getPlayer().paused();
  }

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

  getAvailableQualities(): QualityLevel[] {
    return this.getVHSRepresentations().map((representation) => ({
      id: representation.id,
      width: representation.width,
      height: representation.height,
      bitrate: representation.bandwidth,
    }));
  }

  setQuality(quality: QualitySelection): void {
    const representations = this.getVHSRepresentations();
    if (quality === "auto") {
      representations.forEach((representation) => {
        representation.enabled(true);
      });
      return;
    }
    representations.forEach((representation) => {
      representation.enabled(representation.id === quality);
    });
  }

  async destroy(): Promise<void> {
    if (!this.player) {
      return;
    }
    const player = this.player;
    this.player = null;
    this.emit = undefined;
    player.dispose();
  }

  private getPlayer(): VideoJSPlayer {
    if (!this.player || this.player.isDisposed()) {
      throw new Error("Video.js player is not initialized");
    }

    return this.player;
  }
}
