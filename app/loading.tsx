export default function Loading() {
  return (
    <main
      lang="es"
      className="min-h-screen flex items-center justify-center px-6"
    >
      <div
        className="flex flex-col items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-600">Cargando…</p>
      </div>
    </main>
  );
}
