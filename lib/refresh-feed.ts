import type { Feed } from "./types";

// Longer than the upstream feed deadline, but bounded on flaky connections.
export async function refreshFeed(timeoutMs = 25_000): Promise<Feed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api/deals", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Refresh failed");
    return (await response.json()) as Feed;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The connection is taking too long. Try again when you’re ready.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
