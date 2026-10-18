const HOSTED_API = (process.env.NEXT_PUBLIC_ANALYTICS_ORIGIN || "").replace(/\/$/, "");

export function apiOrigin() {
  if (typeof location === "undefined") return "";
  const host = location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".sslip.io")) return "";
  return HOSTED_API;
}

export function apiUrl(path) {
  return `${apiOrigin()}${path}`;
}
