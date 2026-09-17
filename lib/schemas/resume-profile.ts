import { z } from "zod";

const nonEmpty = z.string().trim().min(1);

export const workHistoryItemSchema = z.object({
  role: nonEmpty.describe("Job title held."),
  company: z.string().trim().describe("Employer name, or empty string if unclear."),
  dates: z
    .string()
    .trim()
    .describe(
      "Free-form date range as it appeared on the resume, e.g. 'Jan 2022 – Present'.",
    ),
  summary: z
    .string()
    .trim()
    .describe("One-sentence summary of what the person did in this role."),
  responsibilities: z
    .array(nonEmpty)
    .describe("Concrete responsibilities pulled from bullet points."),
});

export type WorkHistoryItem = z.infer<typeof workHistoryItemSchema>;

export const resumeProfileSchema = z.object({
  workHistory: z
    .array(workHistoryItemSchema)
    .describe("Chronological work history, most recent first."),
  impliedSkills: z
    .array(nonEmpty)
    .describe(
      "Skills inferred from role responsibilities, even if not listed on the resume.",
    ),
  toolsMentioned: z
    .array(nonEmpty)
    .describe("Concrete tools, platforms, languages, frameworks named anywhere."),
  explicitSkills: z
    .array(nonEmpty)
    .describe(
      "Skills explicitly listed by the candidate (a 'Skills' section, LinkedIn-style list, etc.).",
    ),
  certifications: z
    .array(nonEmpty)
    .describe("Certifications, licenses, or credentials the person listed."),
});

export type ResumeProfileExtraction = z.infer<typeof resumeProfileSchema>;

export const resumeProfileJsonSchema = {
  type: "object",
  properties: {
    workHistory: {
      type: "array",
      description: "Chronological work history, most recent first.",
      items: {
        type: "object",
        properties: {
          role: { type: "string" },
          company: { type: "string" },
          dates: {
            type: "string",
            description:
              "Free-form date range as it appeared on the resume, e.g. 'Jan 2022 - Present'.",
          },
          summary: {
            type: "string",
            description: "One-sentence summary of what the person did.",
          },
          responsibilities: {
            type: "array",
            items: { type: "string" },
            description: "Concrete responsibilities pulled from bullets.",
          },
        },
        required: ["role", "company", "dates", "summary", "responsibilities"],
        additionalProperties: false,
      },
    },
    impliedSkills: {
      type: "array",
      items: { type: "string" },
      description:
        "Skills you infer from role responsibilities even if not listed on the resume.",
    },
    toolsMentioned: {
      type: "array",
      items: { type: "string" },
      description: "Concrete tools, platforms, languages, frameworks named anywhere.",
    },
    explicitSkills: {
      type: "array",
      items: { type: "string" },
      description: "Skills explicitly listed by the candidate.",
    },
    certifications: {
      type: "array",
      items: { type: "string" },
      description: "Certifications, licenses, or credentials.",
    },
  },
  required: [
    "workHistory",
    "impliedSkills",
    "toolsMentioned",
    "explicitSkills",
    "certifications",
  ],
  additionalProperties: false,
} as const;
