import type { Metadata } from "next";
import { ServicePageLayout } from "../ServicePageLayout";
import { generateServiceMetadata, serviceGroups } from "../services-data";

const service = serviceGroups.find(
  (s) => s.slug === "ingenieria-y-planes-de-minado",
)!;

export async function generateMetadata(): Promise<Metadata> {
  return generateServiceMetadata(service);
}

export default function IngenieriaYPlanesDeMinadoPage() {
  return <ServicePageLayout service={service} />;
}
