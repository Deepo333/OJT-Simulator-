"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Route-level error boundary. Surfaces the actual error so it can be read on
// a phone (Next's default page hides it behind "see the browser console").
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        The page hit an error while rendering. The details below help us fix
        it — copy them if you report this.
      </p>
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
        {error.name}: {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        {error.stack ? `\n\n${error.stack}` : ""}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <a href="/">Start over</a>
        </Button>
      </div>
    </main>
  );
}
