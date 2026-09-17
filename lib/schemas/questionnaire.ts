import { z } from "zod";

export const QUESTION_KINDS = [
  "STANDARDIZED",
  "DYNAMIC_VERIFY_CLAIMED",
  "DYNAMIC_PROBE_JOB_REQUIREMENT",
] as const;

// Named comfort scale used for skill-verification questions.
export const COMFORT_SCALE = [
  { value: "NOT_FAMILIAR", label: "Not familiar" },
  { value: "SOMEWHAT_FAMILIAR", label: "Somewhat familiar" },
  { value: "COMFORTABLE", label: "Comfortable" },
  { value: "VERY_COMFORTABLE", label: "Very comfortable" },
  { value: "HIGHLY_SKILLED", label: "Highly skilled" },
] as const;

export const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(QUESTION_KINDS),
  order: z.number().int().nonnegative(),
  text: z.string().min(3),
  targetSkill: z.string().optional(),
  options: z.array(optionSchema).min(2),
  allowFreeText: z.boolean(),
});

export type Question = z.infer<typeof questionSchema>;

export const questionnaireSchema = z.array(questionSchema);

// Payload the Claude call must return — dynamic questions only.
export const dynamicQuestionsPayloadSchema = z.object({
  questions: z
    .array(
      z.object({
        kind: z.enum(["DYNAMIC_VERIFY_CLAIMED", "DYNAMIC_PROBE_JOB_REQUIREMENT"]),
        targetSkill: z.string().min(1),
        text: z.string().min(3),
      }),
    )
    .min(6) // Accept some slack; we'll pad/truncate to exactly 10.
    .max(14),
});

export type DynamicQuestionsPayload = z.infer<typeof dynamicQuestionsPayloadSchema>;

export const dynamicQuestionsJsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      minItems: 10,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["DYNAMIC_VERIFY_CLAIMED", "DYNAMIC_PROBE_JOB_REQUIREMENT"],
            description:
              "DYNAMIC_VERIFY_CLAIMED for a skill claimed in the profile; DYNAMIC_PROBE_JOB_REQUIREMENT for a job requirement not clearly evidenced in the profile.",
          },
          targetSkill: {
            type: "string",
            description:
              "The specific skill/tool/capability this question tests. Keep it short (2-6 words).",
          },
          text: {
            type: "string",
            description:
              "The question, phrased in second person and neutral tone. Should be about the target skill and answerable on a comfort scale.",
          },
        },
        required: ["kind", "targetSkill", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;
