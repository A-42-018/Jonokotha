"use client";
import { useEffect } from "react";
import InstallPrompt from "./InstallPrompt";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`);
  }, []);
  return <InstallPrompt />;
}
