import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { CurriculumRoadmap } from "@/components/features/CurriculumRoadmap";
import { generateAndPersistAssessment } from "@/modules/skill-assessment/actions";
import { generateAndPersistCurriculum } from "@/modules/curriculum/actions";
import type { CurriculumModule } from "@/lib/schemas/curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

export default async function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await prisma.jobListing.findUnique({
    where: { id },
    include: {
      curricula: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { skillAssessment: true },
      },
      questionnaires: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { skillAssessments: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  if (!job) notFound();

  const questionnaire = job.questionnaires[0];
  if (!questionnaire) {
    redirect(`/jobs/${id}/profile`);
  }

  // If no curriculum yet, run steps 3+4 on demand. Normally the questionnaire
  // submit action runs both; this branch is a self-healing fallback for
  // re-entering the page directly.
  let curriculum = job.curricula[0] ?? null;
  let assessmentRow = curriculum?.skillAssessment ?? questionnaire.skillAssessments[0] ?? null;

  if (!curriculum) {
    if (!assessmentRow) {
      try {
        assessmentRow = await generateAndPersistAssessment(questionnaire.id);
      } catch (err) {
        return renderError(err);
      }
    }
    try {
      curriculum = await prisma.curriculum.findFirst({
        where: { skillAssessmentId: assessmentRow.id },
        orderBy: { createdAt: "desc" },
        include: { skillAssessment: true },
      });
      if (!curriculum) {
        const created = await generateAndPersistCurriculum(assessmentRow.id);
        curriculum = await prisma.curriculum.findUnique({
          where: { id: created.id },
          include: { skillAssessment: true },
        });
      }
    } catch (err) {
      return renderError(err);
    }
  }

  if (!curriculum || !assessmentRow) {
    return renderError(new Error("Curriculum not available."));
  }

  const plan = curriculum.modules as unknown as {
    overview: string;
    modules: CurriculumModule[];
  };
  const raw = assessmentRow.rawAssessment as unknown as { summary?: string } | null;
  const breakdown = assessmentRow.skillsBreakdown as unknown as SkillBreakdownItem[];

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Personalized for {job.jobTitle} at {job.companyName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Your curriculum
        </h1>
      </header>

      <CurriculumRoadmap
        overview={plan.overview}
        modules={plan.modules}
        reinforcementFlags={assessmentRow.reinforcementFlags}
        trueGaps={assessmentRow.trueGaps}
        summary={raw?.summary ?? ""}
        skillsBreakdown={breakdown}
      />

      <footer className="flex flex-wrap justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <Link href={`/jobs/${id}`} className="underline underline-offset-4">
          ← Back to the job analysis
        </Link>
        <span>Lesson content and assignments arrive in Stage 3.</span>
      </footer>
    </main>
  );
}

function renderError(err: unknown) {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">
        We couldn&apos;t build your curriculum
      </h1>
      <p className="text-muted-foreground">
        {err instanceof Error ? err.message : "Unknown error."}
      </p>
    </main>
  );
}
