"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateSkillAssessment } from "@/lib/ai/generate-assessment";
import type { Question } from "@/lib/schemas/questionnaire";

const COMFORT_LABELS: Record<string, string> = {
  NOT_FAMILIAR: "Not familiar",
  SOMEWHAT_FAMILIAR: "Somewhat familiar",
  COMFORTABLE: "Comfortable",
  VERY_COMFORTABLE: "Very comfortable",
  HIGHLY_SKILLED: "Highly skilled",
};

// Read every input, call Claude, persist a SkillAssessment. Returns the row.
export async function generateAndPersistAssessment(
  questionnaireId: string,
) {
  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    include: {
      responses: true,
      resumeProfile: true,
      jobListing: { include: { competencyMap: true } },
    },
  });
  if (!questionnaire) throw new Error("Questionnaire not found.");
  if (!questionnaire.jobListing.competencyMap) {
    throw new Error("Competency map missing.");
  }

  const profile = questionnaire.resumeProfile;
  const cm = questionnaire.jobListing.competencyMap;
  const questions = questionnaire.questions as unknown as Question[];
  const responseById = new Map(
    questionnaire.responses.map((r) => [r.questionId, r]),
  );

  const workHistory = (profile.workHistory as unknown as {
    role: string;
    company: string;
    dates: string;
    summary: string;
  }[]) ?? [];
  const historySummary = workHistory
    .slice(0, 8)
    .map((w) => `${w.role}${w.company ? ` at ${w.company}` : ""} (${w.dates}) — ${w.summary}`)
    .join("\n");

  const answers = questions.map((q) => {
    const r = responseById.get(q.id);
    const label = r?.selectedOption
      ? (q.options.find((o) => o.value === r.selectedOption)?.label ??
        COMFORT_LABELS[r.selectedOption] ??
        r.selectedOption)
      : r?.freeTextAnswer
        ? "(free-text only)"
        : "(no answer)";
    return {
      kind: q.kind,
      targetSkill: q.targetSkill,
      text: q.text,
      answerLabel: label,
      freeText: r?.freeTextAnswer ?? undefined,
    };
  });

  const result = await generateSkillAssessment({
    jobTitle: questionnaire.jobListing.jobTitle,
    companyName: questionnaire.jobListing.companyName,
    requiredQualifications: cm.requiredQualifications,
    preferredQualifications: cm.preferredQualifications,
    tools: cm.tools,
    softSkills: cm.softSkills,
    responsibilities: cm.responsibilities,
    profileWorkHistorySummary: historySummary,
    profileImpliedSkills: profile.impliedSkills,
    profileExplicitSkills: profile.explicitSkills,
    profileToolsMentioned: profile.toolsMentioned,
    profileCertifications: profile.certifications,
    answers,
  });

  const row = await prisma.skillAssessment.create({
    data: {
      userId: profile.userId,
      jobListingId: profile.jobListingId,
      questionnaireId,
      skillsBreakdown: result.payload.skillsBreakdown as unknown as Prisma.InputJsonValue,
      reinforcementFlags: result.payload.reinforcementFlags,
      trueGaps: result.payload.trueGaps,
      rawAssessment: {
        summary: result.payload.summary,
        raw: result.raw,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return row;
}
