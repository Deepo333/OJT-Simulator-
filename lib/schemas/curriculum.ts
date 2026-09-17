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

export const curriculumJsonSchema = {
  type: "object",
  properties: {
    overview: {
      type: "string",
      description:
        "2-3 sentence overview of the curriculum: what it's shaped around and why.",
    },
    modules: {
      type: "array",
      minItems: 4,
      maxItems: 12,
      description:
        "Ordered learning modules. Foundational first, then core, then advanced. Each module ties to specific gaps or reinforcement needs.",
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
