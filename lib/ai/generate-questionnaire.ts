import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  generatedQuestionnaireSchema,
  generatedQuestionnaireJsonSchema,
  MIN_MULTI_SELECT,
  TOTAL_QUESTIONS,
  type GeneratedQuestionnaire,
} from "@/lib/schemas/questionnaire";

const SYSTEM_PROMPT = `You design the calibration questionnaire for a career-transition platform. Your 15 questions decide what a person's training plan contains, so every question must earn its place.

You will be given the target job (title, required/preferred qualifications, tools, responsibilities, soft skills) and the candidate's unified profile (work history, explicit and implied skills, tools, certifications). Write EXACTLY ${TOTAL_QUESTIONS} questions, all tailored to this person and this job.

COMPOSITION
- 5 style questions covering, one each: how they learn best (LEARNING_STYLE); how they get up to speed on an unfamiliar tool (WORK_STYLE); how they handle ambiguous or incomplete instructions (WORK_STYLE); the learning pace and format that fits their life (LEARNING_STYLE); how they operate under real deadline pressure (WORK_STYLE). Personalize each one — reference their actual background or the job's actual conditions — instead of asking generically.
- 10 skill probes: VERIFY_CLAIMED for skills the profile asserts, PROBE_JOB_REQUIREMENT for skills the job needs that the profile doesn't clearly show. Prioritize the required qualifications and named tools; cover a range rather than five variations of one skill.

QUESTION QUALITY — the standard is "decision-useful signal about field readiness"
- Anchor every skill probe to what the job actually demands on day one. Ask about doing, not knowing: "Which of these have you actually done with Amplitude?" beats "How familiar are you with Amplitude?"
- Each question must change the plan depending on the answer. If every answer would lead to the same module, cut the question.
- Prefer concrete scenarios drawn from the job's responsibilities over abstract self-ratings.
- Scale options must be anchored in observable behavior and ordered low to high, e.g. "Haven't used it" / "Followed a tutorial once" / "Used it on a real project with help" / "Ship with it independently" / "Others come to me for it". Never use bare adjectives like "Somewhat familiar".
- Make it safe to answer honestly: neutral, non-judgmental wording; no option should read as the embarrassing one.

ANSWER FORMATS
- SINGLE_SELECT for scales and either/or choices.
- MULTI_SELECT when several options can genuinely be true at the same time — "which of these have you done", "which of these apply to how you work". At least ${MIN_MULTI_SELECT} of the 15 must be MULTI_SELECT, and multi-select options must be distinct, checkable facts, not a scale.
- 3-7 options per question. Do not add an "other" option; the interface always offers a free-text escape hatch.

STYLE
- Second person, under 30 words per question, plain language. No jargon the candidate wouldn't use.
- Return the questionnaire by calling the return_questionnaire tool.
`;

export interface GenerateQuestionnaireInput {
  jobTitle: string;
  companyName: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
  tools: string[];
  responsibilities: string[];
  softSkills: string[];
  profileWorkHistorySummary: string;
  profileImpliedSkills: string[];
  profileExplicitSkills: string[];
  profileToolsMentioned: string[];
  profileCertifications: string[];
}

export interface GenerateQuestionnaireResult {
  payload: GeneratedQuestionnaire;
  raw: unknown;
}

const TOOL_NAME = "return_questionnaire";

// Beyond schema validity, enforce the composition rules the prompt asks for.
function compositionProblems(q: GeneratedQuestionnaire): string[] {
  const problems: string[] = [];
  const n = q.questions.length;
  if (n !== TOTAL_QUESTIONS) {
    problems.push(`expected exactly ${TOTAL_QUESTIONS} questions, got ${n}`);
  }
  const multi = q.questions.filter((x) => x.format === "MULTI_SELECT").length;
  if (multi < MIN_MULTI_SELECT) {
    problems.push(
      `only ${multi} MULTI_SELECT questions; at least ${MIN_MULTI_SELECT} are required`,
    );
  }
  const style = q.questions.filter(
    (x) => x.kind === "LEARNING_STYLE" || x.kind === "WORK_STYLE",
  ).length;
  if (style < 4 || style > 6) {
    problems.push(`expected 5 style questions (LEARNING_STYLE/WORK_STYLE), got ${style}`);
  }
  const missingTarget = q.questions.filter(
    (x) =>
      (x.kind === "VERIFY_CLAIMED" || x.kind === "PROBE_JOB_REQUIREMENT") &&
      !x.targetSkill,
  ).length;
  if (missingTarget > 0) {
    problems.push(`${missingTarget} skill probes are missing targetSkill`);
  }
  return problems;
}

export async function generateQuestionnaire(
  input: GenerateQuestionnaireInput,
): Promise<GenerateQuestionnaireResult> {
  const client = getAnthropicClient();

  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description: `Return exactly ${TOTAL_QUESTIONS} tailored questions for this candidate and job.`,
      input_schema:
        generatedQuestionnaireJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
    },
  ];

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: buildUserMessage(input) },
  ];

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
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

    if (!toolUse) {
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
        content: `Call the ${TOOL_NAME} tool with exactly ${TOTAL_QUESTIONS} questions. Do so now.`,
      });
      continue;
    }

    const parsed = generatedQuestionnaireSchema.safeParse(toolUse.input);
    const problems = parsed.success
      ? compositionProblems(parsed.data)
      : parsed.error.issues.map(
          (i) => `${i.path.join(".") || "<root>"}: ${i.message}`,
        );

    if (parsed.success && problems.length === 0) {
      return { payload: parsed.data, raw: toolUse.input };
    }

    lastError = new Error(problems.join("; "));
    // Only retry on composition problems for the first two attempts; on the
    // last attempt accept a schema-valid payload rather than fail the user.
    if (parsed.success && attempt === 3) {
      return { payload: parsed.data, raw: toolUse.input };
    }
    messages.push({ role: "assistant", content: [toolUse] });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content:
            "The questionnaire did not meet the requirements: " +
            problems.join("; ") +
            `. Call ${TOOL_NAME} again with a corrected set of exactly ${TOTAL_QUESTIONS} questions.`,
        },
      ],
    });
  }

  throw lastError ?? new Error("Questionnaire generator failed.");
}

function bullets(items: string[], empty: string): string {
  if (items.length === 0) return `(${empty})`;
  return items.map((s) => `  - ${s}`).join("\n");
}

function buildUserMessage(i: GenerateQuestionnaireInput): string {
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
    "Core responsibilities (use these for scenarios):",
    bullets(i.responsibilities, "none listed"),
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
    `Write the ${TOTAL_QUESTIONS} questions per the rules and call ${TOOL_NAME}.`,
  ].join("\n");
}
