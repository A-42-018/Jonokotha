import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "জনকথা — Jonokotha",
    short_name: "জনকথা",
    description: "Report neighbourhood problems to your representative",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f8fc",
    theme_color: "#1d5fa8",
    lang: "bn",
    id: "/",
    scope: "/",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/illustrations/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
