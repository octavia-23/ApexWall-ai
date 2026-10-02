import { track } from "@vercel/analytics";

/**
 * Helper to record custom events in Vercel Web Analytics.
 * @param eventName Name of the custom event (e.g. 'telemetry_upload', 'setup_generated')
 * @param properties Optional event data payload
 */
export function trackEvent(
  eventName: string,
  properties?: Record<string, string | number | boolean | null>
) {
  try {
    track(eventName, properties);
  } catch (error) {
    console.warn("[Analytics] Failed to track event:", error);
  }
}
