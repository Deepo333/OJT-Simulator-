"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { generateDynamicQuestions } from "@/lib/ai/generate-questionnaire";
import {
  COMFORT_SCALE,
  type Question,
} from "@/lib/schemas/questionnaire";
import { STANDARDIZED_QUESTIONS } from "./standardized-questions";
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

  const dynamic = await generateDynamicQuestions({
    jobTitle: job.jobTitle,
    companyName: job.companyName,
    requiredQualifications: job.competencyMap.requiredQualifications,
    preferredQualifications: job.competencyMap.preferredQualifications,
    tools: job.competencyMap.tools,
    softSkills: job.competencyMap.softSkills,
    profileWorkHistorySummary: historySummary,
    profileImpliedSkills: profile.impliedSkills,
    profileExplicitSkills: profile.explicitSkills,
    profileToolsMentioned: profile.toolsMentioned,
    profileCertifications: profile.certifications,
  });

  // Pad/truncate to exactly 10 in case Claude returned 6-14.
  const dynamicQs: Question[] = dynamic.payload.questions
    .slice(0, 10)
    .map((q, i) => ({
      id: `dyn-${i + 1}`,
      kind: q.kind,
      order: STANDARDIZED_QUESTIONS.length + i,
      text: q.text,
      targetSkill: q.targetSkill,
      options: [...COMFORT_SCALE],
      allowFreeText: true,
    }));

  const allQuestions: Question[] = [...STANDARDIZED_QUESTIONS, ...dynamicQs];

  const row = await prisma.questionnaire.create({
    data: {
      userId: profile.userId,
      jobListingId,
      resumeProfileId: profile.id,
      questions: allQuestions as unknown as Prisma.InputJsonValue,
    },
  });

  return { id: row.id, questions: allQuestions };
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

  const knownIds = new Set(
    (questionnaire.questions as unknown as Question[]).map((q) => q.id),
  );

  await prisma.$transaction(async (tx) => {
    for (const a of answers) {
      if (!knownIds.has(a.questionId)) continue;
      await tx.questionnaireResponse.upsert({
        where: {
          questionnaireId_questionId: {
            questionnaireId,
            questionId: a.questionId,
          },
        },
        create: {
          questionnaireId,
          questionId: a.questionId,
          selectedOption: a.selectedOption,
          freeTextAnswer: a.freeTextAnswer,
        },
        update: {
          selectedOption: a.selectedOption,
          freeTextAnswer: a.freeTextAnswer,
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

// A tiny redirect wrapper so client components can navigate after the
// action returns (redirect() from within an action would fail on client
// call sites that expect a value).
export async function navigateAfterQuestionnaire(url: string) {
  redirect(url);
}
