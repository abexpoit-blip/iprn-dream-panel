import { apiUrl } from "@/lib/api-url";

export const isSelfHosted = import.meta.env.VITE_SELF_HOSTED === "true";

type QueryValue = string | number | boolean | null | undefined;

export async function fetchSelfHostedJson<T>(path: string, params: Record<string, QueryValue> = {}): Promise<T> {
  const url = new URL(apiUrl(path));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const token = localStorage.getItem("nexus_token");
  const res = await fetch(url.toString(), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || "Backend request failed");
  return body as T;
}