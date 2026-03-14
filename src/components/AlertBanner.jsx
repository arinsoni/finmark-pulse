import { C } from "../lib/theme";

const SEVERITY_COLORS = {
  danger: C.danger,
  warning: C.warning,
  info: C.info,
};

const SEVERITY_ICONS = {
  danger: "\u26A0",
  warning: "\u26A0",
  info: "\u2139",
};

export default function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {alerts.map((a, i) => {
        const color = SEVERITY_COLORS[a.severity] || C.textDim;
        return (
          <div
            key={i}
            style={{
              background: `${color}10`,
              border: `1px solid ${color}30`,
              borderRadius: 8,
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
            }}
          >
            <span style={{ fontSize: 16 }}>{SEVERITY_ICONS[a.severity] || ""}</span>
            <span style={{ color: C.text, flex: 1 }}>{a.message}</span>
            <span
              style={{
                color,
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 4,
                background: `${color}15`,
              }}
            >
              {a.category}
            </span>
          </div>
        );
      })}
    </div>
  );
}
