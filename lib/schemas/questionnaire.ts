import { z } from "zod";

// Every question is generated per user. The five style kinds are still
// deliberately covered (learning style, tool ramp-up, ambiguity, pace/format,
// pressure) but phrased for this person and this job.
export const QUESTION_KINDS = [
  "LEARNING_STYLE",
  "WORK_STYLE",
  "VERIFY_CLAIMED",
  "PROBE_JOB_REQUIREMENT",
] as const;

export const ANSWER_FORMATS = ["SINGLE_SELECT", "MULTI_SELECT"] as const;

export const TOTAL_QUESTIONS = 15;
export const MIN_MULTI_SELECT = 5;

export const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(QUESTION_KINDS),
  format: z.enum(ANSWER_FORMATS),
  order: z.number().int().nonnegative(),
  text: z.string().min(3),
  targetSkill: z.string().optional(),
  options: z.array(optionSchema).min(2).max(8),
  allowFreeText: z.boolean(),
});

export type Question = z.infer<typeof questionSchema>;

// Payload the Claude call must return. Options come back as labels; the
// server assigns stable values.
export const generatedQuestionSchema = z.object({
  kind: z.enum(QUESTION_KINDS),
  format: z.enum(ANSWER_FORMATS),
  targetSkill: z.string().min(1).optional(),
  text: z.string().min(3),
  options: z.array(z.string().trim().min(1)).min(2).max(8),
});

export const generatedQuestionnaireSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(12).max(18),
});

export type GeneratedQuestionnaire = z.infer<typeof generatedQuestionnaireSchema>;

export const generatedQuestionnaireJsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: TOTAL_QUESTIONS,
      maxItems: TOTAL_QUESTIONS,
      description:
        "Exactly 15 questions: 5 style questions (kinds LEARNING_STYLE / WORK_STYLE) and 10 skill probes (kinds VERIFY_CLAIMED / PROBE_JOB_REQUIREMENT). At least 5 must be MULTI_SELECT.",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...QUESTION_KINDS],
            description:
              "LEARNING_STYLE: how this person learns best. WORK_STYLE: how they handle ambiguity, pace, pressure, unfamiliar tools. VERIFY_CLAIMED: a skill their profile claims. PROBE_JOB_REQUIREMENT: a skill the job needs that the profile doesn't clearly evidence.",
          },
          format: {
            type: "string",
            enum: [...ANSWER_FORMATS],
            description:
              "SINGLE_SELECT for scales and either/or choices. MULTI_SELECT when several options can genuinely be true at once (e.g. 'which of these have you actually done').",
          },
          targetSkill: {
            type: "string",
            description:
              "Required for VERIFY_CLAIMED and PROBE_JOB_REQUIREMENT: the specific skill/tool this probes, 2-6 words. Omit for style questions.",
          },
          text: {
            type: "string",
            description:
              "The question, second person, under 30 words. Concrete and scenario-based where possible.",
          },
          options: {
            type: "array",
            minItems: 3,
            maxItems: 7,
            items: { type: "string" },
            description:
              "Answer options as short labels. For scales, anchor each label to observable behavior, ordered low to high. For MULTI_SELECT, each option is a distinct thing the person may or may not have done. Do not include an 'other' option — the UI adds a free-text escape hatch.",
          },
        },
        required: ["kind", "format", "text", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;
