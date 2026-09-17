import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ensureQuestionnaire } from "@/modules/questionnaire/actions";
import { QuestionnaireFlow } from "@/components/features/QuestionnaireFlow";

export default async function QuestionnairePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.jobListing.findUnique({
    where: { id },
    include: {
      resumeProfiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!job) notFound();
  if (job.resumeProfiles.length === 0) {
    redirect(`/jobs/${id}/profile`);
  }

  let questionnaire;
  try {
    questionnaire = await ensureQuestionnaire(id);
  } catch (err) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-semibold">
          We couldn&apos;t build your questionnaire
        </h1>
        <p className="text-muted-foreground">
          {err instanceof Error ? err.message : "Unknown error."}
        </p>
        <Link
          href={`/jobs/${id}/profile`}
          className="underline underline-offset-4"
        >
          Go back to your profile →
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          For {job.jobTitle} at {job.companyName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Quick honesty check
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Tap through {questionnaire.questions.length} short questions. There
          are no wrong answers — the more honest you are, the more accurate
          your curriculum will be.
        </p>
      </header>
      <QuestionnaireFlow
        questionnaireId={questionnaire.id}
        questions={questionnaire.questions}
      />
    </main>
  );
}
