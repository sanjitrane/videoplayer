export type PlayerEvent = 
|"ready"
|"playing"
|"paused"
|"buffering"
|"ended"
|"timeupdate"
|"volumechange"
|"qualitychange"
|"error";

export interface PlayerEventData{
  type:PlayerEvent;
  currentTime?:number;
  duration?:number;
  message?:string;
  originalError?: unknown;
}

export type PlayerEventListener = (event:PlayerEventData) => void;