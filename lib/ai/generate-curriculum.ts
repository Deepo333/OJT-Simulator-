import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  curriculumSchema,
  curriculumJsonSchema,
  type CurriculumPayload,
} from "@/lib/schemas/curriculum";
import type { SkillBreakdownItem } from "@/lib/schemas/skill-assessment";

const SYSTEM_PROMPT = `You are a curriculum designer for a career-transition platform.

You will be given:
  (1) The target job (title, company, required qualifications, tools, responsibilities).
  (2) A structured skill assessment with per-skill alignment flags (ALIGNED, NEEDS_REINFORCEMENT, RESUME_STRONGER_THAN_CONFIDENCE, CONFIDENCE_STRONGER_THAN_RESUME, TRUE_GAP, NO_SIGNAL) and confidence levels (UNKNOWN → EXPERT), plus two curated lists: reinforcementFlags (needs reinforcement despite claimed experience) and trueGaps.

Design a personalized on-the-job-training curriculum: an ordered list of modules, each targeting one or more specific skills. Foundational modules first, core modules next, advanced modules last.

Rules:
1. Prioritize TRUE_GAP skills that are required qualifications. Those come first (FOUNDATIONAL or early CORE).
2. Include reinforcement modules for RESUME_STRONGER_THAN_CONFIDENCE and NEEDS_REINFORCEMENT skills. Frame them as reinforcement, not "learn from scratch".
3. Don't include modules for ALIGNED, EXPERT, or CONFIDENCE_STRONGER_THAN_RESUME skills — they don't need teaching.
4. Preferred qualifications are ADVANCED phase — only if there's a genuine gap and the candidate has bandwidth after the essentials.
5. Every module's rationale must reference a specific gap or reinforcement need (e.g. "You marked SQL as 'Somewhat familiar' but the job requires production query work — this closes that gap.").
6. 4-12 modules total. Enough to be useful, not so many the roadmap feels overwhelming.
7. Give each module an integer 'order' starting at 0 and incrementing by 1.
8. Return by calling the return_curriculum tool.
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

  const userMessage = buildUserMessage(input);
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
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
    messages.push({
      role: "user",
      content: "Call the return_curriculum tool now.",
    });
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
  parts.push("Reinforcement flags (claimed but low confidence):");
  parts.push(bullets(i.reinforcementFlags, "none"));
  parts.push("");
  parts.push("True gaps:");
  parts.push(bullets(i.trueGaps, "none"));
  parts.push("");
  parts.push("Full skills breakdown (json):");
  parts.push(JSON.stringify(i.skillsBreakdown, null, 2));
  parts.push("");
  parts.push(
    "Design the curriculum per the rules and call return_curriculum.",
  );
  return parts.join("\n");
}
