import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "জনকথা — Jonokotha",
    short_name: "জনকথা",
    description: "Report neighbourhood problems to your representative",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ec",
    theme_color: "#0b3d2e",
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
