import type { Metadata } from "next";
import { ServicePageLayout } from "../ServicePageLayout";
import { generateServiceMetadata, serviceGroups } from "../services-data";

const service = serviceGroups.find(
  (s) => s.slug === "declaraciones-dac-estamin",
)!;

export async function generateMetadata(): Promise<Metadata> {
  return generateServiceMetadata(service);
}

export default function DeclaracionesDacEstaminPage() {
  return <ServicePageLayout service={service} />;
}
