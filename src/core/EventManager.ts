import type {PlayerEvent, PlayerEventData, PlayerEventListener} from "../types/events.types";

export class EventManager{
  private listeners = new Map<PlayerEvent, Set<PlayerEventListener>>();

  on(
    event:PlayerEvent,
    listener:PlayerEventListener
  ): void{
    if(!this.listeners.has(event)){
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(
    event:PlayerEvent,
    listener:PlayerEventListener
  ):void{
    this.listeners.get(event)?.delete(listener);
  }

  emit(event:PlayerEventData):void{
    this.listeners.get(event.type)?.forEach((listener)=>{
      listener(event);
    })
  }

  removeAllListener():void{
    this.listeners.clear();
  }
}