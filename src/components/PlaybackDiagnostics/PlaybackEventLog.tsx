import type { PlaybackLogEntry } from "../../types/player.types";

interface PlaybackEventLogProps {
  events: PlaybackLogEntry[];
}

export function PlaybackEventLog({ events }: PlaybackEventLogProps) {
  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString();
  return (
    <div className="event-log">
      <h3>Playback Events</h3>
      {events.length === 0 ? (
        <p>No playback events yet</p>
      ) : (
        <div className="event-log-list">
          {[...events].reverse().map((entry) => (
            <div className="event-log-entry" key={entry.id}>
              <time>{formatTimestamp(entry.timestamp)}</time>
              <strong>{entry.event}</strong>
              {entry.details && <span>{entry.details}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
