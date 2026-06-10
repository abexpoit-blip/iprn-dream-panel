const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://x.nexus-x.site/api").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}