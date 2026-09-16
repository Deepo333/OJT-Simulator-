import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { JobAnalysisView } from "@/components/features/JobAnalysisView";

// Server component — reads directly from the DB.
export default async function JobResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const jobListing = await prisma.jobListing.findUnique({
    where: { id },
    include: { competencyMap: true },
  });

  if (!jobListing || !jobListing.competencyMap) {
    notFound();
  }

  const cm = jobListing.competencyMap;

  const parseList = (raw: string): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  };

  return (
    <main>
      <JobAnalysisView
        jobTitle={jobListing.jobTitle}
        companyName={jobListing.companyName}
        sourceUrl={jobListing.sourceUrl}
        createdAt={jobListing.createdAt}
        rawText={jobListing.rawText}
        competencyMap={{
          requiredQualifications: parseList(cm.requiredQualifications),
          preferredQualifications: parseList(cm.preferredQualifications),
          tools: parseList(cm.tools),
          responsibilities: parseList(cm.responsibilities),
          softSkills: parseList(cm.softSkills),
        }}
      />
    </main>
  );
}
