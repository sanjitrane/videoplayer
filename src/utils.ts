export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatBitrate(bitrate: number): string {
  return bitrate > 0 ? `${(bitrate / 1_00_000).toFixed(2)} Mbps` : "N/A";
}
