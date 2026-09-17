"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself. Must render its own
// <html>/<body> because the layout is what failed.
export default function GlobalError({
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
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontSize: 12,
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 12,
            marginTop: 12,
            maxHeight: "50vh",
            overflow: "auto",
          }}
        >
          {error.name}: {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <button
          type="button"
          onClick={() => reset()}
          style={{ marginTop: 12, padding: "8px 14px" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
