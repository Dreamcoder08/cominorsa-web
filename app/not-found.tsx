import type { Metadata } from "next";
import Link from "next/link";
import { buildWhatsAppLink } from "./constants";

export const metadata: Metadata = {
  title: "Página no encontrada | COMINORSA",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main
      lang="es"
      className="min-h-screen flex items-center justify-center px-6 py-24"
    >
      <div className="max-w-2xl text-center">
        <p className="text-sm font-semibold text-amber-700 mb-4">Error 404</p>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Página no encontrada
        </h1>
        <p className="text-lg text-slate-700 mb-8">
          La ruta que buscás no existe o fue movida. Si llegaste acá desde un
          enlace, avisanos para corregirlo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            Volver al inicio
          </Link>
          <a
            href={buildWhatsAppLink(
              "Hola, llegué a un enlace roto en su web",
            )}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center rounded-md border border-amber-600 bg-white px-6 py-3 text-base font-medium text-amber-700 shadow-sm hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-700 focus:ring-offset-2"
          >
            Avisar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
