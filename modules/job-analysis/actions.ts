"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { analyzeJob } from "@/lib/ai/analyze-job";
import {
  jobAnalysisFormSchema,
  type JobAnalysisFormError,
} from "./types";

// Server Action wired to the Home-page form.
//
// Contract:
//   * Validates the form input with Zod.
//   * Ensures a demo user exists (Stage 1 has no auth — one demo user owns
//     everything, matching the seed script).
//   * Persists the JobListing FIRST so a mid-flight analyzer failure still
//     leaves a record we can retry against later.
//   * Calls Claude, validates, and persists a CompetencyMap.
//   * Redirects to /jobs/[id] on success. On validation failure, returns a
//     structured error the form can render inline.

// On success the action returns the destination instead of calling
// redirect(): a redirect thrown through useActionState is the one path that
// misbehaves in some browsers (notably iOS Safari), so the client navigates.
export type JobAnalysisFormState =
  | { status: "idle" }
  | { status: "success"; redirectTo: string }
  | { status: "error"; errors: JobAnalysisFormError[] };

const DEMO_EMAIL = "demo@career-forge.local";

async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      currentSkills: [],
    },
  });
}

export async function analyzeAndPersistJob(
  _prev: JobAnalysisFormState,
  formData: FormData,
): Promise<JobAnalysisFormState> {
  const parsed = jobAnalysisFormSchema.safeParse({
    rawJobText: formData.get("rawJobText") ?? "",
    companyName: formData.get("companyName") ?? "",
    sourceUrl: formData.get("sourceUrl") ?? "",
    candidateContext: formData.get("candidateContext") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.issues.map((i) => ({
        field: (i.path[0] as JobAnalysisFormError["field"]) ?? "form",
        message: i.message,
      })),
    };
  }

  const input = parsed.data;
  const user = await ensureDemoUser();

  // Persist candidate context onto the user so it's available for Stage 2.
  if (input.candidateContext && input.candidateContext.length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { currentRole: input.candidateContext.slice(0, 500) },
    });
  }

  // Persist the raw listing first — with a placeholder title/company we'll
  // overwrite once the analyzer runs. This keeps the row alive even if the
  // AI call fails.
  const placeholderTitle = "Pending analysis";
  const placeholderCompany = input.companyName?.trim() || "Unknown";

  const jobListing = await prisma.jobListing.create({
    data: {
      userId: user.id,
      rawText: input.rawJobText,
      sourceUrl: input.sourceUrl && input.sourceUrl.length > 0 ? input.sourceUrl : null,
      companyName: placeholderCompany,
      jobTitle: placeholderTitle,
    },
  });

  let analysis;
  try {
    analysis = await analyzeJob({
      rawJobText: input.rawJobText,
      companyName: input.companyName || undefined,
      sourceUrl: input.sourceUrl || undefined,
      candidateContext: input.candidateContext || undefined,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Analyzer failed unexpectedly.";
    return {
      status: "error",
      errors: [{ field: "form", message: `AI analysis failed: ${message}` }],
    };
  }

  const cm = analysis.competencyMap;

  await prisma.$transaction([
    prisma.jobListing.update({
      where: { id: jobListing.id },
      data: {
        jobTitle: cm.jobTitle,
        companyName: input.companyName?.trim() || cm.companyName,
      },
    }),
    prisma.competencyMap.create({
      data: {
        jobListingId: jobListing.id,
        requiredQualifications: cm.requiredQualifications,
        preferredQualifications: cm.preferredQualifications,
        tools: cm.tools,
        responsibilities: cm.responsibilities,
        softSkills: cm.softSkills,
        rawAnalysis: analysis.rawAnalysis as Prisma.InputJsonValue,
      },
    }),
  ]);

  return { status: "success", redirectTo: `/jobs/${jobListing.id}/profile` };
}
