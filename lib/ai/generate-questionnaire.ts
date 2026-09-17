import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  dynamicQuestionsPayloadSchema,
  dynamicQuestionsJsonSchema,
  type DynamicQuestionsPayload,
} from "@/lib/schemas/questionnaire";

const SYSTEM_PROMPT = `You are the questionnaire generator for a career-transition platform.

You will be given (a) a candidate's unified profile — work history, tools, explicit skills, implied skills, certifications — and (b) the target job's required and preferred qualifications. Your job is to design EXACTLY 10 questions that will help us calibrate the candidate's real confidence, on a named comfort scale, so we can plan their curriculum.

Rules:
1. Every question must be answerable on a 5-point comfort scale (Not familiar → Highly skilled). Do not write open-ended prompts. Do not include the scale in the question text — the UI adds it.
2. Aim for roughly half DYNAMIC_VERIFY_CLAIMED (probing skills the profile claims) and half DYNAMIC_PROBE_JOB_REQUIREMENT (probing skills the job needs but the profile doesn't clearly evidence). Adjust the split if one side is empty.
3. Prefer specific over generic. Instead of "Are you comfortable with data?", ask "How comfortable are you writing analytical SQL queries against a production dataset?".
4. Never ask the same thing twice. Cover a range of skills, not five variations of one.
5. Keep each question under 25 words. Second person. Neutral, non-judgmental tone.
6. targetSkill must be a short label (2-6 words) — this becomes the key we join on later.
7. Return your answer by calling the return_dynamic_questions tool.
`;

export interface GenerateDynamicQuestionsInput {
  jobTitle: string;
  companyName: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  tools: string[];
  softSkills: string[];
  profileWorkHistorySummary: string;
  profileImpliedSkills: string[];
  profileExplicitSkills: string[];
  profileToolsMentioned: string[];
  profileCertifications: string[];
}

export interface GenerateDynamicQuestionsResult {
  payload: DynamicQuestionsPayload;
  raw: unknown;
}

const TOOL_NAME = "return_dynamic_questions";

export async function generateDynamicQuestions(
  input: GenerateDynamicQuestionsInput,
): Promise<GenerateDynamicQuestionsResult> {
  const client = getAnthropicClient();

  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description:
        "Return exactly 10 dynamic questions calibrated to the profile and job.",
      input_schema:
        dynamicQuestionsJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
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
      max_tokens: 2048,
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
      const parsed = dynamicQuestionsPayloadSchema.safeParse(toolUse.input);
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
              ". Call return_dynamic_questions again with exactly 10 questions.",
          },
        ],
      });
      continue;
    }

    lastError = new Error("Questionnaire generator emitted no tool_use.");
    messages.push({
      role: "assistant",
      content:
        response.content
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("\n") || "(no text)",
    });
    messages.push({
      role: "user",
      content:
        "Call the return_dynamic_questions tool with exactly 10 questions. Do so now.",
    });
  }

  throw lastError ?? new Error("Questionnaire generator failed.");
}

function bullets(items: string[], empty: string): string {
  if (items.length === 0) return `(${empty})`;
  return items.map((s) => `  - ${s}`).join("\n");
}

function buildUserMessage(i: GenerateDynamicQuestionsInput): string {
  return [
    `Target job: ${i.jobTitle} at ${i.companyName}`,
    "",
    "Required qualifications:",
    bullets(i.requiredQualifications, "none listed"),
    "",
    "Preferred qualifications:",
    bullets(i.preferredQualifications, "none listed"),
    "",
    "Tools/software named in the listing:",
    bullets(i.tools, "none named"),
    "",
    "Soft skills expected:",
    bullets(i.softSkills, "none named"),
    "",
    "--- Candidate profile ---",
    "Work history summary:",
    i.profileWorkHistorySummary || "(no work history parsed)",
    "",
    "Explicit skills listed by candidate:",
    bullets(i.profileExplicitSkills, "none"),
    "",
    "Implied skills (inferred from responsibilities):",
    bullets(i.profileImpliedSkills, "none"),
    "",
    "Tools mentioned in the profile:",
    bullets(i.profileToolsMentioned, "none"),
    "",
    "Certifications:",
    bullets(i.profileCertifications, "none"),
    "",
    "Generate exactly 10 dynamic questions per the rules and call return_dynamic_questions.",
  ].join("\n");
}
