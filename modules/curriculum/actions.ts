"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateCurriculum } from "@/lib/ai/generate-curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

export async function generateAndPersistCurriculum(
  skillAssessmentId: string,
) {
  const assessment = await prisma.skillAssessment.findUnique({
    where: { id: skillAssessmentId },
    include: {
      jobListing: { include: { competencyMap: true } },
    },
  });
  if (!assessment) throw new Error("SkillAssessment not found.");
  if (!assessment.jobListing.competencyMap) {
    throw new Error("Competency map missing.");
  }

  const cm = assessment.jobListing.competencyMap;
  const breakdown = assessment.skillsBreakdown as unknown as SkillBreakdownItem[];
  const raw = assessment.rawAssessment as unknown as { summary?: string };

  const result = await generateCurriculum({
    jobTitle: assessment.jobListing.jobTitle,
    companyName: assessment.jobListing.companyName,
    requiredQualifications: cm.requiredQualifications,
    preferredQualifications: cm.preferredQualifications,
    tools: cm.tools,
    responsibilities: cm.responsibilities,
    assessmentSummary: raw?.summary ?? "",
    skillsBreakdown: breakdown,
    reinforcementFlags: assessment.reinforcementFlags,
    trueGaps: assessment.trueGaps,
  });

  // Normalize module ordering server-side so the UI can trust it.
  const modules = [...result.payload.modules]
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({ ...m, order: i }));

  const row = await prisma.curriculum.create({
    data: {
      userId: assessment.userId,
      jobListingId: assessment.jobListingId,
      skillAssessmentId,
      mode: "AI_AUGMENTED",
      modules: {
        overview: result.payload.overview,
        modules,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return row;
}
