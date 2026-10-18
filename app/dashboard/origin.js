const HOSTED_API = "https://eepydog.103.161.35.238.sslip.io";

export function apiOrigin() {
  if (typeof location === "undefined") return "";
  const host = location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "eepydog.103.161.35.238.sslip.io") return "";
  return HOSTED_API;
}

export function apiUrl(path) {
  return `${apiOrigin()}${path}`;
}
