import { C } from "../lib/theme";

export default function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ color: C.textMuted, fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}
        {label}
      </span>
      <span style={{ color: color || C.text, fontSize: 28, fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
        {value}
      </span>
      {sub && (
        <span style={{ color: C.textDim, fontSize: 12 }}>{sub}</span>
      )}
    </div>
  );
}
