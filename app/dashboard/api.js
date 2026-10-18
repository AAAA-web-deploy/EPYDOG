import { apiOrigin, apiUrl } from "./origin.js";

export async function api(path, init = {}) {
  const headers = new Headers({ accept: "application/json" });
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.csrf) headers.set("x-csrf-token", init.csrf);
  try {
    const response = await fetch(apiUrl(path), {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: apiOrigin() ? "include" : "same-origin",
      cache: "no-store",
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = {}; }
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

export function errorMessage(status, data, fallback) {
  const message = data && typeof data === "object" && "error" in data ? data.error : undefined;
  if (typeof message === "string" && message) return message;
  if (status === 0 || status === 404) return "The dashboard service is unavailable on this host.";
  return fallback;
}
