import type { SVGProps } from "react";
type IconName = "x" | "copy" | "check" | "music" | "volume" | "mute" | "play" | "pause" | "next" | "prev" | "menu" | "down" | "external" | "close";
export default function Icon({ name, size = 18, ...rest }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const common = { stroke: "currentColor", fill: "none", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let content: React.ReactNode;
  switch(name) {
    case "x": content = <path d="M6 6l12 12M18 6 6 18" />; break;
    case "close": content = <path d="M5 5l14 14M19 5 5 19"/>; break;
    case "copy": content = <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>; break;
    case "check": content = <path d="m4 12 5 5L20 6"/>; break;
    case "music": content = <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>; break;
    case "volume": content = <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></>; break;
    case "mute": content = <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/></>; break;
    case "play": content = <path fill="currentColor" stroke="none" d="m8 4 12 8-12 8V4Z"/>; break;
    case "pause": content = <><path fill="currentColor" stroke="none" d="M7 4h4v16H7zm7 0h4v16h-4z"/></>; break;
    case "prev": content = <><path fill="currentColor" stroke="none" d="M6 5h2v14H6zm13 1L9 12l10 6V6z"/></>; break;
    case "next": content = <><path fill="currentColor" stroke="none" d="M16 5h2v14h-2zM5 6l10 6-10 6V6z"/></>; break;
    case "menu": content = <><path d="M4 7h16M4 12h16M4 17h16"/></>; break;
    case "down": content = <><path d="M12 3v17m-7-7 7 7 7-7"/></>; break;
    case "external": content = <><path d="M13 5h6v6m0-6-9 9"/><path d="M19 14v5H5V5h5"/></>; break;
    default: content = null;
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common} {...rest}>{content}</svg>;
}
