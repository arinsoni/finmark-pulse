import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

/* Cloudflare Turnstile CAPTCHA — mirrors the main app's component.
   The live backend (Pentest #10) requires a token on /auth/login, so Pulse must
   send one too. Env-gated: with no VITE_TURNSTILE_SITE_KEY this renders nothing
   (e.g. a local backend without the secret key), so dev keeps working.

   Cloudflare allows `localhost` by default, so this works when Pulse is run
   locally (npm run live) against the live API. Tokens are single-use — the
   parent calls ref.reset() after each attempt to mint a fresh one. */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TURNSTILE_ENABLED = !!SITE_KEY;

let _scriptPromise = null;
function loadTurnstile() {
  if (typeof window !== "undefined" && window.turnstile) return Promise.resolve();
  if (!_scriptPromise) {
    _scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(s);
    });
  }
  return _scriptPromise;
}

const Turnstile = forwardRef(function Turnstile({ onToken }, ref) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      try {
        if (widgetId.current != null && window.turnstile) {
          window.turnstile.reset(widgetId.current);
        }
      } catch {}
    },
  }), []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let active = true;
    loadTurnstile()
      .then(() => {
        if (!active || !container.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: SITE_KEY,
          callback: (t) => cb.current && cb.current(t),
          "expired-callback": () => cb.current && cb.current(""),
          "error-callback": () => cb.current && cb.current(""),
          theme: "auto",
        });
      })
      .catch(() => {});
    return () => {
      active = false;
      try {
        if (widgetId.current != null && window.turnstile) {
          window.turnstile.remove(widgetId.current);
        }
      } catch {}
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={container} style={{ marginBottom: 4, display: "flex", justifyContent: "center" }} />;
});

export default Turnstile;
