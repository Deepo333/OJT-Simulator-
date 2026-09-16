import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Forge",
  description:
    "Turn any job listing into a personalized on-the-job-training plan.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <nav className="mb-10 flex items-center justify-between">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Career Forge
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                Stage 1
              </span>
            </a>
            <a
              href="/api/health"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              health
            </a>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
