import { useState, useEffect } from "react";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtAgo, fmtInt } from "../lib/format";
import StatusDot from "../components/StatusDot";
import MetricCard from "../components/MetricCard";
import AlertBanner from "../components/AlertBanner";
import { fetchWatchStatus } from "../lib/watch";

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [syncs, setSyncs] = useState([]);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [infra, setInfra] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    Promise.all([
      apiFetch("/monitor/app-health").then((r) => r.json()),
      apiFetch("/monitor/erp-syncs?limit=15").then((r) => r.json()),
      apiFetch("/monitor/overview?days=7").then((r) => r.json()), // 7d window for "failed in period"
      apiFetch("/monitor/alerts").then((r) => r.json()),
      fetchWatchStatus(), // never throws → returns {error} shape, safe in Promise.all
    ])
      .then(([h, s, o, a, w]) => {
        setHealth(h);
        setSyncs(s.syncs || []);
        setOverview(o);
        setAlerts(a.alerts || []);
        setInfra(w);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ color: C.textDim, padding: 40 }}>Loading...</div>;

  const svcOrder = ["database", "redis", "celery", "storage"];

  // ── AI Health rollup ──────────────────────────────────────────────
  const celery = health?.celery || {};
  const extStatus = overview?.invoices?.by_extraction_status || {};
  const completed = extStatus.completed || 0;
  const failed = extStatus.failed || 0;
  const workers = celery.workers ?? null;
  const aiAlerts = (alerts || []).filter(
    (a) => a.category === "extraction" || a.category === "ai"
  );

  // critical: pipeline can't run · warn: up but failures/alerts · healthy: all good
  let aiRollup = "healthy";
  if (celery.status !== "healthy" || !workers) {
    aiRollup = "critical";
  } else if (failed > 0 || aiAlerts.length > 0) {
    aiRollup = "warn";
  }
  const aiColor =
    aiRollup === "critical" ? C.danger : aiRollup === "warn" ? C.warning : C.success;
  const aiDot =
    aiRollup === "critical" ? "unhealthy" : aiRollup === "warn" ? "warning" : "healthy";

  // ── Infrastructure helpers ────────────────────────────────────────
  const infraColor = (s) =>
    s === "critical" ? C.danger : s === "warn" ? C.warning : s === "healthy" ? C.success : C.textMuted;
  const infraDot = (s) =>
    s === "critical" ? "unhealthy" : s === "healthy" ? "healthy" : "warning"; // warn/unknown → amber
  const m = infra?.metrics || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Refresh button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={load}
          disabled={refreshing}
          style={{
            padding: "6px 16px",
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.textDim,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* AI Health card */}
      <div
        style={{
          background: C.card,
          border: `1px solid ${aiColor}40`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <StatusDot status={aiDot} />
          <span style={{ color: C.text, fontSize: 16, fontWeight: 600 }}>AI Health</span>
          <span
            style={{
              marginLeft: "auto",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              background: `${aiColor}15`,
              color: aiColor,
            }}
          >
            {aiRollup === "critical" ? "down" : aiRollup === "warn" ? "degraded" : "healthy"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 16,
          }}
        >
          <MetricCard label="Completed" value={fmtInt(completed)} color={C.success} />
          <MetricCard
            label="Failed"
            value={fmtInt(failed)}
            color={failed > 0 ? C.danger : C.textDim}
          />
          <MetricCard
            label="Workers"
            value={workers ?? "—"}
            sub={`${celery.active_tasks ?? 0} active · ${celery.queued_tasks ?? 0} queued`}
            color={workers > 0 ? C.success : C.danger}
          />
          <MetricCard
            label="Pipeline"
            value={celery.status === "healthy" ? "Up" : "Down"}
            color={celery.status === "healthy" ? C.success : C.danger}
          />
        </div>

        {aiAlerts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <AlertBanner alerts={aiAlerts} />
          </div>
        )}
      </div>

      {/* Infrastructure (AWS) */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: 0 }}>
            Infrastructure (AWS)
          </h3>
          {!infra?.error && infra?.generated_at && (
            <span style={{ color: C.textMuted, fontSize: 11 }}>
              generated {fmtAgo(infra.generated_at)}
            </span>
          )}
        </div>

        {infra?.error ? (
          <div style={{ color: C.textMuted, fontSize: 12 }}>
            Infra metrics unavailable — watcher not reachable
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <MetricCard
              icon={<StatusDot status={infraDot(m.ec2_cpu?.status)} />}
              label="EC2 CPU"
              value={m.ec2_cpu?.value != null ? `${m.ec2_cpu.value}%` : "—"}
              sub={m.ec2_cpu?.error ? m.ec2_cpu.error : `instance ${m.ec2_cpu?.instance_id || "ap-automation"}`}
              color={m.ec2_cpu?.error ? C.danger : infraColor(m.ec2_cpu?.status)}
            />
            <MetricCard
              icon={<StatusDot status={infraDot(m.rds_cpu?.status)} />}
              label="RDS CPU"
              value={m.rds_cpu?.value != null ? `${m.rds_cpu.value}%` : "—"}
              sub={m.rds_cpu?.error ? m.rds_cpu.error : "instance ap-automation-db"}
              color={m.rds_cpu?.error ? C.danger : infraColor(m.rds_cpu?.status)}
            />
            <MetricCard
              icon={<StatusDot status={infraDot(m.rds_disk?.status)} />}
              label="RDS Disk"
              value={m.rds_disk?.value != null ? `${m.rds_disk.value}%` : "—"}
              sub={
                m.rds_disk?.error
                  ? m.rds_disk.error
                  : `${m.rds_disk?.free_gb ?? "—"}GB free / ${m.rds_disk?.total_gb ?? "—"}GB`
              }
              color={m.rds_disk?.error ? C.danger : infraColor(m.rds_disk?.status)}
            />
            <MetricCard
              icon={<StatusDot status={infraDot(m.rds_connections?.status)} />}
              label="RDS Connections"
              value={m.rds_connections?.value ?? "—"}
              sub={
                m.rds_connections?.error
                  ? m.rds_connections.error
                  : `of ~${m.rds_connections?.ceiling ?? 80} max`
              }
              color={m.rds_connections?.error ? C.danger : infraColor(m.rds_connections?.status)}
            />
          </div>
        )}
      </div>

      {/* Service cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {svcOrder.map((name) => {
          const info = health?.[name];
          if (!info) return null;
          return (
            <div
              key={name}
              style={{
                background: C.card,
                border: `1px solid ${info.status === "healthy" ? C.border : `${C.danger}40`}`,
                borderRadius: 12,
                padding: 24,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <StatusDot status={info.status} />
                <span style={{ color: C.text, fontSize: 16, fontWeight: 600, textTransform: "capitalize" }}>
                  {name}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    background: info.status === "healthy" ? `${C.success}15` : `${C.danger}15`,
                    color: info.status === "healthy" ? C.success : C.danger,
                  }}
                >
                  {info.status}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {info.used_memory_mb != null && <InfoRow label="Memory" value={`${info.used_memory_mb} MB`} />}
                {info.connected_clients != null && <InfoRow label="Clients" value={info.connected_clients} />}
                {info.uptime_days != null && <InfoRow label="Uptime" value={`${info.uptime_days} days`} />}
                {info.workers != null && <InfoRow label="Workers" value={info.workers} />}
                {info.active_tasks != null && <InfoRow label="Active Tasks" value={info.active_tasks} />}
                {info.queued_tasks != null && <InfoRow label="Queued Tasks" value={info.queued_tasks} />}
                {info.files != null && <InfoRow label="Files" value={info.files} />}
                {info.size_mb != null && <InfoRow label="Size" value={`${info.size_mb} MB`} />}
                {info.path && <InfoRow label="Path" value={info.path} mono />}
                {info.error && <InfoRow label="Error" value={info.error} color={C.danger} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* ERP Sync History */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>ERP Sync History</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Company", "Source", "Status", "PO Lines", "GRN Lines", "Started", "Duration", "Error"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: C.textMuted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {syncs.map((s) => {
                const dur = s.started_at && s.finished_at
                  ? ((new Date(s.finished_at) - new Date(s.started_at)) / 1000).toFixed(1) + "s"
                  : "—";
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.border}10` }}>
                    <td style={{ padding: "6px 10px", color: C.text, fontWeight: 500 }}>{(s.company || "").toUpperCase()}</td>
                    <td style={{ padding: "6px 10px", color: C.textDim }}>{s.source}</td>
                    <td style={{ padding: "6px 10px" }}>
                      <StatusDot status={s.status === "success" ? "healthy" : s.status === "running" ? "warning" : "unhealthy"} />
                      <span style={{ color: C.text, fontSize: 12 }}>{s.status}</span>
                    </td>
                    <td style={{ padding: "6px 10px", color: C.textDim, fontFamily: "JetBrains Mono" }}>{s.po_lines_synced}</td>
                    <td style={{ padding: "6px 10px", color: C.textDim, fontFamily: "JetBrains Mono" }}>{s.grn_lines_synced}</td>
                    <td style={{ padding: "6px 10px", color: C.textDim }}>{fmtAgo(s.started_at)}</td>
                    <td style={{ padding: "6px 10px", color: C.textDim }}>{dur}</td>
                    <td style={{ padding: "6px 10px", color: C.danger, fontSize: 11, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.error || "—"}
                    </td>
                  </tr>
                );
              })}
              {syncs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 20, color: C.textMuted, textAlign: "center" }}>No sync history</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, color, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: C.textMuted, fontSize: 12 }}>{label}</span>
      <span
        style={{
          color: color || C.text,
          fontSize: 12,
          fontFamily: mono ? "JetBrains Mono, monospace" : "inherit",
          maxWidth: 180,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}
