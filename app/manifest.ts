import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COMINORSA | Consultoría minera y ambiental",
    short_name: "COMINORSA",
    description:
      "Consultoría minera y soluciones ambientales desde Piura, Perú.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eed9",
    theme_color: "#001713",
    lang: "es-PE",
    icons: [
      {
        src: "/logo.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
