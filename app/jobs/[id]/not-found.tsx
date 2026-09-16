export default function NotFound() {
  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Job not found</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find a job analysis with that id. It may have been
        removed, or the analysis never finished.
      </p>
      <a href="/" className="underline underline-offset-4">
        Analyze a new job listing →
      </a>
    </main>
  );
}
