/* eslint-disable no-useless-assignment */
import type {
  PlayerError,
  PlayerErrorType,
  PlayerErrorSeverity,
} from "../../types/errors.types";

import type Player from "video.js/dist/types/player";

export class VideoJSErrorHandler {
  static classify(player: Player): PlayerError | null {
    const error = player.error();
    if (!error) {
      return null;
    }
    let type: PlayerErrorType = "unknown";
    let severity: PlayerErrorSeverity = "fatal";

    switch (error.code) {
      case 1:
        type = "unknown";
        severity = "warning";
        break;

      case 2:
        type = "network";
        severity = "recoverable";
        break;

      case 3:
        type = "decode";
        severity = "recoverable";
        break;

      case 4:
        type = "source";
        severity = "fatal";
        break;

      case 5:
        type = "media";
        severity = "fatal";
        break;

      default:
        type = "unknown";
        severity = "fatal";
        break;
    }
    return {
      type,
      severity,
      code: error.code,
      message: error.message || "Unknown Video.js playback error",
      timestamp: Date.now(),
      originalError: error,
    };
  }
}
