const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function getStoredTokens() {
  return {
    access: localStorage.getItem("ap_access_token"),
    refresh: localStorage.getItem("ap_refresh_token"),
  };
}

export function storeTokens(access, refresh) {
  localStorage.setItem("ap_access_token", access);
  if (refresh) localStorage.setItem("ap_refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("ap_access_token");
  localStorage.removeItem("ap_refresh_token");
  localStorage.removeItem("pulse_user");
}

export async function apiFetch(url, options = {}) {
  const { access, refresh } = getStoredTokens();
  const headers = { ...(options.headers || {}) };

  if (access) {
    headers["Authorization"] = `Bearer ${access}`;
  }
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  // Auto-refresh on 401
  if (res.status === 401 && refresh) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${refresh}`,
      },
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      storeTokens(data.access_token, data.refresh_token || refresh);
      headers["Authorization"] = `Bearer ${data.access_token}`;
      res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    } else {
      clearTokens();
      window.dispatchEvent(new Event("pulse_auth_expired"));
    }
  }

  return res;
}
