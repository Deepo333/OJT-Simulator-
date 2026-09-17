import { z } from "zod";
import { ALIGNMENT_FLAGS } from "./skill-assessment";

export const CURRICULUM_PHASES = ["FOUNDATIONAL", "CORE", "ADVANCED"] as const;

export const curriculumModuleSchema = z.object({
  order: z.number().int().nonnegative(),
  title: z.string().min(3),
  description: z
    .string()
    .min(10)
    .describe("2-4 sentences describing what the module covers."),
  rationale: z
    .string()
    .min(10)
    .describe(
      "Why this module is included, tied to a specific gap or reinforcement need.",
    ),
  targetedSkills: z.array(z.string().min(1)).min(1),
  phase: z.enum(CURRICULUM_PHASES),
  estimatedHours: z.number().int().min(1).max(60),
  addressesFlag: z.enum(ALIGNMENT_FLAGS).optional(),
});

export type CurriculumModule = z.infer<typeof curriculumModuleSchema>;

export const curriculumSchema = z.object({
  modules: z.array(curriculumModuleSchema).min(3).max(15),
  overview: z
    .string()
    .min(20)
    .describe("2-3 sentence overview of the curriculum shape."),
});

export type CurriculumPayload = z.infer<typeof curriculumSchema>;

// Resilience: normalize off-list phase / addressesFlag values instead of
// failing the whole curriculum. Unknown phases become CORE; unknown flags
// are dropped (the field is optional).
export function coerceCurriculumPayload(raw: unknown): {
  payload: unknown;
  coercions: string[];
} {
  if (!raw || typeof raw !== "object") return { payload: raw, coercions: [] };
  const coercions: string[] = [];
  const obj = { ...(raw as Record<string, unknown>) };
  if (!Array.isArray(obj.modules)) return { payload: raw, coercions };
  const canon = (v: unknown) => String(v ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  obj.modules = obj.modules.map((m, i) => {
    if (!m || typeof m !== "object") return m;
    const mod = { ...(m as Record<string, unknown>) };
    const phase = canon(mod.phase);
    if (!(CURRICULUM_PHASES as readonly string[]).includes(phase)) {
      const mapped =
        /FOUND|BASIC|INTRO|BEGIN/.test(phase) ? "FOUNDATIONAL"
        : /ADV|STRETCH|EXPERT|OPTIONAL/.test(phase) ? "ADVANCED"
        : "CORE";
      coercions.push(`modules[${i}].phase: ${String(mod.phase)} -> ${mapped}`);
      mod.phase = mapped;
    } else if (phase !== mod.phase) {
      mod.phase = phase;
    }
    if (mod.addressesFlag !== undefined) {
      const flag = canon(mod.addressesFlag);
      if ((ALIGNMENT_FLAGS as readonly string[]).includes(flag)) {
        mod.addressesFlag = flag;
      } else {
        coercions.push(`modules[${i}].addressesFlag: ${String(mod.addressesFlag)} -> (dropped)`);
        delete mod.addressesFlag;
      }
    }
    return mod;
  });
  return { payload: obj, coercions };
}

export const curriculumJsonSchema = {
  type: "object",
  properties: {
    overview: {
      type: "string",
      description:
        "2-4 sentences, second person: how big the lift is to field-ready for this role, why the plan is sized the way it is, and what it's shaped around. Optimistic and honest.",
    },
    modules: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      description:
        "Ordered learning modules, sized to the candidate's distance from field-ready: 3-5 when nearly ready, up to 12 for a substantial staged build. Foundational first, then core, then advanced. Each module ties to specific gaps or sharpening needs.",
      items: {
        type: "object",
        properties: {
          order: {
            type: "integer",
            minimum: 0,
            description: "Position in the roadmap, starting at 0.",
          },
          title: { type: "string" },
          description: {
            type: "string",
            description: "2-4 sentences describing what the module covers.",
          },
          rationale: {
            type: "string",
            description:
              "Why THIS candidate needs this — tie it to a specific gap or reinforcement need from the assessment.",
          },
          targetedSkills: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description:
              "Skill names this module addresses. Use the same labels as the skill assessment.",
          },
          phase: {
            type: "string",
            enum: [...CURRICULUM_PHASES],
            description:
              "FOUNDATIONAL first, then CORE, then ADVANCED. Order the roadmap accordingly.",
          },
          estimatedHours: {
            type: "integer",
            minimum: 1,
            maximum: 60,
            description: "Rough estimated hours of self-directed work.",
          },
          addressesFlag: {
            type: "string",
            enum: [...ALIGNMENT_FLAGS],
            description:
              "Which assessment flag this module primarily addresses. Optional.",
          },
        },
        required: [
          "order",
          "title",
          "description",
          "rationale",
          "targetedSkills",
          "phase",
          "estimatedHours",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["modules", "overview"],
  additionalProperties: false,
} as const;
