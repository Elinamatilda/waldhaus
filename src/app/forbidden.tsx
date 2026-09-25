export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your account does not have permission to view this part of Waldhaus.
        </p>
      </div>
    </main>
  );
}