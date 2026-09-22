import type { Metadata } from "next";
import { getBaseUrl } from "./base-url";
// T6a: the service catalog itself moved to `src/data/services-data.ts`
// (pure, framework-free) so the Bun-native static build can import the
// exact same array instead of hand-copying it — see that module's
// header comment for why. This file re-exports it unchanged so every
// existing `app/` import of `ServiceGroup`/`serviceGroups` keeps
// working, and keeps the one Next-specific piece (`generateServiceMetadata`,
// which needs `getBaseUrl()` -> `next/headers`) here.
import type { ServiceGroup } from "../src/data/services-data";
import { serviceGroups } from "../src/data/services-data";

export type { ServiceGroup };
export { serviceGroups };

export async function generateServiceMetadata(
  service: ServiceGroup,
): Promise<Metadata> {
  const baseUrl = await getBaseUrl();

  return {
    title: `${service.pageTitle} | COMINORSA`,
    description: service.pageDescription,
    alternates: { canonical: `${baseUrl}/${service.slug}` },
  };
}
