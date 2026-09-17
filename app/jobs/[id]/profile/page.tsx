import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ResumeProfileForm } from "@/components/features/ResumeProfileForm";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.jobListing.findUnique({ where: { id } });
  if (!job) notFound();

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Analyzing for <span className="font-medium">{job.jobTitle}</span>{" "}
          at {job.companyName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tell us about you
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Upload your resume so we can compare your real experience with what
          the job needs. This should take about 30 seconds.
        </p>
      </header>
      <ResumeProfileForm jobListingId={job.id} />
    </main>
  );
}
