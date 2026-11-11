import { useEffect, useRef, useState } from "react";
import { PlayerWrapper } from "../../core/PlayerWrapper";
import { engineFactory } from "../../core/EngineFactory";
import type { PlayerConfig } from "../../types/player.types";

import "./VideoPlayer.css";

interface VideoPlayerProps {
  config: PlayerConfig;
}

export function VideoPlayer({ config }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Initializing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const videoElement = document.createElement("video");
    videoElement.className = "video-js vjs-big-play-centered";
    videoElement.setAttribute("playsinline", "");
    container.appendChild(videoElement);

    const player = new PlayerWrapper(config, engineFactory);

    player.on("ready", () => {
      if (!disposed) {
        setStatus("Ready");
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
      }
    });

    player.on("ended", () => {
      if (!disposed) {
        setStatus("Ended");
      }
    });

    player.on("error", (event) => {
      if (!disposed) {
        setError(event.message ?? "Playback error");
        setStatus("Error");
      }
    });

    const initializePromise = player.initialize(videoElement);
    initializePromise.catch((err: unknown) => {
      if (!disposed) {
        setError(
          err instanceof Error ? err.message : "Player initialization failed",
        );

        setStatus("Error");
      }
    });

    return () => {
      disposed = true;
      // Wait for initialization to finish before disposing
      // the engine, avoiding an initialization/disposal race.
      void initializePromise.then(
        async () => {
          await player.destroy();
          videoElement.remove();
        },
        async () => {
          await player.destroy();
          videoElement.remove();
        },
      );
    };
  }, [config]);

  return (
    <div className="video-player-container">
      <div ref={containerRef} data-vjs-player />
      <div className="player-status">Status: {status}</div>

      {error && (
        <div className="player-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
