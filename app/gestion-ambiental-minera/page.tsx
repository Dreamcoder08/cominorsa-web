import type { Metadata } from "next";
import { ServicePageLayout } from "../ServicePageLayout";
import { generateServiceMetadata, serviceGroups } from "../services-data";

const service = serviceGroups.find(
  (s) => s.slug === "gestion-ambiental-minera",
)!;

export async function generateMetadata(): Promise<Metadata> {
  return generateServiceMetadata(service);
}

export default function GestionAmbientalMineraPage() {
  return <ServicePageLayout service={service} />;
}
