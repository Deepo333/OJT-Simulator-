import { z } from "zod";

// These enums live in code (Zod + the JSON schema handed to Claude). The
// matching Prisma enums are documentation only — skillsBreakdown is a Json
// column — so adding a value here needs no database migration.
export const ALIGNMENT_FLAGS = [
  "ALIGNED",
  "RESUME_STRONGER_THAN_CONFIDENCE",
  "CONFIDENCE_STRONGER_THAN_RESUME",
  "EMERGING",
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

export type AlignmentFlag = (typeof ALIGNMENT_FLAGS)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

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
      "Skills the plan must build from (near) scratch: TRUE_GAP and EMERGING.",
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
          alignment: {
            type: "string",
            enum: [...ALIGNMENT_FLAGS],
            description:
              "Exactly one of the listed values. ALIGNED / RESUME_STRONGER_THAN_CONFIDENCE / CONFIDENCE_STRONGER_THAN_RESUME / EMERGING (job needs it, no direct experience yet, but transferable experience or early signal to build on) / TRUE_GAP (job needs it, no evidence and no transferable signal) / NEEDS_REINFORCEMENT / NO_SIGNAL.",
          },
          confidence: {
            type: "string",
            enum: [...CONFIDENCE_LEVELS],
            description: "Exactly one of the listed values.",
          },
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
        "Names of skills where the profile claimed proficiency but the questionnaire showed low confidence — 'worth sharpening despite the experience on paper'.",
    },
    trueGaps: {
      type: "array",
      items: { type: "string" },
      description:
        "Names of every skill the plan must build: all TRUE_GAP skills and all EMERGING skills.",
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

// ---------------------------------------------------------------------------
// Resilience: map unrecognized enum values to the closest valid one instead
// of failing the whole assessment. Returns the coerced payload plus a list of
// substitutions for logging.
// ---------------------------------------------------------------------------

export interface Coercion {
  path: string;
  from: string;
  to: string;
}

function canon(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

const CONFIDENCE_SYNONYMS: Record<string, ConfidenceLevel> = {
  NONE: "TRUE_GAP",
  GAP: "TRUE_GAP",
  MISSING: "TRUE_GAP",
  NOT_STARTED: "TRUE_GAP",
  STARTING_POINT: "TRUE_GAP",
  BEGINNER: "EMERGING",
  NOVICE: "EMERGING",
  BASIC: "EMERGING",
  FOUNDATIONAL: "EMERGING",
  LOW: "EMERGING",
  INTERMEDIATE: "DEVELOPING",
  PARTIAL: "DEVELOPING",
  MEDIUM: "DEVELOPING",
  MODERATE: "DEVELOPING",
  COMPETENT: "PROFICIENT",
  STRONG: "PROFICIENT",
  ADVANCED: "PROFICIENT",
  HIGH: "PROFICIENT",
  SOLID: "PROFICIENT",
  MASTER: "EXPERT",
  MASTERY: "EXPERT",
  N_A: "UNKNOWN",
  NA: "UNKNOWN",
  UNSURE: "UNKNOWN",
  UNCLEAR: "UNKNOWN",
};

const ALIGNMENT_SYNONYMS: Record<string, AlignmentFlag> = {
  MATCH: "ALIGNED",
  MATCHED: "ALIGNED",
  STRONG: "ALIGNED",
  SOLID: "ALIGNED",
  CONSISTENT: "ALIGNED",
  GAP: "TRUE_GAP",
  MISSING: "TRUE_GAP",
  ABSENT: "TRUE_GAP",
  NOT_EVIDENCED: "TRUE_GAP",
  PARTIAL: "NEEDS_REINFORCEMENT",
  DEVELOPING: "NEEDS_REINFORCEMENT",
  REINFORCE: "NEEDS_REINFORCEMENT",
  REINFORCEMENT: "NEEDS_REINFORCEMENT",
  NEEDS_PRACTICE: "NEEDS_REINFORCEMENT",
  NEEDS_WORK: "NEEDS_REINFORCEMENT",
  BEGINNER: "EMERGING",
  NOVICE: "EMERGING",
  TRANSFERABLE: "EMERGING",
  ADJACENT: "EMERGING",
  HIDDEN_STRENGTH: "CONFIDENCE_STRONGER_THAN_RESUME",
  UNDERSOLD: "CONFIDENCE_STRONGER_THAN_RESUME",
  OVERSTATED: "RESUME_STRONGER_THAN_CONFIDENCE",
  OVERCLAIMED: "RESUME_STRONGER_THAN_CONFIDENCE",
  UNKNOWN: "NO_SIGNAL",
  NONE: "NO_SIGNAL",
  NOT_ASSESSED: "NO_SIGNAL",
  N_A: "NO_SIGNAL",
  NA: "NO_SIGNAL",
};

// When alignment is unrecognizable even after synonyms, derive it from the
// (already coerced) confidence level.
const ALIGNMENT_FROM_CONFIDENCE: Record<ConfidenceLevel, AlignmentFlag> = {
  UNKNOWN: "NO_SIGNAL",
  TRUE_GAP: "TRUE_GAP",
  EMERGING: "EMERGING",
  DEVELOPING: "NEEDS_REINFORCEMENT",
  PROFICIENT: "ALIGNED",
  EXPERT: "ALIGNED",
};

function coerceConfidence(value: unknown): { value: ConfidenceLevel; changed: boolean } {
  const c = canon(value);
  if ((CONFIDENCE_LEVELS as readonly string[]).includes(c)) {
    return { value: c as ConfidenceLevel, changed: c !== value };
  }
  const syn = CONFIDENCE_SYNONYMS[c];
  if (syn) return { value: syn, changed: true };
  const partial = CONFIDENCE_LEVELS.find((v) => c.includes(v) || v.includes(c));
  if (partial && c.length >= 3) return { value: partial, changed: true };
  return { value: "UNKNOWN", changed: true };
}

function coerceAlignment(
  value: unknown,
  confidence: ConfidenceLevel,
): { value: AlignmentFlag; changed: boolean } {
  const c = canon(value);
  if ((ALIGNMENT_FLAGS as readonly string[]).includes(c)) {
    return { value: c as AlignmentFlag, changed: c !== value };
  }
  const syn = ALIGNMENT_SYNONYMS[c];
  if (syn) return { value: syn, changed: true };
  const partial = ALIGNMENT_FLAGS.find((v) => c.includes(v) || v.includes(c));
  if (partial && c.length >= 3) return { value: partial, changed: true };
  return { value: ALIGNMENT_FROM_CONFIDENCE[confidence], changed: true };
}

export function coerceAssessmentPayload(raw: unknown): {
  payload: unknown;
  coercions: Coercion[];
} {
  if (!raw || typeof raw !== "object") return { payload: raw, coercions: [] };
  const coercions: Coercion[] = [];
  const obj = { ...(raw as Record<string, unknown>) };
  const items = Array.isArray(obj.skillsBreakdown) ? obj.skillsBreakdown : null;
  if (!items) return { payload: raw, coercions };

  obj.skillsBreakdown = items.map((item, i) => {
    if (!item || typeof item !== "object") return item;
    const it = { ...(item as Record<string, unknown>) };
    const conf = coerceConfidence(it.confidence);
    if (conf.changed) {
      coercions.push({ path: `skillsBreakdown[${i}].confidence`, from: String(it.confidence), to: conf.value });
      it.confidence = conf.value;
    }
    const align = coerceAlignment(it.alignment, conf.value);
    if (align.changed) {
      coercions.push({ path: `skillsBreakdown[${i}].alignment`, from: String(it.alignment), to: align.value });
      it.alignment = align.value;
    }
    return it;
  });

  for (const key of ["reinforcementFlags", "trueGaps"] as const) {
    if (!Array.isArray(obj[key])) {
      coercions.push({ path: key, from: String(obj[key]), to: "[]" });
      obj[key] = [];
    }
  }
  return { payload: obj, coercions };
}
