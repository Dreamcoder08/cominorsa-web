import type { Metadata } from "next";
import { ServicePageLayout } from "../ServicePageLayout";
import { generateServiceMetadata, serviceGroups } from "../services-data";

const service = serviceGroups.find(
  (s) => s.slug === "tramites-minem-ingemmet-drem",
)!;

export async function generateMetadata(): Promise<Metadata> {
  return generateServiceMetadata(service);
}

export default function TramitesMinemIngemmetDremPage() {
  return <ServicePageLayout service={service} />;
}
