import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtUSD, fmtTokens, fmtInt, fmtDate, fmtTime } from "../lib/format";
import MetricCard from "../components/MetricCard";

export default function AIUsagePage({ days }) {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/monitor/ai-usage?days=${days}`).then((r) => r.json()),
      apiFetch("/monitor/ai-usage/recent?limit=30").then((r) => r.json()),
    ])
      .then(([d, r]) => {
        setData(d);
        setRecent(r.logs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !data) return <div style={{ color: C.textDim, padding: 40 }}>Loading...</div>;

  const totalTokens = data.daily.reduce((s, d) => s + d.input_tokens + d.output_tokens, 0);
  const totalCost = data.daily.reduce((s, d) => s + d.cost_usd, 0);
  const totalCalls = data.daily.reduce((s, d) => s + d.api_calls, 0);

  // Token breakdown chart data
  const tokenData = data.daily.map((d) => ({
    date: d.date,
    input: d.input_tokens,
    output: d.output_tokens,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <MetricCard label="Period Cost" value={fmtUSD(totalCost)} color={C.warning} />
        <MetricCard label="Total Tokens" value={fmtTokens(totalTokens)} />
        <MetricCard label="API Calls" value={fmtInt(totalCalls)} />
        <MetricCard
          label="Avg / Invoice"
          value={fmtUSD(data.avg_cost_per_invoice)}
          color={C.accent}
        />
      </div>

      {/* Cost chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Daily AI Cost</h3>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`$${Number(v).toFixed(4)}`, "Cost"]}
              />
              <Area type="monotone" dataKey="cost_usd" stroke={C.accent} fill={`${C.accent}30`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.textMuted, textAlign: "center", padding: 40 }}>No data</div>
        )}
      </div>

      {/* Token breakdown chart */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Token Usage (Input vs Output)</h3>
        {tokenData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tokenData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(v) => fmtTokens(v)} />
              <Tooltip
                contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [fmtTokens(v)]}
              />
              <Bar dataKey="input" stackId="a" fill={C.info} name="Input" radius={[0, 0, 0, 0]} />
              <Bar dataKey="output" stackId="a" fill={C.accent} name="Output" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: C.textMuted, textAlign: "center", padding: 40 }}>No data</div>
        )}
      </div>

      {/* Per-tenant + Per-pass side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>By Tenant</h3>
          {Object.entries(data.by_tenant || {}).map(([slug, info]) => (
            <div
              key={slug}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: C.surface,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{slug.toUpperCase()}</span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ color: C.textDim, fontSize: 12 }}>{fmtTokens(info.input_tokens + info.output_tokens)} tokens</span>
                <span style={{ color: C.warning, fontSize: 12, fontFamily: "JetBrains Mono" }}>{fmtUSD(info.cost_usd)}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>By Pass</h3>
          {Object.entries(data.by_pass || {}).map(([name, info]) => (
            <div
              key={name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: C.surface,
                borderRadius: 6,
                marginBottom: 8,
              }}
            >
              <span style={{ color: C.text, fontWeight: 500, fontSize: 13 }}>{name}</span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ color: C.textDim, fontSize: 12 }}>{info.count} calls</span>
                <span style={{ color: C.textMuted, fontSize: 12 }}>{(info.avg_duration_ms / 1000).toFixed(1)}s</span>
                <span style={{ color: C.warning, fontSize: 12, fontFamily: "JetBrains Mono" }}>{fmtUSD(info.cost_usd)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent API calls table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>Recent API Calls</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Time", "Pass", "Model", "Input", "Output", "Cost", "Duration", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      color: C.textMuted,
                      fontWeight: 500,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((log) => (
                <tr key={log.id} style={{ borderBottom: `1px solid ${C.border}10` }}>
                  <td style={{ padding: "6px 10px", color: C.textDim }}>
                    {fmtDate(log.created_at)} {fmtTime(log.created_at)}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.text, fontWeight: 500 }}>{log.pass_name}</td>
                  <td style={{ padding: "6px 10px", color: C.textMuted, fontFamily: "JetBrains Mono" }}>
                    {(log.model || "").replace("claude-", "")}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.info, fontFamily: "JetBrains Mono" }}>
                    {fmtTokens(log.input_tokens)}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.accent, fontFamily: "JetBrains Mono" }}>
                    {fmtTokens(log.output_tokens)}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.warning, fontFamily: "JetBrains Mono" }}>
                    {fmtUSD(log.cost_usd)}
                  </td>
                  <td style={{ padding: "6px 10px", color: C.textDim }}>
                    {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <span
                      style={{
                        color: log.success ? C.success : C.danger,
                        fontWeight: 500,
                      }}
                    >
                      {log.success ? "OK" : "FAIL"}
                    </span>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 20, color: C.textMuted, textAlign: "center" }}>
                    No API calls recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
