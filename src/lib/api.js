const API_BASE = import.meta.env.VITE_API_URL || "/api";

/* Access token lives in localStorage; the refresh token is an HttpOnly cookie
 * the browser sends automatically (credentials: "include"). So after the 1h
 * access token expires we silently mint a new one from the 7-day refresh
 * cookie — you stay logged in ~a week and only hit the CAPTCHA login once. */

export function getAccessToken() {
  return localStorage.getItem("ap_access_token");
}

export function storeTokens(access) {
  if (access) localStorage.setItem("ap_access_token", access);
}

export function clearTokens() {
  localStorage.removeItem("ap_access_token");
  localStorage.removeItem("ap_refresh_token"); // legacy cleanup
  localStorage.removeItem("pulse_user");
}

export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const access = getAccessToken();

  if (access) headers["Authorization"] = `Bearer ${access}`;
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let res = await fetch(`${API_BASE}${url}`, { ...options, headers, credentials: "include" });

  // On 401, silently refresh from the HttpOnly cookie, then retry once.
  if (res.status === 401 && !url.includes("/auth/")) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // send the HttpOnly refresh cookie
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      storeTokens(data.access_token);
      headers["Authorization"] = `Bearer ${data.access_token}`;
      res = await fetch(`${API_BASE}${url}`, { ...options, headers, credentials: "include" });
    } else {
      clearTokens();
      window.dispatchEvent(new Event("pulse_auth_expired"));
    }
  }

  return res;
}
