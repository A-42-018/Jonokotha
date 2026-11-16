"use client";
import { useEffect } from "react";
import InstallPrompt from "./InstallPrompt";

export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js");
  }, []);
  return <InstallPrompt />;
}
