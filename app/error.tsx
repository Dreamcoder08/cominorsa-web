"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El error llega al log de Workers (ver DEPLOY.md > Observability).
    // Acá podríamos mandar a Sentry/PostHog si los activamos.
    console.error(error);
  }, [error]);

  return (
    <main
      lang="es"
      className="min-h-screen flex items-center justify-center px-6 py-24"
    >
      <div className="max-w-2xl text-center">
        <p className="text-sm font-semibold text-rose-700 mb-4">Error 500</p>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
          Algo salió mal
        </h1>
        <p className="text-lg text-slate-700 mb-8">
          Tuvimos un problema procesando tu solicitud. El equipo técnico ya fue
          notificado. Probá recargar la página o volvé al inicio.
        </p>
        {error.digest ? (
          <p className="text-xs text-slate-500 mb-6 font-mono">
            ID de seguimiento: {error.digest}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-amber-600 bg-white px-6 py-3 text-base font-medium text-amber-700 shadow-sm hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
