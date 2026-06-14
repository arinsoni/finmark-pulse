/* Total-Cost-of-Ownership assumptions (v1 — config-based).
 *
 * AI cost is pulled LIVE from the backend (ai_usage_logs). Everything here is the
 * fixed/manual part: infra run-rate, other subscriptions, and the AWS credit
 * balance for the runway calc. Editable in the browser (Costs tab → "Edit
 * assumptions") and persisted to localStorage — no redeploy needed to update.
 *
 * Defaults seeded from real AWS Cost Explorer data (2026-06):
 *   AWS list-price run-rate ≈ $60–67/mo (1× EC2 t3.medium + 1× RDS db.t3.micro
 *   single-AZ + EBS/S3/transfer). Currently 100% offset by AWS credits, so the
 *   ACTUAL bill is $0/mo — but that ends when credits run out.
 */

export const DEFAULT_COST_CONFIG = {
  // AWS infra
  infraListPriceMonthly: 65,   // true run-rate (what it costs without credits)
  infraBilledMonthly: 0,       // what you actually pay today (credits cover it)

  // AWS credits
  creditBalanceRemaining: null, // ← fill from AWS Billing console → Credits
  creditBurnMonthly: 65,        // credits absorb ~the full AWS list-price usage

  // Other recurring costs (USD/month)
  otherCosts: [
    { name: "Domains (finmark.ai etc.)", monthly: 2 },
    { name: "Cloudflare Turnstile", monthly: 0 },   // free tier
    { name: "Gmail SMTP (OTP)", monthly: 0 },        // free
    { name: "Dojah TIN", monthly: 0 },               // sandbox — update when prod keys bought
  ],
};

const LS_KEY = "pulse_cost_config";

export function loadCostConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY));
    if (!stored) return { ...DEFAULT_COST_CONFIG };
    // shallow-merge so new default keys appear even on old saved configs
    return { ...DEFAULT_COST_CONFIG, ...stored,
      otherCosts: Array.isArray(stored.otherCosts) ? stored.otherCosts : DEFAULT_COST_CONFIG.otherCosts };
  } catch {
    return { ...DEFAULT_COST_CONFIG };
  }
}

export function saveCostConfig(cfg) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

export const sumOther = (cfg) =>
  (cfg.otherCosts || []).reduce((s, c) => s + (Number(c.monthly) || 0), 0);
