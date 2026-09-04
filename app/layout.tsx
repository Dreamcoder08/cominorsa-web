import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Archivo, Newsreader, Geist_Mono } from "next/font/google";
import { getBaseUrl } from "./base-url";
import { CookieConsent } from "./CookieConsent";
import { PRIMARY_WHATSAPP_NUMBER } from "./constants";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
  variable: "--font-editorial",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#fbf8ef",
};

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const socialImage = `${baseUrl}/og.png`;

  return {
    title: "COMINORSA | Consultoría minera y ambiental",
    description:
      "Formalización minera, instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
    applicationName: "COMINORSA",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: "/apple-touch-icon.png",
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
          width: 1200,
          height: 630,
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = await getBaseUrl();
  const incomingHeaders = await headers();
  const nonce = incomingHeaders.get("x-nonce") ?? undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "COMINORSA S.A.C.",
    alternateName: "COMINORSA",
    description:
      "Consultoría minera y ambiental: formalización minera (IGAFOM, REINFO), instrumentos ambientales, ingeniería y asistencia técnica desde Piura, Perú.",
    url: baseUrl,
    telephone: `+${PRIMARY_WHATSAPP_NUMBER}`,
    taxID: "20614147131",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle B N.º 12, Urb. Santa Margarita",
      addressLocality: "Veintiséis de Octubre",
      addressRegion: "Piura",
      addressCountry: "PE",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Piura, Perú",
    },
  };

  return (
    <html
      lang="es"
      className={`${archivo.variable} ${newsreader.variable} ${geistMono.variable}`}
    >
      <body>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <CookieConsent nonce={nonce} />
      </body>
    </html>
  );
}
