import { useState, useEffect } from "react";
import { C } from "../lib/theme";
import { apiFetch } from "../lib/api";
import { fmtUSD, fmtInt, fmtDate } from "../lib/format";
import MetricCard from "../components/MetricCard";
import { loadCostConfig, saveCostConfig, sumOther } from "../lib/costConfig";

/* Total Cost of Ownership — combines LIVE AI cost (ai_usage_logs) with the
 * fixed-cost assumptions in costConfig. v1: no backend changes. */
export default function CostsPage({ days }) {
  const [overview, setOverview] = useState(null);
  const [ai, setAi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(loadCostConfig());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/monitor/overview?days=${days}`).then((r) => r.json()),
      apiFetch(`/monitor/ai-usage?days=${days}`).then((r) => r.json()),
    ])
      .then(([o, a]) => { setOverview(o); setAi(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !overview || !ai) return <div style={{ color: C.textDim, padding: 40 }}>Loading...</div>;

  // ── live numbers ──
  const aiPeriod = (ai.daily || []).reduce((s, d) => s + (d.cost_usd || 0), 0);
  const invoicesPeriod = overview?.invoices?.period ?? 0;
  const invoicesTotal = overview?.invoices?.total ?? 0;
  const aiTotal = overview?.ai?.total_cost_usd ?? 0;

  // ── normalize to a monthly run-rate (period → 30d) ──
  const toMonthly = (periodVal) => (days > 0 ? periodVal * (30 / days) : 0);
  const aiMonthly = toMonthly(aiPeriod);
  const otherMonthly = sumOther(cfg);

  const cashMonthly = aiMonthly + (Number(cfg.infraBilledMonthly) || 0) + otherMonthly;
  const listMonthly = aiMonthly + (Number(cfg.infraListPriceMonthly) || 0) + otherMonthly;

  // ── all-in cost per invoice (period actuals + prorated fixed) ──
  const proratedFixedCash = ((Number(cfg.infraBilledMonthly) || 0) + otherMonthly) * (days / 30);
  const proratedFixedList = ((Number(cfg.infraListPriceMonthly) || 0) + otherMonthly) * (days / 30);
  const cpiCash = invoicesPeriod ? (aiPeriod + proratedFixedCash) / invoicesPeriod : null;
  const cpiList = invoicesPeriod ? (aiPeriod + proratedFixedList) / invoicesPeriod : null;

  // ── credit runway ──
  const burn = Number(cfg.creditBurnMonthly) || 0;
  const bal = cfg.creditBalanceRemaining;
  const runwayMonths = bal != null && burn > 0 ? bal / burn : null;
  let runOutDate = null;
  if (runwayMonths != null) {
    const d = new Date();
    d.setMonth(d.getMonth() + Math.floor(runwayMonths));
    d.setDate(d.getDate() + Math.round((runwayMonths % 1) * 30));
    runOutDate = d.toISOString();
  }

  const updateCfg = (patch) => { const next = { ...cfg, ...patch }; setCfg(next); saveCostConfig(next); };
  const updateOther = (i, monthly) => {
    const otherCosts = cfg.otherCosts.map((c, j) => (j === i ? { ...c, monthly } : c));
    updateCfg({ otherCosts });
  };

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 };
  const h3 = { color: C.text, fontSize: 14, fontWeight: 600, margin: "0 0 16px" };
  const numInput = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, padding: "5px 8px", width: 90, fontFamily: "JetBrains Mono, monospace" };

  // composition bar segments (monthly list-price view)
  const seg = [
    { label: "AI", val: aiMonthly, color: C.accent },
    { label: "Infra", val: Number(cfg.infraListPriceMonthly) || 0, color: C.info },
    { label: "Other", val: otherMonthly, color: C.warning },
  ];
  const segTotal = seg.reduce((s, x) => s + x.val, 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Credit runway banner */}
      <div style={{ ...card, borderColor: runwayMonths != null && runwayMonths < 3 ? C.danger : C.border,
        background: runwayMonths != null && runwayMonths < 3 ? `${C.danger}10` : C.card }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: C.textMuted, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>AWS Credit Runway</div>
            <div style={{ color: C.text, fontSize: 24, fontWeight: 700, fontFamily: "JetBrains Mono, monospace", marginTop: 4 }}>
              {runwayMonths != null ? `${runwayMonths.toFixed(1)} months left` : "— (enter credit balance)"}
            </div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>
              {runwayMonths != null
                ? `Credits cover infra (≈${fmtUSD(burn)}/mo). Projected to run out ~${fmtDate(runOutDate)} → then your bill jumps from ${fmtUSD(cashMonthly)}/mo to ${fmtUSD(listMonthly)}/mo.`
                : `Infra is currently $0 (AWS credits cover the ≈${fmtUSD(cfg.infraListPriceMonthly)}/mo run-rate). Enter your remaining credit balance to see the runway.`}
            </div>
          </div>
          <button onClick={() => setEditing((e) => !e)} style={{ padding: "6px 14px", background: editing ? C.accent : "transparent", border: `1px solid ${editing ? C.accent : C.border}`, borderRadius: 6, color: editing ? "#fff" : C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            {editing ? "Done" : "Edit assumptions"}
          </button>
        </div>
      </div>

      {/* Headline KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16 }}>
        <MetricCard label="Cash cost / mo" value={fmtUSD(cashMonthly)} color={C.success} sub="what you actually pay now" />
        <MetricCard label="True run-rate / mo" value={fmtUSD(listMonthly)} color={C.warning} sub="when credits run out" />
        <MetricCard label="All-in / invoice (cash)" value={cpiCash != null ? fmtUSD(cpiCash) : "—"} color={C.accent} sub={`${fmtInt(invoicesPeriod)} invoices / ${days}d`} />
        <MetricCard label="All-in / invoice (run-rate)" value={cpiList != null ? fmtUSD(cpiList) : "—"} sub="incl. infra + other" />
      </div>

      {/* Monthly run-rate breakdown */}
      <div style={card}>
        <h3 style={h3}>Monthly run-rate breakdown (normalized to 30 days)</h3>
        <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 14 }}>
          {seg.map((s) => (
            <div key={s.label} title={`${s.label}: ${fmtUSD(s.val)}`} style={{ width: `${(s.val / segTotal) * 100}%`, background: s.color }} />
          ))}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {[
              ["AI extraction (live)", aiMonthly, C.accent, "from ai_usage_logs"],
              ["AWS infra — billed now", Number(cfg.infraBilledMonthly) || 0, C.success, "credits cover it → $0"],
              ["AWS infra — list price", Number(cfg.infraListPriceMonthly) || 0, C.info, "EC2 t3.medium + RDS db.t3.micro"],
              ["Other subscriptions", otherMonthly, C.warning, cfg.otherCosts.map((c) => c.name).join(", ")],
            ].map(([label, val, color, note]) => (
              <tr key={label} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 0", color: C.text }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: color, marginRight: 8 }} />{label}</td>
                <td style={{ padding: "8px 0", color: C.text, textAlign: "right", fontFamily: "JetBrains Mono, monospace" }}>{fmtUSD(val)}</td>
                <td style={{ padding: "8px 0 8px 16px", color: C.textMuted, fontSize: 11 }}>{note}</td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: "10px 0", color: C.text, fontWeight: 700 }}>Total (cash now / true run-rate)</td>
              <td style={{ padding: "10px 0", color: C.text, textAlign: "right", fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{fmtUSD(cashMonthly)} / {fmtUSD(listMonthly)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div style={{ color: C.textMuted, fontSize: 11, marginTop: 10 }}>
          Lifetime AI spend: {fmtUSD(aiTotal)} across {fmtInt(invoicesTotal)} invoices. AI cost is live; infra & other are assumptions (edit above).
        </div>
      </div>

      {/* Editable assumptions */}
      {editing && (
        <div style={card}>
          <h3 style={h3}>Assumptions (saved in this browser)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px 16px", alignItems: "center", maxWidth: 560 }}>
            <label style={{ color: C.textDim, fontSize: 13 }}>AWS infra — list price / mo ($)</label>
            <input type="number" style={numInput} value={cfg.infraListPriceMonthly} onChange={(e) => updateCfg({ infraListPriceMonthly: Number(e.target.value) })} />
            <label style={{ color: C.textDim, fontSize: 13 }}>AWS infra — billed now / mo ($)</label>
            <input type="number" style={numInput} value={cfg.infraBilledMonthly} onChange={(e) => updateCfg({ infraBilledMonthly: Number(e.target.value) })} />
            <label style={{ color: C.textDim, fontSize: 13 }}>AWS credit balance remaining ($)</label>
            <input type="number" style={numInput} value={cfg.creditBalanceRemaining ?? ""} placeholder="from console" onChange={(e) => updateCfg({ creditBalanceRemaining: e.target.value === "" ? null : Number(e.target.value) })} />
            <label style={{ color: C.textDim, fontSize: 13 }}>Credit burn / mo ($)</label>
            <input type="number" style={numInput} value={cfg.creditBurnMonthly} onChange={(e) => updateCfg({ creditBurnMonthly: Number(e.target.value) })} />
            {cfg.otherCosts.map((c, i) => (
              <Other key={i} name={c.name} monthly={c.monthly} onChange={(v) => updateOther(i, v)} style={numInput} />
            ))}
          </div>
          <div style={{ color: C.textMuted, fontSize: 11, marginTop: 12 }}>
            Tip: grab the credit balance from <b>AWS Billing console → Credits</b>. These assumptions are stored locally in your browser only.
          </div>
        </div>
      )}
    </div>
  );
}

function Other({ name, monthly, onChange, style }) {
  return (
    <>
      <label style={{ color: C.textDim, fontSize: 13 }}>{name} / mo ($)</label>
      <input type="number" style={style} value={monthly} onChange={(e) => onChange(Number(e.target.value))} />
    </>
  );
}
