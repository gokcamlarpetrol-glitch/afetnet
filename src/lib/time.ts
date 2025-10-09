export function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}g önce`;
  if (hours > 0) return `${hours}s önce`;
  if (minutes > 0) return `${minutes}d önce`;
  return `${seconds}sn önce`;
}