import { z } from "zod";

export const ALIGNMENT_FLAGS = [
  "ALIGNED",
  "RESUME_STRONGER_THAN_CONFIDENCE",
  "CONFIDENCE_STRONGER_THAN_RESUME",
  "TRUE_GAP",
  "NEEDS_REINFORCEMENT",
  "NO_SIGNAL",
] as const;

export const CONFIDENCE_LEVELS = [
  "UNKNOWN",
  "TRUE_GAP",
  "EMERGING",
  "DEVELOPING",
  "PROFICIENT",
  "EXPERT",
] as const;

export const skillBreakdownItemSchema = z.object({
  skill: z.string().min(1),
  resumeEvidence: z
    .string()
    .describe(
      "What the resume/profile implies about this skill. Empty string if none.",
    ),
  questionnaireSignal: z
    .string()
    .describe(
      "What the questionnaire answers say about this skill. Empty string if not asked.",
    ),
  alignment: z.enum(ALIGNMENT_FLAGS),
  confidence: z.enum(CONFIDENCE_LEVELS),
  rationale: z
    .string()
    .min(3)
    .describe("One-sentence reason for the alignment + confidence call."),
});

export type SkillBreakdownItem = z.infer<typeof skillBreakdownItemSchema>;

export const skillAssessmentSchema = z.object({
  skillsBreakdown: z.array(skillBreakdownItemSchema).min(1),
  reinforcementFlags: z
    .array(z.string().min(1))
    .describe(
      "Skills where the profile claimed proficiency but the questionnaire showed low confidence.",
    ),
  trueGaps: z
    .array(z.string().min(1))
    .describe(
      "Skills required by the job with no evidence and low/no questionnaire confidence.",
    ),
  summary: z
    .string()
    .min(10)
    .describe(
      "3-5 sentence plain-English summary of where the candidate is vs. the job.",
    ),
});

export type SkillAssessmentPayload = z.infer<typeof skillAssessmentSchema>;

export const skillAssessmentJsonSchema = {
  type: "object",
  properties: {
    skillsBreakdown: {
      type: "array",
      description:
        "One entry per skill considered — cover every required qualification, every job tool, and every claimed skill probed by the questionnaire.",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          resumeEvidence: {
            type: "string",
            description:
              "What the resume/profile implies about this skill. Empty string if none.",
          },
          questionnaireSignal: {
            type: "string",
            description:
              "What the questionnaire answers say about this skill. Empty string if not asked.",
          },
          alignment: { type: "string", enum: [...ALIGNMENT_FLAGS] },
          confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
          rationale: { type: "string" },
        },
        required: [
          "skill",
          "resumeEvidence",
          "questionnaireSignal",
          "alignment",
          "confidence",
          "rationale",
        ],
        additionalProperties: false,
      },
    },
    reinforcementFlags: {
      type: "array",
      items: { type: "string" },
      description:
        "Names of skills where the profile claimed proficiency but the questionnaire showed low confidence — 'needs reinforcement despite claimed experience'.",
    },
    trueGaps: {
      type: "array",
      items: { type: "string" },
      description:
        "Names of skills required by the job with no profile evidence and low/no questionnaire confidence — 'true gap'.",
    },
    summary: {
      type: "string",
      description:
        "3-5 sentence plain-English summary of where the candidate stands vs. the job.",
    },
  },
  required: ["skillsBreakdown", "reinforcementFlags", "trueGaps", "summary"],
  additionalProperties: false,
} as const;
