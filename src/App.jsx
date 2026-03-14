import { useState, useEffect } from "react";
import { C } from "./lib/theme";
import { clearTokens } from "./lib/api";
import LoginForm from "./components/LoginForm";
import OverviewPage from "./pages/OverviewPage";
import TenantsPage from "./pages/TenantsPage";
import AIUsagePage from "./pages/AIUsagePage";
import HealthPage from "./pages/HealthPage";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "ai", label: "AI Usage" },
  { id: "tenants", label: "Tenants" },
  { id: "health", label: "Health" },
];

const DAY_OPTIONS = [7, 14, 30, 60, 90];

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("pulse_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(30);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      clearTokens();
    };
    window.addEventListener("pulse_auth_expired", handler);
    return () => window.removeEventListener("pulse_auth_expired", handler);
  }, []);

  const handleLogout = () => {
    clearTokens();
    setUser(null);
  };

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        fontFamily: "Inter, sans-serif",
        color: C.text,
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          height: 56,
          gap: 24,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentDim})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            P
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Finmark Pulse</span>
        </div>

        {/* Tabs */}
        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px",
                background: tab === t.id ? `${C.accent}15` : "transparent",
                border: "none",
                borderRadius: 6,
                color: tab === t.id ? C.accent : C.textDim,
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Period selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.textMuted, fontSize: 11 }}>Period:</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
              padding: "4px 8px",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </div>

        {/* User + Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: C.textDim, fontSize: 12 }}>{user.name || user.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: "5px 12px",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.textMuted,
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 32px" }}>
        {tab === "overview" && <OverviewPage days={days} />}
        {tab === "ai" && <AIUsagePage days={days} />}
        {tab === "tenants" && <TenantsPage days={days} />}
        {tab === "health" && <HealthPage />}
      </main>
    </div>
  );
}
