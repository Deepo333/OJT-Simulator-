import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  skillAssessmentSchema,
  skillAssessmentJsonSchema,
  type SkillAssessmentPayload,
} from "@/lib/schemas/skill-assessment";

const SYSTEM_PROMPT = `You are a skills assessor for a career-transition platform.

You will be given three inputs:
  (1) The target job's required and preferred qualifications, tools, and soft-skill expectations.
  (2) The candidate's unified profile (work history, implied skills, explicit skills, tools, certifications).
  (3) The candidate's answers to a 15-question calibration questionnaire — 5 standardized questions plus 10 dynamic questions each tied to a specific target skill on a comfort scale.

Your job is to produce a structured comparison, item by item, and label each skill with an alignment flag and confidence level.

Rules for the flags:
- ALIGNED: resume evidence and questionnaire signal agree at a decent level.
- RESUME_STRONGER_THAN_CONFIDENCE: profile claims proficiency but questionnaire shows low confidence. This is the "needs reinforcement despite claimed experience" case — include the skill in reinforcementFlags.
- CONFIDENCE_STRONGER_THAN_RESUME: questionnaire shows solid comfort but the resume shows little/nothing. Not a gap, but worth surfacing.
- TRUE_GAP: job requires this, profile shows nothing, questionnaire shows low/no confidence. Include in trueGaps.
- NEEDS_REINFORCEMENT: partial evidence, mid-tier comfort — a topic where the curriculum should include reinforcement modules but not from-scratch teaching.
- NO_SIGNAL: neither the profile nor the questionnaire touched this. Rare — only use when the job requires something we truly have no data on.

Rules for confidence levels:
- UNKNOWN when NO_SIGNAL. TRUE_GAP when the alignment is TRUE_GAP. Otherwise pick EMERGING / DEVELOPING / PROFICIENT / EXPERT based on the strongest agreeing evidence.

Rules for coverage:
- Include one skillsBreakdown entry for every required qualification, every tool named in the job, every claimed skill probed by a dynamic question, and any preferred qualification where you have real signal. Skip preferred qualifications with no signal.
- Keep rationale to one sentence. Do not repeat resume text verbatim; summarize.

Return your answer by calling the return_skill_assessment tool.
`;

export interface GenerateAssessmentInput {
  jobTitle: string;
  companyName: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  tools: string[];
  softSkills: string[];
  responsibilities: string[];
  profileWorkHistorySummary: string;
  profileImpliedSkills: string[];
  profileExplicitSkills: string[];
  profileToolsMentioned: string[];
  profileCertifications: string[];
  answers: Array<{
    kind: "STANDARDIZED" | "DYNAMIC_VERIFY_CLAIMED" | "DYNAMIC_PROBE_JOB_REQUIREMENT";
    targetSkill?: string;
    text: string;
    answerLabel: string;
    freeText?: string;
  }>;
}

export interface GenerateAssessmentResult {
  payload: SkillAssessmentPayload;
  raw: unknown;
}

const TOOL_NAME = "return_skill_assessment";

export async function generateSkillAssessment(
  input: GenerateAssessmentInput,
): Promise<GenerateAssessmentResult> {
  const client = getAnthropicClient();
  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description:
        "Return the structured skill assessment comparing profile, job, and questionnaire.",
      input_schema:
        skillAssessmentJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
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
      const parsed = skillAssessmentSchema.safeParse(toolUse.input);
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
              ". Call return_skill_assessment again with a valid payload.",
          },
        ],
      });
      continue;
    }
    lastError = new Error("Assessment generator emitted no tool_use.");
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
        "Call the return_skill_assessment tool with a valid payload. Do so now.",
    });
  }
  throw lastError ?? new Error("Assessment generator failed.");
}

function bullets(items: string[], empty: string): string {
  if (items.length === 0) return `(${empty})`;
  return items.map((s) => `  - ${s}`).join("\n");
}

function buildUserMessage(i: GenerateAssessmentInput): string {
  const parts: string[] = [];
  parts.push(`Target job: ${i.jobTitle} at ${i.companyName}`);
  parts.push("");
  parts.push("Required qualifications:");
  parts.push(bullets(i.requiredQualifications, "none"));
  parts.push("");
  parts.push("Preferred qualifications:");
  parts.push(bullets(i.preferredQualifications, "none"));
  parts.push("");
  parts.push("Tools named in the job:");
  parts.push(bullets(i.tools, "none"));
  parts.push("");
  parts.push("Soft skills expected:");
  parts.push(bullets(i.softSkills, "none"));
  parts.push("");
  parts.push("Core responsibilities:");
  parts.push(bullets(i.responsibilities, "none"));
  parts.push("");
  parts.push("--- Candidate profile ---");
  parts.push("Work history summary:");
  parts.push(i.profileWorkHistorySummary || "(no work history parsed)");
  parts.push("");
  parts.push("Explicit skills:");
  parts.push(bullets(i.profileExplicitSkills, "none"));
  parts.push("");
  parts.push("Implied skills:");
  parts.push(bullets(i.profileImpliedSkills, "none"));
  parts.push("");
  parts.push("Tools mentioned in profile:");
  parts.push(bullets(i.profileToolsMentioned, "none"));
  parts.push("");
  parts.push("Certifications:");
  parts.push(bullets(i.profileCertifications, "none"));
  parts.push("");
  parts.push("--- Questionnaire answers ---");
  for (const a of i.answers) {
    const tag = a.targetSkill ? ` [target: ${a.targetSkill}]` : "";
    parts.push(`Q (${a.kind})${tag}: ${a.text}`);
    parts.push(`A: ${a.answerLabel}${a.freeText ? ` — note: ${a.freeText}` : ""}`);
    parts.push("");
  }
  parts.push(
    "Produce the structured comparison and call return_skill_assessment.",
  );
  return parts.join("\n");
}
