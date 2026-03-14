import { useState, useEffect } from "react";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtUSD, fmtInt, fmtAgo } from "../lib/format";
import StatusDot from "../components/StatusDot";

export default function TenantsPage({ days }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/monitor/tenants?days=${days}`)
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div style={{ color: C.textDim, padding: 40 }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {tenants.map((t) => (
        <div
          key={t.id}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <span style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>{t.name}</span>
              <span
                style={{
                  marginLeft: 10,
                  padding: "2px 10px",
                  background: `${C.accent}20`,
                  color: C.accent,
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {t.slug.toUpperCase()}
              </span>
            </div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>{t.users} active user(s)</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            <StatBox label="Invoices (Total)" value={fmtInt(t.invoices_total)} />
            <StatBox label="Invoices (Period)" value={fmtInt(t.invoices_period)} />
            <StatBox label="AP Value" value={`\u20A6${fmtInt(t.total_ap_value)}`} color={C.success} />
            <StatBox label="AI Cost (Period)" value={fmtUSD(t.ai_cost_period)} color={C.warning} />
            <StatBox label="AI Cost (Total)" value={fmtUSD(t.ai_cost_total)} color={C.warning} />
            <StatBox label="PO Lines" value={fmtInt(t.po_lines)} />
            <StatBox label="GRN Lines" value={fmtInt(t.grn_lines)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ color: C.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Last ERP Sync
              </span>
              {t.last_erp_sync ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <StatusDot status={t.last_erp_sync.status === "success" ? "healthy" : "unhealthy"} />
                  <span style={{ color: C.text, fontSize: 13 }}>{fmtAgo(t.last_erp_sync.started_at)}</span>
                </div>
              ) : (
                <span style={{ color: C.textMuted, fontSize: 13 }}>Never</span>
              )}
            </div>
          </div>
        </div>
      ))}

      {tenants.length === 0 && (
        <div style={{ color: C.textMuted, textAlign: "center", padding: 60 }}>No tenants found</div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ color: C.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ color: color || C.text, fontSize: 18, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </span>
    </div>
  );
}
