/**
 * Build-time feature flags. Values are read from `process.env` because they
 * gate server-side behavior; the `NEXT_PUBLIC_*` mirrors are surfaced to the
 * browser via the same `process.env.NEXT_PUBLIC_*` lookup that Next.js
 * inlines at build time.
 */

export function isEnterpriseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === 'true';
}

/**
 * When true, the dashboard may call n8n's internal REST API (`/rest/...`)
 * to enrich pages with folder membership. Off-by-default so a freshly cloned
 * repo doesn't try to call an endpoint the user hasn't configured.
 */
export function isInternalApiEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_INTERNAL_API_ENABLED;
  if (raw === undefined) return true; // default ON
  return raw === 'true' || raw === '1';
}