export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-6 py-16 text-text-primary">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface-raised p-8 raised-shadow">
        <h1 className="text-section-title">Sign in required</h1>
        <p className="mt-3 text-body text-text-secondary">
          You need to sign in before accessing this part of Waldhaus.
        </p>
      </div>
    </main>
  );
}