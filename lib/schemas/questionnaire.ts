import { z } from "zod";

// Every question is generated per candidate, from the candidate's real
// starting point (résumé + profile). The target job is the destination we
// measure distance to; it must not leak into question wording in a way that
// presumes the candidate is already near it.
export const QUESTION_KINDS = [
  "LEARNING_STYLE",
  "WORK_STYLE",
  "VERIFY_CLAIMED",
  "PROBE_JOB_REQUIREMENT",
] as const;

export const ANSWER_FORMATS = ["SINGLE_SELECT", "MULTI_SELECT"] as const;

export {
  TOTAL_QUESTIONS,
  NONE_OPTION_VALUE,
  NONE_OPTION_LABEL,
} from "./questionnaire-constants";
import { TOTAL_QUESTIONS } from "./questionnaire-constants";

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
  options: z.array(optionSchema).min(2).max(9),
  allowFreeText: z.boolean(),
});

export type Question = z.infer<typeof questionSchema>;

// Payload the Claude call must return. Options come back as labels; the
// server assigns stable values and adds the "None of these" option to
// multi-select questions.
export const generatedQuestionSchema = z.object({
  kind: z.enum(QUESTION_KINDS),
  format: z.enum(ANSWER_FORMATS),
  targetSkill: z.string().min(1).optional(),
  text: z.string().min(3),
  options: z.array(z.string().trim().min(1)).min(2).max(8),
});

export const generatedQuestionnaireSchema = z.object({
  startingPoint: z.string().min(3),
  questions: z.array(generatedQuestionSchema).min(12).max(18),
});

export type GeneratedQuestionnaire = z.infer<typeof generatedQuestionnaireSchema>;

export const generatedQuestionnaireJsonSchema = {
  type: "object",
  properties: {
    startingPoint: {
      type: "string",
      description:
        "One or two sentences, for internal use: your read of the candidate's demonstrated level relative to the target role (e.g. 'Entry-level retail; no exposure to professional design tools or async product work — wide gap'). Write this first and calibrate every question to it.",
    },
    questions: {
      type: "array",
      minItems: TOTAL_QUESTIONS,
      maxItems: TOTAL_QUESTIONS,
      description:
        "Exactly 15 questions: 5 about how the candidate learns and works (kinds LEARNING_STYLE / WORK_STYLE) and 10 skill probes (kinds VERIFY_CLAIMED / PROBE_JOB_REQUIREMENT), all written at the candidate's demonstrated level and in their vocabulary.",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...QUESTION_KINDS],
            description:
              "LEARNING_STYLE: how this person learns. WORK_STYLE: how they handle ambiguity, pressure, pace, unfamiliar situations. VERIFY_CLAIMED: probes something the résumé/profile claims. PROBE_JOB_REQUIREMENT: measures distance to something the destination role needs, asked through experience the candidate actually has.",
          },
          format: {
            type: "string",
            enum: [...ANSWER_FORMATS],
            description:
              "Decide from the shape of the options, never from a quota. MULTI_SELECT when a person could honestly resonate with more than one option (learning styles, things they've done, situations they've been in). SINGLE_SELECT when options are mutually exclusive (a scale, a confidence level, one clear position) — and then write options so exactly one fits.",
          },
          targetSkill: {
            type: "string",
            description:
              "Required for VERIFY_CLAIMED and PROBE_JOB_REQUIREMENT: the underlying skill being measured, 2-6 words, in the destination role's terms (internal label — it does NOT need to appear in the question text). Omit for style questions.",
          },
          text: {
            type: "string",
            description:
              "The question, second person, under 30 words, in vocabulary the candidate has demonstrated. Refer to work they have actually done. Never name a professional tool from the job description as if they have used it.",
          },
          options: {
            type: "array",
            minItems: 3,
            maxItems: 7,
            items: { type: "string" },
            description:
              "Short answer labels in plain language. For SINGLE_SELECT scales: ordered low to high, each anchored to something observable, mutually exclusive. For MULTI_SELECT: distinct, checkable facts or experiences. Do NOT include 'None of these', 'Other', or 'Not applicable' — the interface adds 'None of these' to every multi-select question.",
          },
        },
        required: ["kind", "format", "text", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["startingPoint", "questions"],
  additionalProperties: false,
} as const;
