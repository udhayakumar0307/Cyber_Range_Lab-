// ── Tenant Configuration ─────────────────────────────────────────────────────
// Controls whether the dashboard runs as a multi-tenant demo (shows all sources,
// Integration page visible) or as a single-tenant deployment locked to one
// sector (Integration page hidden, branding customised).
//
// Set these in Dokploy → Environment for single-tenant deployments:
//   VITE_TENANT_MODE=single
//   VITE_TENANT_SECTOR=ecommerce        # or "finance"
//   VITE_TENANT_LABEL=Deeptrust Store   # sidebar & navbar branding
//
// When VITE_TENANT_MODE is unset or "multi", everything behaves exactly as the
// current workshop demo — no changes to existing behaviour.

export const tenantConfig = {
  /** "single" for a dedicated client deployment, "multi" for the demo portal. */
  mode: import.meta.env.VITE_TENANT_MODE || "multi",

  /** Sector key used in single-tenant mode (e.g. "ecommerce", "finance"). */
  sector: import.meta.env.VITE_TENANT_SECTOR || null,

  /** Display name shown in the sidebar logo and navbar. */
  label: import.meta.env.VITE_TENANT_LABEL || "CMS Center",
};

/** True when this deployment serves exactly one client. */
export const isSingleTenant = tenantConfig.mode === "single";

/** True when this deployment is the multi-source demo portal. */
export const isMultiTenant = !isSingleTenant;
