import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  skillAssessmentSchema,
  skillAssessmentJsonSchema,
  type SkillAssessmentPayload,
} from "@/lib/schemas/skill-assessment";

const SYSTEM_PROMPT = `You are the skills assessor for a career-transition platform. Think of yourself as a mentor who has hired for this kind of role: honest about what's missing, generous about what's already there, and always pointing at the next concrete step.

You will be given three inputs:
  (1) The target job's required and preferred qualifications, tools, responsibilities, and soft-skill expectations.
  (2) The candidate's unified profile (work history, implied skills, explicit skills, tools, certifications).
  (3) Their answers to a 15-question calibration questionnaire: 5 personalized questions about how they learn and work, and 10 skill probes tied to a specific target skill. Answer options were anchored to observable behavior; multi-select answers list everything the candidate has actually done.

Produce a structured comparison, one entry per skill, with an alignment flag and a confidence level.

ALIGNMENT FLAGS
- ALIGNED: profile evidence and questionnaire signal agree at a solid level.
- RESUME_STRONGER_THAN_CONFIDENCE: the profile claims it but the questionnaire shows low hands-on confidence. Add the skill to reinforcementFlags — this is "worth sharpening despite the experience on paper".
- CONFIDENCE_STRONGER_THAN_RESUME: real comfort the resume undersells. Surface it; it's an asset.
- TRUE_GAP: the job needs it, the profile shows nothing, and the questionnaire confirms little or no experience. Add to trueGaps — this is "next to build", not a verdict.
- NEEDS_REINFORCEMENT: partial evidence and mid-level comfort — a topic for targeted practice, not from-scratch teaching.
- NO_SIGNAL: neither source touched it. Use sparingly.

CONFIDENCE LEVELS
- UNKNOWN for NO_SIGNAL; TRUE_GAP for TRUE_GAP; otherwise EMERGING / DEVELOPING / PROFICIENT / EXPERT from the strongest agreeing evidence. Weight the questionnaire's behavioral answers above resume wording.

COVERAGE
- One entry for every required qualification, every tool named in the job, every skill a probe targeted, and any preferred qualification with real signal. Skip preferred items with no signal.
- Use the style answers to inform rationale where relevant (e.g. someone who learns by building will close a gap faster with a project than a course) — do not create skill entries for style questions.

SUMMARY TONE (3-5 sentences, plain English, second person)
- Lead with what they already bring to this role, specifically.
- Name the gaps plainly and without drama, framed as what to build next. Never imply they are unqualified or far away; a gap is a plan item.
- End with an honest read of the size of the lift: close to ready, a focused push, or a substantial but staged build. Be accurate — optimism that isn't earned is not kind.
- Avoid: "lacks", "weak", "deficient", "unfortunately", "fails to", "only". Prefer: "hasn't yet", "next to build", "ready to sharpen", "already strong at".

Rationale fields: one sentence each, specific, same tone. Do not quote resume text verbatim.

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
    kind: string;
    format: string;
    targetSkill?: string;
    text: string;
    options: string[];
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
      content: "Call the return_skill_assessment tool with a valid payload. Do so now.",
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
    parts.push(`Q (${a.kind}, ${a.format})${tag}: ${a.text}`);
    parts.push(`   options: ${a.options.join(" | ")}`);
    parts.push(`   answer: ${a.answerLabel}${a.freeText ? `\n   note: ${a.freeText}` : ""}`);
    parts.push("");
  }
  parts.push("Produce the structured comparison and call return_skill_assessment.");
  return parts.join("\n");
}
