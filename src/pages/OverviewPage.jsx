import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtUSD, fmtTokens, fmtInt, fmtAgo } from "../lib/format";
import MetricCard from "../components/MetricCard";
import AlertBanner from "../components/AlertBanner";
import StatusDot from "../components/StatusDot";

const PIE_COLORS = [C.success, C.info, C.warning, C.danger, C.accent, "#8B5CF6", "#EC4899"];

export default function OverviewPage({ days }) {
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [aiUsage, setAiUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/monitor/overview?days=${days}`).then((r) => r.json()),
      apiFetch("/monitor/app-health").then((r) => r.json()),
      apiFetch("/monitor/alerts").then((r) => r.json()),
      apiFetch(`/monitor/ai-usage?days=${days}`).then((r) => r.json()),
    ])
      .then(([ov, h, al, ai]) => {
        setOverview(ov);
        setHealth(h);
        setAlerts(al.alerts || []);
        setAiUsage(ai);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !overview) {
    return <div style={{ color: C.textDim, padding: 40 }}>Loading Pulse data...</div>;
  }

  const extractionPie = Object.entries(overview.invoices.by_extraction_status || {}).map(
    ([name, value]) => ({ name, value })
  );

  const tenantData = Object.entries(overview.invoices.by_tenant || {}).map(
    ([name, value]) => ({ name: name.toUpperCase(), invoices: value })
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Alerts */}
      <AlertBanner alerts={alerts} />

      {/* Top KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <MetricCard
          label="Total Invoices"
          value={fmtInt(overview.invoices.total)}
          sub={`${fmtInt(overview.invoices.period)} in period`}
        />
        <MetricCard
          label="Total Uploads"
          value={fmtInt(overview.invoices.total_uploads)}
          sub={`${fmtInt(overview.invoices.period_uploads)} in period`}
          color={C.info}
        />
        <MetricCard
          label="AI Extractions"
          value={fmtInt(overview.invoices.total_extractions)}
          sub={`${fmtInt(overview.invoices.period_extractions)} in period (incl. re-runs)`}
          color={C.accent}
        />
        <MetricCard
          label="AI Spend (Period)"
          value={fmtUSD(overview.ai.period_cost_usd)}
          sub={`${fmtInt(overview.ai.period_api_calls)} API calls`}
          color={C.warning}
        />
        <MetricCard
          label="AI Spend (Total)"
          value={fmtUSD(overview.ai.total_cost_usd)}
          sub={`${fmtTokens(overview.ai.period_input_tokens + overview.ai.period_output_tokens)} tokens in period`}
          color={C.warning}
        />
        <MetricCard
          label="ERP Data"
          value={fmtInt(overview.erp.po_lines + overview.erp.grn_lines)}
          sub={`${fmtInt(overview.erp.po_lines)} PO + ${fmtInt(overview.erp.grn_lines)} GRN lines`}
          color={C.info}
        />
        <MetricCard
          label="Users"
          value={overview.users.active}
          sub={overview.users.pending_approval > 0 ? `${overview.users.pending_approval} pending` : "all approved"}
          color={overview.users.pending_approval > 0 ? C.warning : C.success}
        />
      </div>

      {/* System Health */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>System Health</h3>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          {Object.entries(health).map(([name, info]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot status={info.status} />
              <div>
                <div style={{ color: C.text, fontSize: 13, fontWeight: 500, textTransform: "capitalize" }}>{name}</div>
                {info.used_memory_mb != null && (
                  <div style={{ color: C.textMuted, fontSize: 11 }}>{info.used_memory_mb} MB used</div>
                )}
                {info.workers != null && (
                  <div style={{ color: C.textMuted, fontSize: 11 }}>{info.workers} worker(s), {info.active_tasks} active</div>
                )}
                {info.files != null && (
                  <div style={{ color: C.textMuted, fontSize: 11 }}>{info.files} files, {info.size_mb} MB</div>
                )}
                {info.error && (
                  <div style={{ color: C.danger, fontSize: 11 }}>{info.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* AI Spend per Day */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>AI Spend / Day</h3>
          {aiUsage?.daily?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aiUsage.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: C.textMuted, fontSize: 10 }}
                  tickFormatter={(d) => d.slice(5)}
                />
                <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                <Tooltip
                  contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: C.textDim }}
                  formatter={(v) => [`$${Number(v).toFixed(4)}`, "Cost"]}
                />
                <Bar dataKey="cost_usd" fill={C.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: C.textMuted, fontSize: 13, padding: 40, textAlign: "center" }}>
              No AI usage data yet. Process an invoice to start tracking.
            </div>
          )}
        </div>

        {/* Extraction Status Pie */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Extraction Status</h3>
          {extractionPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={extractionPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {extractionPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: C.textMuted, fontSize: 13, padding: 40, textAlign: "center" }}>No data</div>
          )}
        </div>
      </div>

      {/* Per-Tenant + ERP Sync */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Tenant bar chart */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Invoices by Tenant</h3>
          {tenantData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tenantData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis type="number" tick={{ fill: C.textMuted, fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.text, fontSize: 12 }} width={80} />
                <Tooltip
                  contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="invoices" fill={C.info} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: C.textMuted, fontSize: 13, padding: 40, textAlign: "center" }}>No data</div>
          )}
        </div>

        {/* Latest ERP syncs */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Latest ERP Syncs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(overview.erp.latest_syncs || {}).map(([slug, sync]) => (
              <div
                key={slug}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: C.surface,
                  borderRadius: 8,
                }}
              >
                <div>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{slug.toUpperCase()}</span>
                  {sync && (
                    <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>
                      {sync.po_lines_synced} PO + {sync.grn_lines_synced} GRN lines
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {sync ? (
                    <>
                      <StatusDot status={sync.status === "success" ? "healthy" : "unhealthy"} />
                      <span style={{ color: C.textMuted, fontSize: 11 }}>{fmtAgo(sync.started_at)}</span>
                    </>
                  ) : (
                    <span style={{ color: C.textMuted, fontSize: 11 }}>No syncs</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost per invoice + pass breakdown */}
      {aiUsage && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>AI Cost Summary</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.textDim, fontSize: 13 }}>Avg cost / invoice</span>
                <span style={{ color: C.text, fontSize: 13, fontFamily: "JetBrains Mono" }}>
                  {fmtUSD(aiUsage.avg_cost_per_invoice)}
                </span>
              </div>
              {Object.entries(aiUsage.by_tenant || {}).map(([slug, data]) => (
                <div key={slug} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.textDim, fontSize: 13 }}>{slug.toUpperCase()} total</span>
                  <span style={{ color: C.text, fontSize: 13, fontFamily: "JetBrains Mono" }}>
                    {fmtUSD(data.cost_usd)} ({data.api_calls} calls)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>By Pass</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(aiUsage.by_pass || {}).map(([pass_name, data]) => (
                <div
                  key={pass_name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: C.surface,
                    borderRadius: 6,
                  }}
                >
                  <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{pass_name}</span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <span style={{ color: C.textDim, fontSize: 12 }}>{data.count} calls</span>
                    <span style={{ color: C.warning, fontSize: 12, fontFamily: "JetBrains Mono" }}>
                      {fmtUSD(data.cost_usd)}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>
                      ~{(data.avg_duration_ms / 1000).toFixed(1)}s avg
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(aiUsage.by_pass || {}).length === 0 && (
                <div style={{ color: C.textMuted, fontSize: 13, textAlign: "center", padding: 20 }}>
                  No pass data yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
