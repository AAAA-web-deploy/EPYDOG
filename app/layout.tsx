import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Patrick_Hand, Pixelify_Sans } from "next/font/google";
import { asset, basePath } from "@/lib/asset";
import { site } from "@/config/site";
import "./globals.css";
import "./sdc-typography.css";

const pixel = Pixelify_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ui" });
const hand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-hand" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: site.title,
  description: site.description,
  applicationName: site.projectName,
  icons: {
    icon: [
      { url: asset("/sdc/brand/favicon.ico") },
      { url: asset("/sdc/brand/favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: asset(site.logo), type: "image/svg+xml" },
    ],
    apple: asset("/sdc/brand/apple-touch-icon.png"),
  },
  openGraph: {
    title: site.title,
    description: site.description,
    images: [{ url: asset("/sdc/social/open-graph-1200x630.jpg"), width: 1200, height: 630, alt: "Sleepy Dogs Club" }],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7fa7d8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixel.variable} ${hand.variable} ${mono.variable}`}>
      <head>
        <style>{`:root{--cement-image:url("${asset("/cement.png")}")}`}</style>
      </head>
      <body data-base-path={basePath}>{children}</body>
    </html>
  );
}
