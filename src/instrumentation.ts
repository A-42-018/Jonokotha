import type { Instrumentation } from "next";
import { captureError } from "./lib/monitor";

/**
 * Sentry for the server and the proxy (B5.8): Next calls this for every uncaught request error, in the Node.js runtime and for the proxy.
 * Only the error class, a trimmed message, the route and the render type are sent (see lib/monitor.ts); never headers, cookies or bodies.
 * Without SENTRY_DSN it does nothing.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await captureError(err, { route: `${context.routeType}:${context.routePath || request.path.split("?")[0]}`, request_id: (err as { digest?: string })?.digest ?? "none" });
};
