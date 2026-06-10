const RAW_BASE = (import.meta.env.VITE_API_URL || "https://x.nexus-x.site/api").replace(/\/+$/, "");
// If base already ends with /api, strip it so callers can use either "/api/foo" or "/foo".
const BASE_HAS_API = /\/api$/i.test(RAW_BASE);
const ROOT = BASE_HAS_API ? RAW_BASE.replace(/\/api$/i, "") : RAW_BASE;

export function apiUrl(path: string): string {
  let p = path.startsWith("/") ? path : `/${path}`;
  // Normalize: ensure exactly one /api prefix
  if (!/^\/api(\/|$)/i.test(p)) p = `/api${p}`;
  return `${ROOT}${p}`;
}
