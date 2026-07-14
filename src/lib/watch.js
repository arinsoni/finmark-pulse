// Reads the read-only AWS watcher via the nginx /watch/ proxy (or Vite dev proxy).
// Plain fetch — NOT apiFetch: the watcher is unauthenticated and lives outside /api.
// Never throws: on any failure returns a usable shape with `error` set so the
// Health page degrades gracefully instead of crashing.

const EMPTY_METRICS = {
  ec2_cpu:         { label: "EC2 CPU",         value: null, unit: "%",     status: "unknown", error: null, thresholds: { warn: 70, critical: 90 } },
  rds_cpu:         { label: "RDS CPU",         value: null, unit: "%",     status: "unknown", error: null, thresholds: { warn: 70, critical: 90 } },
  rds_disk:        { label: "RDS Disk",        value: null, unit: "%",     status: "unknown", error: null, free_gb: null, total_gb: null, used_gb: null, thresholds: { warn: 75, critical: 90 } },
  rds_connections: { label: "RDS Connections", value: null, unit: "count", status: "unknown", error: null, ceiling: 80, thresholds: { warn: 60, critical: 72 } },
};

export async function fetchWatchStatus() {
  try {
    const res = await fetch("/watch/status", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return { generated_at: null, region: null, metrics: EMPTY_METRICS, error: `watcher HTTP ${res.status}` };
    }
    const data = await res.json();
    // ensure all four keys exist even if the watcher omitted one
    return { ...data, metrics: { ...EMPTY_METRICS, ...(data.metrics || {}) }, error: data.error || null };
  } catch (e) {
    return { generated_at: null, region: null, metrics: EMPTY_METRICS, error: String(e) };
  }
}
