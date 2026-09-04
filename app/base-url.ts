import { headers } from "next/headers";

export async function getBaseUrl(): Promise<string> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("host") ?? "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
