import type {PlayerConfig, PlayerCapabilities} from "../types/player.types";

import type {
  PlayerEvent,
  PlayerEventListener
} from "../types/events.types";

import type {IPlayerEngine} from "../engines/IPlayerEngine";

import {EngineFactory} from "./EngineFactory";
import {EventManager} from "./EventManager";

export class PlayerWrapper{
  private engine?: IPlayerEngine;
  private videoElement?: HTMLVideoElement;
  private config?: PlayerConfig;
  private events = new EventManager();

  constructor(
    config: PlayerConfig,
    private engineFactory: EngineFactory
  ){
    this.config = config;
  }

  async initialize(
    videoElement: HTMLVideoElement
  ):Promise<void>{
    if(this.engine){
      throw new Error("Player is already initalized");
    }
    
  }
}


