import { JobAnalysisForm } from "@/components/features/JobAnalysisForm";

export default function HomePage() {
  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">
          Analyze a job listing
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Paste a real job posting. Career Forge extracts a structured
          competency map — required and preferred qualifications, tools,
          concrete responsibilities, and the soft skills expected — so future
          stages can generate your personalized training curriculum.
        </p>
      </header>
      <JobAnalysisForm />
    </main>
  );
}
