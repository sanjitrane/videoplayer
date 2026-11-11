import type { PlayerEngine } from "../types/player.types";
import type { IPlayerEngine } from "../engines/IPlayerEngine";
import { VideoJsAdapter } from "../engines/videojs/VideoJsAdapter";

export class EngineFactory {
  private engines = new Map<PlayerEngine, () => IPlayerEngine>();

  register(engine: PlayerEngine, factory: () => IPlayerEngine): void {
    this.engines.set(engine, factory);
  }

  create(engine: PlayerEngine): IPlayerEngine {
    const factory = this.engines.get(engine);
    if (!factory) {
      throw new Error(`Playback engine "${engine}" is not registered`);
    }
    return factory();
  }
}

export const engineFactory = new EngineFactory();
engineFactory.register("videojs", () => new VideoJsAdapter());
