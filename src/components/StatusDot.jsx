import { C } from "../lib/theme";

export default function StatusDot({ status }) {
  const color = status === "healthy" ? C.success : status === "unhealthy" ? C.danger : C.warning;
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 8,
        boxShadow: `0 0 6px ${color}40`,
      }}
    />
  );
}
