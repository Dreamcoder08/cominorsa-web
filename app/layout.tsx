import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Archivo, Newsreader, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${newsreader.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
