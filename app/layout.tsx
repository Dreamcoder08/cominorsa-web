import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host = incomingHeaders.get("host") ?? "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;
  const socialImage = `${baseUrl}/og.png`;

  return {
    title: "COMINORSA | Consultoría minera y ambiental",
    description:
      "Formalización minera, instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
    applicationName: "COMINORSA",
    icons: {
      icon: "/logo.png",
      shortcut: "/logo.png",
      apple: "/logo.png",
    },
    openGraph: {
      type: "website",
      locale: "es_PE",
      siteName: "COMINORSA",
      title: "COMINORSA | Técnica que impulsa",
      description:
        "Formalización minera y soluciones ambientales para una minería segura y sostenible.",
      images: [
        {
          url: socialImage,
          width: 1536,
          height: 1024,
          alt: "COMINORSA — Consultoría minera y soluciones ambientales",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "COMINORSA | Consultoría minera y ambiental",
      description:
        "Formalización, gestión ambiental y asistencia técnica minera.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
