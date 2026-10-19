const WEAK_PUBLIC_PASSWORDS = new Set(["aaaa", "password", "admin", "changeme"])

/** Local development may omit a password. A public reverse proxy may not. */
export function resolveDashboardPassword(password: string | undefined, trustProxy: boolean): string {
  const configured = password?.trim() ?? ""
  if (!trustProxy) return configured || "aaaa"
  if (configured.length < 8 || WEAK_PUBLIC_PASSWORDS.has(configured.toLowerCase())) {
    throw new Error(
      "Refusing to start a public tracker with a missing or weak DASHBOARD_PASSWORD. Set a unique password of at least 8 characters.",
    )
  }
  return configured
}
