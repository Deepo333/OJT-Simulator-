import { z } from "zod";

// Canonical shape the analyzer must emit. This same schema is used to:
//   1. Validate the AI's JSON output at runtime.
//   2. Type the CompetencyMap object we hand to the UI.
//   3. Encode into the CompetencyMap DB row (list fields JSON-serialized).
//
// Keep this schema strict — extra fields from the model are dropped, and any
// missing required field triggers a retry in analyze-job.ts.

const nonEmptyString = z.string().trim().min(1);

export const competencyMapSchema = z.object({
  jobTitle: nonEmptyString.describe(
    "The role's title, cleaned up (e.g. 'Senior Product Designer').",
  ),
  companyName: nonEmptyString.describe(
    "The hiring company name, as best inferred from the listing.",
  ),
  requiredQualifications: z
    .array(nonEmptyString)
    .describe(
      "Must-have qualifications — explicitly labeled required, or written as unambiguous prerequisites.",
    ),
  preferredQualifications: z
    .array(nonEmptyString)
    .describe(
      "Nice-to-haves, bonus qualifications, 'preferred', 'a plus', etc.",
    ),
  tools: z
    .array(nonEmptyString)
    .describe(
      "Concrete tools, software, platforms, languages, and frameworks named in the listing.",
    ),
  responsibilities: z
    .array(nonEmptyString)
    .describe(
      "Concrete day-to-day responsibilities. Skip marketing fluff and mission statements.",
    ),
  softSkills: z
    .array(nonEmptyString)
    .describe(
      "Soft-skill expectations (communication, collaboration, leadership traits, etc.).",
    ),
});

export type CompetencyMap = z.infer<typeof competencyMapSchema>;

// JSON Schema representation for Anthropic tool-use input_schema.
// Hand-written (not zod-to-json-schema) to keep dependencies lean and to give
// the model precise natural-language field descriptions.
export const competencyMapJsonSchema = {
  type: "object",
  properties: {
    jobTitle: {
      type: "string",
      description: "The role's title, cleaned up (e.g. 'Senior Product Designer').",
    },
    companyName: {
      type: "string",
      description:
        "The hiring company name. Infer from the listing header or body. If truly not stated, use 'Unknown'.",
    },
    requiredQualifications: {
      type: "array",
      items: { type: "string" },
      description:
        "Must-have qualifications — items the listing marks required, or writes as unambiguous prerequisites (e.g. 'Bachelor's degree in X', '3+ years of Y').",
    },
    preferredQualifications: {
      type: "array",
      items: { type: "string" },
      description:
        "Nice-to-haves, bonus qualifications, 'preferred', 'a plus', 'ideal candidate' style items.",
    },
    tools: {
      type: "array",
      items: { type: "string" },
      description:
        "Concrete tools, software, platforms, languages, and frameworks named in the listing (e.g. 'Figma', 'PostgreSQL', 'Salesforce'). Do not include generic categories like 'CRM' unless no specific tool is named.",
    },
    responsibilities: {
      type: "array",
      items: { type: "string" },
      description:
        "Concrete day-to-day responsibilities. Skip marketing fluff, mission statements, and 'about us' text.",
    },
    softSkills: {
      type: "array",
      items: { type: "string" },
      description:
        "Soft-skill expectations (communication, collaboration, leadership traits, etc.).",
    },
  },
  required: [
    "jobTitle",
    "companyName",
    "requiredQualifications",
    "preferredQualifications",
    "tools",
    "responsibilities",
    "softSkills",
  ],
  additionalProperties: false,
} as const;
