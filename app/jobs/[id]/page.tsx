import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { JobAnalysisView } from "@/components/features/JobAnalysisView";
import { Button } from "@/components/ui/button";

export default async function JobResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const jobListing = await prisma.jobListing.findUnique({
    where: { id },
    include: {
      competencyMap: true,
      resumeProfiles: { orderBy: { createdAt: "desc" }, take: 1 },
      curricula: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!jobListing || !jobListing.competencyMap) {
    notFound();
  }

  const cm = jobListing.competencyMap;
  const hasProfile = jobListing.resumeProfiles.length > 0;
  const hasCurriculum = jobListing.curricula.length > 0;

  return (
    <main className="space-y-8">
      <JobAnalysisView
        jobTitle={jobListing.jobTitle}
        companyName={jobListing.companyName}
        sourceUrl={jobListing.sourceUrl}
        createdAt={jobListing.createdAt}
        rawText={jobListing.rawText}
        competencyMap={{
          requiredQualifications: cm.requiredQualifications,
          preferredQualifications: cm.preferredQualifications,
          tools: cm.tools,
          responsibilities: cm.responsibilities,
          softSkills: cm.softSkills,
        }}
      />

      <div className="rounded-lg border bg-muted/30 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Next: build your profile</h2>
            <p className="text-sm text-muted-foreground">
              Upload your resume so we can compare your actual experience
              against what this job needs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasCurriculum ? (
              <Button asChild variant="default">
                <Link href={`/jobs/${jobListing.id}/curriculum`}>
                  View your curriculum →
                </Link>
              </Button>
            ) : null}
            <Button asChild variant={hasCurriculum ? "outline" : "default"}>
              <Link href={`/jobs/${jobListing.id}/profile`}>
                {hasProfile ? "Update your profile" : "Build your profile →"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
