const RAW_BASE = (import.meta.env.VITE_API_URL || "https://x.nexus-x.site/api").replace(/\/+$/, "");

// VITE_API_URL points at the public gateway prefix (/api). Nginx strips that
// prefix before proxying, while protected backend routes also live under /api.
// So /api/reports externally must become /api/api/reports when RAW_BASE ends in /api.

export function apiUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  // Normalize the backend route path; do not strip RAW_BASE's gateway /api prefix.
  if (!/^\/api(\/|$)/i.test(p)) p = `/api${p}`;
  return `${RAW_BASE}${p}`;
}
