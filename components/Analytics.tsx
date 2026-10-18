"use client";

import { useEffect } from "react";
import { apiOrigin, apiUrl } from "@/app/dashboard/origin";

const CLICKS = new Set(["copy", "community", "x", "uniswap", "etherscan", "song", "enter"]);

function trackingRefused() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null };
  if (nav.globalPrivacyControl) return true;
  const dnt = nav.doNotTrack || (window as Window & { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function isDashboard() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path.endsWith("/dashboard");
}

export default function Analytics() {
  useEffect(() => {
    if (isDashboard() || trackingRefused()) return;
    const endpoint = apiUrl("/api/analytics/collect");
    if (!endpoint || (endpoint.startsWith("/api/") && apiOrigin() === "" && !["localhost", "127.0.0.1"].includes(window.location.hostname))) {
      if (!["localhost", "127.0.0.1"].includes(window.location.hostname) && !window.location.hostname.endsWith(".sslip.io")) return;
    }
    let section = "hero";
    const utm = new URLSearchParams(window.location.search);
    const post = (route: string, body: Record<string, unknown>) => {
      const url = apiUrl(route);
      if (!url) return Promise.resolve(false);
      return fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
        credentials: apiOrigin() ? "include" : "same-origin",
        cache: "no-store",
        keepalive: true,
      }).then((response) => response.ok).catch(() => false);
    };
    const payload = (type: string, eventId: string, click?: string) => ({
      type,
      eventId,
      path: `${window.location.pathname}${window.location.search}`,
      section,
      referrer: document.referrer,
      click,
      utmSource: utm.get("utm_source") || undefined,
      utmMedium: utm.get("utm_medium") || undefined,
      utmCampaign: utm.get("utm_campaign") || undefined,
    });
    const pageEventId = crypto.randomUUID();
    void post("/api/analytics/collect", payload("pageview", pageEventId)).then((ok) => {
      if (!ok) void post("/api/analytics/collect", payload("pageview", pageEventId));
    });
    let heartbeatId = crypto.randomUUID();
    let timer = 0;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      const id = heartbeatId;
      void post("/api/analytics/heartbeat", payload("heartbeat", id)).then((ok) => {
        if (ok) heartbeatId = crypto.randomUUID();
      });
    };
    const arm = () => {
      window.clearInterval(timer);
      if (document.visibilityState !== "visible") return;
      timer = window.setInterval(beat, 30000);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        beat();
        arm();
      } else window.clearInterval(timer);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("[data-link-role]");
      if (!(link instanceof HTMLElement)) return;
      const role = link.dataset.linkRole || "";
      if (!CLICKS.has(role) || link.getAttribute("aria-disabled") === "true") return;
      void post("/api/analytics/collect", payload("click", crypto.randomUUID(), role));
    };
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const next = visible[0]?.target.getAttribute("data-section");
        if (!next || next === section) return;
        section = next;
        void post("/api/analytics/collect", payload("section", crypto.randomUUID()));
      }, { threshold: [0.35] });
      sections.forEach((el) => observer?.observe(el));
    }
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("click", onClick);
    if (document.visibilityState === "visible") arm();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("click", onClick);
      observer?.disconnect();
    };
  }, []);
  return null;
}
