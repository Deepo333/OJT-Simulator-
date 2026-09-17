"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateQuestionnaire } from "@/lib/ai/generate-questionnaire";
import type { Question } from "@/lib/schemas/questionnaire";
import { generateAndPersistAssessment } from "@/modules/skill-assessment/actions";
import { generateAndPersistCurriculum } from "@/modules/curriculum/actions";
import type { QuestionnaireForClient, AnswerInput } from "./types";

// Load or lazily create the questionnaire for a job listing's most recent
// resume profile. Idempotent so refreshes are safe.
export async function ensureQuestionnaire(
  jobListingId: string,
): Promise<QuestionnaireForClient> {
  const job = await prisma.jobListing.findUnique({
    where: { id: jobListingId },
    include: {
      competencyMap: true,
      resumeProfiles: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!job) throw new Error("Job listing not found.");
  if (!job.competencyMap) {
    throw new Error("Competency map missing — analyze the job first.");
  }
  const profile = job.resumeProfiles[0];
  if (!profile) {
    throw new Error("Build your resume profile before the questionnaire.");
  }

  const existing = await prisma.questionnaire.findFirst({
    where: { jobListingId, resumeProfileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      id: existing.id,
      questions: existing.questions as unknown as Question[],
    };
  }

  const workHistory = (profile.workHistory as unknown as {
    role: string;
    company: string;
    dates: string;
    summary: string;
  }[]) ?? [];
  const historySummary = workHistory
    .slice(0, 6)
    .map((w) => `${w.role}${w.company ? ` at ${w.company}` : ""} (${w.dates}) — ${w.summary}`)
    .join("\n");

  const generated = await generateQuestionnaire({
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    requiredQualifications: job.competencyMap.requiredQualifications,
    preferredQualifications: job.competencyMap.preferredQualifications,
    tools: job.competencyMap.tools,
    responsibilities: job.competencyMap.responsibilities,
    softSkills: job.competencyMap.softSkills,
    profileWorkHistorySummary: historySummary,
    profileImpliedSkills: profile.impliedSkills,
    profileExplicitSkills: profile.explicitSkills,
    profileToolsMentioned: profile.toolsMentioned,
    profileCertifications: profile.certifications,
  });

  // Assign stable ids/values server-side so responses can be joined reliably.
  const questions: Question[] = generated.payload.questions.map((q, i) => ({
    id: `q-${i + 1}`,
    kind: q.kind,
    format: q.format,
    order: i,
    text: q.text,
    targetSkill: q.targetSkill,
    options: q.options.map((label, j) => ({ value: `opt-${j + 1}`, label })),
    allowFreeText: true,
  }));

  const row = await prisma.questionnaire.create({
    data: {
      userId: profile.userId,
      jobListingId,
      resumeProfileId: profile.id,
      questions: questions as unknown as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, questions };
}

export type SubmitQuestionnaireResult =
  | { status: "ok"; redirectTo: string }
  | { status: "error"; message: string };

export async function submitQuestionnaire(
  questionnaireId: string,
  answers: AnswerInput[],
): Promise<SubmitQuestionnaireResult> {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { status: "error", message: "No answers submitted." };
  }

  const questionnaire = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
  });
  if (!questionnaire) {
    return { status: "error", message: "Questionnaire not found." };
  }

  const questionsById = new Map(
    (questionnaire.questions as unknown as Question[]).map((q) => [q.id, q]),
  );

  await prisma.$transaction(async (tx) => {
    for (const a of answers) {
      const q = questionsById.get(a.questionId);
      if (!q) continue;
      const valid = new Set(q.options.map((o) => o.value));
      const selected = (a.selectedOptions ?? []).filter((v) => valid.has(v));
      const freeText = a.freeTextAnswer?.trim() ? a.freeTextAnswer.trim() : null;
      await tx.questionnaireResponse.upsert({
        where: {
          questionnaireId_questionId: { questionnaireId, questionId: a.questionId },
        },
        create: {
          questionnaireId,
          questionId: a.questionId,
          selectedOption: selected[0] ?? null,
          selectedOptions: selected,
          freeTextAnswer: freeText,
        },
        update: {
          selectedOption: selected[0] ?? null,
          selectedOptions: selected,
          freeTextAnswer: freeText,
        },
      });
    }
  });

  // Kick off Step 3 + Step 4 inline so the user lands on their curriculum.
  let assessment;
  try {
    assessment = await generateAndPersistAssessment(questionnaireId);
  } catch (err) {
    return {
      status: "error",
      message: `Assessment generation failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
  try {
    await generateAndPersistCurriculum(assessment.id);
  } catch (err) {
    return {
      status: "error",
      message: `Curriculum generation failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  return {
    status: "ok",
    redirectTo: `/jobs/${questionnaire.jobListingId}/curriculum`,
  };
}

export async function navigateAfterQuestionnaire(url: string) {
  redirect(url);
}
