"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { extractResumeText } from "@/lib/resume/extract-text";
import { extractResumeProfile } from "@/lib/ai/extract-resume-profile";
import {
  resumeProfileFormSchema,
  type ResumeProfileFormError,
} from "./types";

const DEMO_EMAIL = "demo@career-forge.local";

// Returns the destination on success rather than calling redirect() — see
// the note in modules/job-analysis/actions.ts.
export type ResumeProfileFormState =
  | { status: "idle" }
  | { status: "success"; redirectTo: string }
  | { status: "error"; errors: ResumeProfileFormError[] };

async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, name: "Demo User", currentSkills: [] },
  });
}

export async function buildResumeProfile(
  _prev: ResumeProfileFormState,
  formData: FormData,
): Promise<ResumeProfileFormState> {
  const jobListingId = String(formData.get("jobListingId") ?? "");
  if (!jobListingId) {
    return {
      status: "error",
      errors: [{ field: "form", message: "Missing job listing id." }],
    };
  }

  const parsed = resumeProfileFormSchema.safeParse({
    pastedResume: formData.get("pastedResume") ?? "",
    supplementalWorkHistory: formData.get("supplementalWorkHistory") ?? "",
    supplementalSkills: formData.get("supplementalSkills") ?? "",
    supplementalCertifications: formData.get("supplementalCertifications") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      errors: parsed.error.issues.map((i) => ({
        field: (i.path[0] as ResumeProfileFormError["field"]) ?? "form",
        message: i.message,
      })),
    };
  }

  const form = parsed.data;
  const rawFile = formData.get("resumeFile");
  const file =
    rawFile && typeof rawFile !== "string" && rawFile.size > 0
      ? (rawFile as File)
      : null;
  const paste =
    form.pastedResume && form.pastedResume.length >= 40 ? form.pastedResume : "";

  if (!file && !paste) {
    return {
      status: "error",
      errors: [
        {
          field: "resumeFile",
          message:
            "Upload a PDF or DOCX resume, or paste the full text (at least 40 characters).",
        },
      ],
    };
  }

  const job = await prisma.jobListing.findUnique({ where: { id: jobListingId } });
  if (!job) {
    return {
      status: "error",
      errors: [{ field: "form", message: "Job listing not found." }],
    };
  }

  const user = await ensureDemoUser();

  let rawResumeText: string;
  try {
    if (file) {
      const extracted = await extractResumeText(file);
      rawResumeText = extracted.text;
    } else {
      rawResumeText = paste;
    }
  } catch (err) {
    return {
      status: "error",
      errors: [
        {
          field: "resumeFile",
          message: err instanceof Error ? err.message : "Failed to read resume file.",
        },
      ],
    };
  }

  let extraction;
  try {
    extraction = await extractResumeProfile({
      rawResumeText,
      supplementalWorkHistory: form.supplementalWorkHistory || undefined,
      supplementalSkills: form.supplementalSkills || undefined,
      supplementalCertifications: form.supplementalCertifications || undefined,
    });
  } catch (err) {
    return {
      status: "error",
      errors: [
        {
          field: "form",
          message: `Resume extraction failed: ${err instanceof Error ? err.message : "unknown"}`,
        },
      ],
    };
  }

  const p = extraction.profile;

  await prisma.resumeProfile.create({
    data: {
      userId: user.id,
      jobListingId,
      rawResumeText,
      supplementalWorkHistory: form.supplementalWorkHistory || null,
      supplementalSkills: form.supplementalSkills || null,
      supplementalCertifications: form.supplementalCertifications || null,
      workHistory: p.workHistory as unknown as Prisma.InputJsonValue,
      impliedSkills: p.impliedSkills,
      toolsMentioned: p.toolsMentioned,
      explicitSkills: p.explicitSkills,
      certifications: p.certifications,
      rawExtraction: extraction.rawExtraction as Prisma.InputJsonValue,
    },
  });

  return { status: "success", redirectTo: `/jobs/${jobListingId}/questionnaire` };
}
