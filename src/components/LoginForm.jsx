import { useState } from "react";
import { C } from "../lib/theme";
import { apiFetch, storeTokens } from "../lib/api";

export default function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Check admin role
      const roles = data.user?.roles || [data.user?.role];
      if (!roles.includes("admin")) {
        setError("Pulse is admin-only. Your role: " + roles.join(", "));
        return;
      }

      storeTokens(data.access_token, data.refresh_token);
      localStorage.setItem("pulse_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    fontSize: 14,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "40px 36px",
          width: 380,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.accent, marginBottom: 4 }}>
            Finmark Pulse
          </div>
          <div style={{ color: C.textMuted, fontSize: 13 }}>Operations Dashboard</div>
        </div>

        {error && (
          <div
            style={{
              background: `${C.danger}15`,
              border: `1px solid ${C.danger}30`,
              borderRadius: 8,
              padding: "8px 12px",
              color: C.danger,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: C.textDim, fontSize: 12, fontWeight: 500 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            placeholder="admin@finmark.ai"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ color: C.textDim, fontSize: 12, fontWeight: 500 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 0",
            background: loading ? C.textMuted : C.accent,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {loading ? "Signing in..." : "Sign in to Pulse"}
        </button>
      </form>
    </div>
  );
}
