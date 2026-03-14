import { useState, useEffect } from "react";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtAgo } from "../lib/format";
import StatusDot from "../components/StatusDot";

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [syncs, setSyncs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setRefreshing(true);
    Promise.all([
      apiFetch("/monitor/app-health").then((r) => r.json()),
      apiFetch("/monitor/erp-syncs?limit=15").then((r) => r.json()),
    ])
      .then(([h, s]) => {
        setHealth(h);
        setSyncs(s.syncs || []);
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
