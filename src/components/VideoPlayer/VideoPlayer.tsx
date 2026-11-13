import { useEffect, useRef, useState } from "react";
import { PlayerWrapper } from "../../core/PlayerWrapper";
import { engineFactory } from "../../core/EngineFactory";
import { PlaybackDiagnostics } from "../PlaybackDiagnostics/PlaybackDiagnostics";
import type {
  PlaybackStats,
  PlayerConfig,
  PlaybackDiagnosticsSnapshot,
  PlaybackLogEntry,
  QualityLevel,
} from "../../types/player.types";

import "./VideoPlayer.css";

interface VideoPlayerProps {
  config: PlayerConfig;
}

export function VideoPlayer({ config }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerWrapper | null>(null);
  const [status, setStatus] = useState("Initializing");
  const [error, setError] = useState<string | null>(null);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [diagnostics, setDiagnostics] =
    useState<PlaybackDiagnosticsSnapshot | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [eventLogs, setEventLogs] = useState<PlaybackLogEntry[]>([]);
  const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({
    width: 0,
    height: 0,
    bitrate: 0,
    bandwidth: 0,
  });

  const handleQualityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const quality = event.target.value;
    try {
      // "auto" or a specific rendition ID.
      // This changes the allowed renditions in VHS.
      // It does not immediately guarantee a resolution change.
      // The next segment boundary may be required.
      // The selected value represents the user's preference.
      playerRef.current?.setQuality(quality);
      setSelectedQuality(quality);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change quality");
    }
  };

  const addeventLog = (event: string, details?: string) => {
    setEventLogs((previous) =>
      [
        ...previous,
        {
          id: Date.now() + Math.random(),
          timestamp: Date.now(),
          event,
          details,
        },
      ].slice(-50),
    );
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let qualityPollId: number | undefined;
    let qualityAttempts = 0;

    setStatus("Initializing");
    setError(null);
    setQualityLevels([]);
    setSelectedQuality("auto");
    setPlaybackStats({
      width: 0,
      height: 0,
      bitrate: 0,
      bandwidth: 0,
    });

    const videoElement = document.createElement("video");
    videoElement.className = "video-js vjs-big-play-centered";
    videoElement.setAttribute("playsinline", "");
    container.appendChild(videoElement);

    const player = new PlayerWrapper(config, engineFactory);
    playerRef.current = player;

    // to test in browser
    /*if (import.meta.env.DEV) {
      (window as any).__playerWrapper = player;
    }*/

    const stopQualityPolling = () => {
      if (qualityPollId !== undefined) {
        window.clearInterval(qualityPollId);
        qualityPollId = undefined;
      }
    };

    const loadQualities = () => {
      if (disposed) return;
      qualityAttempts++;
      try {
        const qualities = player.getAvailableQualities();
        if (qualities.length > 0) {
          setQualityLevels(qualities);
          stopQualityPolling();
          return;
        }
      } catch {
        //Player may not be ready yet
      }
      // Stop checking after 15 sec
      if (qualityAttempts >= 30) {
        stopQualityPolling();
      }
    };

    player.on("ready", () => {
      if (!disposed) {
        setStatus("Ready");
        setPlaybackStats(player.getPlaybackStats());
      }
    });

    player.on("playing", () => {
      if (!disposed) {
        setStatus("Playing");
      }
    });

    player.on("paused", () => {
      if (!disposed) {
        setStatus("Paused");
      }
    });

    player.on("buffering", () => {
      if (!disposed) {
        setStatus("Buffering");
        addeventLog("BUFFERING");
      }
    });

    player.on("ended", () => {
      if (!disposed) {
        setStatus("Ended");
        addeventLog("ENDED");
      }
    });

    player.on("timeupdate", () => {
      if (!disposed) {
        setPlaybackStats(player.getPlaybackStats());
      }
    });

    player.on("error", (event) => {
      if (!disposed) {
        const message = event.message ?? "Playback error";
        setError(message);
        setStatus("Error");
        addeventLog("ERROR", message);
      }
    });

    const initializePromise = player.initialize(videoElement);
    initializePromise
      .then(() => {
        if (disposed) return;
        // check immediately, then poll until VHS renditions are available
        loadQualities();
        if (qualityPollId === undefined) {
          qualityPollId = window.setInterval(loadQualities, 500);
        }
      })
      .catch((err: unknown) => {
        if (!disposed) {
          setError(
            err instanceof Error ? err.message : "Player initialization failed",
          );

          setStatus("Error");
        }
      });

    return () => {
      disposed = true;
      stopQualityPolling();
      // Wait for initialization to finish before disposing
      // the engine, avoiding an initialization/disposal race.
      void initializePromise.then(
        async () => {
          await player.destroy();
          if (playerRef.current === player) {
            playerRef.current = null;
          }
          videoElement.remove();
        },
        async () => {
          await player.destroy();
          if (playerRef.current === player) {
            playerRef.current = null;
          }
          videoElement.remove();
        },
      );
    };
  }, [config]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      try {
        setDiagnostics(player.getDiagnosticsSnapshot());
      } catch {
        //Player may be initializing or already destroyed.
      }
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="video-player-container">
      <div ref={containerRef} data-vjs-player />
      {qualityLevels.length > 0 && (
        <div className="player-quality-control">
          <label htmlFor="player-quality">Quality</label>
          <select
            id="player-quality"
            value={selectedQuality}
            onChange={handleQualityChange}
          >
            <option value="auto">Auto</option>
            {qualityLevels.map((quality) => (
              <option key={quality.id} value={quality.id}>
                {quality.height}p ({Math.round(quality.bitrate / 1000)} kbps)
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="playback-stats">
        <div>
          <span>Resolution</span>
          <strong>
            {playbackStats.width > 0
              ? `${playbackStats.width} × ${playbackStats.height}`
              : "Detecting..."}
          </strong>
        </div>

        <div>
          <span>Bitrate</span>
          <strong>
            {playbackStats.bitrate > 0
              ? `${(playbackStats.bitrate / 1_000_000).toFixed(2)} Mbps`
              : "N/A"}
          </strong>
        </div>

        <div>
          <span>Network bandwidth</span>
          <strong>
            {playbackStats.bandwidth > 0
              ? `${(playbackStats.bandwidth / 1_000_000).toFixed(2)} Mbps`
              : "Measuring..."}
          </strong>
        </div>

        <div>
          <span>Quality mode</span>
          <strong>{selectedQuality === "auto" ? "Auto" : "Manual"}</strong>
        </div>
      </div>
      <div className="player-status">Status: {status}</div>
      <button
        type="button"
        onClick={() => setShowDiagnostics((visible) => !visible)}
      >
        {showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
      </button>
      {showDiagnostics && (
        <PlaybackDiagnostics
          status={status}
          snapShot={diagnostics}
          events={eventLogs}
        />
      )}
      {error && (
        <div className="player-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
