import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  curriculumSchema,
  curriculumJsonSchema,
  type CurriculumPayload,
} from "@/lib/schemas/curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

const SYSTEM_PROMPT = `You design personalized on-the-job-training roadmaps for a career-transition platform. Write like a mentor who believes the person can get there and respects them enough to be precise about what it takes.

You will be given:
  (1) The target job (title, company, required/preferred qualifications, tools, responsibilities).
  (2) A structured skill assessment: per-skill alignment flags (ALIGNED, NEEDS_REINFORCEMENT, RESUME_STRONGER_THAN_CONFIDENCE, CONFIDENCE_STRONGER_THAN_RESUME, TRUE_GAP, NO_SIGNAL), confidence levels, a summary, and two lists: reinforcementFlags (skills to sharpen despite experience on paper) and trueGaps (skills to build).

THE PLAN SCALES TO THE GOAL
Size the roadmap to the distance between where this person is today and being field-ready for THIS role — no bigger, no smaller.
- Close to ready (few or no true gaps, mostly sharpening): 3-5 focused modules, modest hours. Say so in the overview; don't pad.
- A focused push (a handful of real gaps plus some sharpening): 5-8 modules.
- A substantial, staged build (many required skills to build from scratch): 8-12 modules, sequenced so early wins come first.
State in the overview how big the lift is and why the plan is sized that way. A short plan for someone nearly ready is a feature, not a shortfall.

WHAT GOES IN
1. TRUE_GAP skills that are required qualifications come first (FOUNDATIONAL or early CORE).
2. Reinforcement modules for RESUME_STRONGER_THAN_CONFIDENCE and NEEDS_REINFORCEMENT skills, framed as sharpening what they already have — never "learn from scratch".
3. Nothing for ALIGNED, EXPERT, or CONFIDENCE_STRONGER_THAN_RESUME skills; instead, lean on those strengths in other modules' rationales ("you're already solid at X, so this goes straight to Y").
4. Preferred qualifications only as ADVANCED, only where there's a genuine gap, and only if the essentials leave room.
5. Use the assessment's style signals to shape modules: a hands-on learner gets project-shaped modules; someone with short daily windows gets modules that break into small steps.

TONE
- Optimistic and honest. Gaps are "next to build"; reinforcement is "worth sharpening". Never "lacks", "weak", "deficient", "unfortunately", "only".
- Every rationale names the specific evidence it responds to, in second person, and connects it to the job: "You marked SQL as 'followed a tutorial once' and this role runs production queries weekly — this module gets you writing them on real data."
- Descriptions: 2-4 sentences on what the module covers and what they'll be able to do after.

MECHANICS
- 3-12 modules; integer 'order' from 0, incrementing by 1; phase FOUNDATIONAL → CORE → ADVANCED in order; estimatedHours realistic for self-directed work.
- Return by calling the return_curriculum tool.
`;

export interface GenerateCurriculumInput {
  jobTitle: string;
  companyName: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  tools: string[];
  responsibilities: string[];
  assessmentSummary: string;
  skillsBreakdown: SkillBreakdownItem[];
  reinforcementFlags: string[];
  trueGaps: string[];
}

export interface GenerateCurriculumResult {
  payload: CurriculumPayload;
  raw: unknown;
}

const TOOL_NAME = "return_curriculum";

export async function generateCurriculum(
  input: GenerateCurriculumInput,
): Promise<GenerateCurriculumResult> {
  const client = getAnthropicClient();
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description: "Return the personalized curriculum roadmap.",
      input_schema:
        curriculumJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
    },
  ];

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: buildUserMessage(input) },
  ];

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages,
    });
    const toolUse = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === TOOL_NAME,
    );
    if (toolUse) {
      const parsed = curriculumSchema.safeParse(toolUse.input);
      if (parsed.success) {
        return { payload: parsed.data, raw: toolUse.input };
      }
      lastError = new Error(parsed.error.message);
      messages.push({ role: "assistant", content: [toolUse] });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content:
              "Schema mismatch: " +
              parsed.error.issues
                .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
                .join("; ") +
              ". Call return_curriculum again.",
          },
        ],
      });
      continue;
    }
    lastError = new Error("Curriculum generator emitted no tool_use.");
    messages.push({
      role: "assistant",
      content:
        response.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n") || "(no text)",
    });
    messages.push({ role: "user", content: "Call the return_curriculum tool now." });
  }
  throw lastError ?? new Error("Curriculum generator failed.");
}

function bullets(items: string[], empty: string): string {
  if (items.length === 0) return `(${empty})`;
  return items.map((s) => `  - ${s}`).join("\n");
}

function buildUserMessage(i: GenerateCurriculumInput): string {
  const parts: string[] = [];
  parts.push(`Target job: ${i.jobTitle} at ${i.companyName}`);
  parts.push("");
  parts.push("Required qualifications:");
  parts.push(bullets(i.requiredQualifications, "none"));
  parts.push("");
  parts.push("Preferred qualifications:");
  parts.push(bullets(i.preferredQualifications, "none"));
  parts.push("");
  parts.push("Tools:");
  parts.push(bullets(i.tools, "none"));
  parts.push("");
  parts.push("Responsibilities:");
  parts.push(bullets(i.responsibilities, "none"));
  parts.push("");
  parts.push("--- Assessment summary ---");
  parts.push(i.assessmentSummary || "(no summary)");
  parts.push("");
  parts.push("Skills to sharpen (claimed on paper, lower hands-on confidence):");
  parts.push(bullets(i.reinforcementFlags, "none"));
  parts.push("");
  parts.push("Skills to build (required, no evidence yet):");
  parts.push(bullets(i.trueGaps, "none"));
  parts.push("");
  parts.push("Full skills breakdown (json):");
  parts.push(JSON.stringify(i.skillsBreakdown, null, 2));
  parts.push("");
  parts.push("Design the roadmap per the rules — sized to this person's actual distance from field-ready — and call return_curriculum.");
  return parts.join("\n");
}
