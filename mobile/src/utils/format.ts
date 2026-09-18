/**
 * Number and time formatting for display.
 *
 * Kept as pure functions rather than inline in components for the usual reason
 * plus one specific to this app: these run on every tick for every visible row,
 * so they are on the hot path and worth being able to reason about in isolation.
 */

/**
 * Group with thousands separators at a fixed decimal count.
 *
 * `decimals` comes from `/pairs/meta` per pair rather than being inferred from
 * the value: inferring it would make the decimal count *change as the price
 * moves*, so the column width would jitter at 10 Hz - which is precisely what
 * the monospaced font was chosen to prevent.
 */
export const formatPrice = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/** Signed percentage, e.g. `+2.45%`. The sign is the point. */
export const formatPercent = (value: number, decimals = 2): string => {
  if (!Number.isFinite(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
};

/** Compact magnitude for volumes and market caps: `1.27T`, `21.6K`. */
export const formatCompact = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return "--";

  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

/** Order book quantities. Small sizes need precision, large ones do not. */
export const formatQuantity = (value: number): string => {
  if (!Number.isFinite(value)) return "--";
  if (value >= 1000) return value.toFixed(1);
  if (value >= 1) return value.toFixed(3);
  return value.toFixed(4);
};

/**
 * "Last updated" for the detail screen (R18).
 *
 * Deliberately coarse. A timestamp that renders exact milliseconds would change
 * every frame and re-render this component at 10 Hz to convey nothing a human
 * can read - the useful information is "is this current or has it stopped".
 */
export const formatRelativeTime = (timestamp: number, now = Date.now()): string => {
  if (timestamp <= 0) return "never";

  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 1) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  return `${Math.floor(minutes / 60)}h ago`;
};

/** Clock time for the telemetry header. */
export const formatClock = (timestamp: number): string => {
  if (timestamp <= 0) return "--:--:--";
  return new Date(timestamp).toLocaleTimeString("en-GB", { hour12: false });
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};
