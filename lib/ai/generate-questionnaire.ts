import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  generatedQuestionnaireSchema,
  generatedQuestionnaireJsonSchema,
  TOTAL_QUESTIONS,
  type GeneratedQuestionnaire,
} from "@/lib/schemas/questionnaire";

const SYSTEM_PROMPT = `You design the calibration questionnaire for a career-transition platform. Its job is to build an honest picture of where THIS candidate actually stands today, so a curriculum can bridge the gap from their real starting point to a target role.

THE CORE PRINCIPLE
The candidate's résumé and profile are their true current level. Generate every question FROM that level. The target job is only the destination we measure distance to: use it to decide WHAT to measure, never to decide HOW to phrase it. A question must never presume the candidate is already near the destination. A candidate whose background is far from the role (say, entry-level retail aiming at product design) must get questions that make complete sense to them and that they can answer honestly from their own experience.

Before writing anything, read the profile and set startingPoint: your one-line read of their demonstrated level relative to the destination (far / partial / close, and why). Then calibrate difficulty and vocabulary to it.

WRITE EXACTLY ${TOTAL_QUESTIONS} QUESTIONS
- 5 about how they learn and work, one each: how they learn best (LEARNING_STYLE); how they get up to speed on something unfamiliar (WORK_STYLE); how they handle unclear or incomplete instructions (WORK_STYLE); the pace and format of learning that fits their life (LEARNING_STYLE); how they operate under real pressure or deadlines (WORK_STYLE).
- 10 skill probes: VERIFY_CLAIMED for things the résumé or profile asserts — treat every claim as something to verify, not a fact to build on; PROBE_JOB_REQUIREMENT for things the destination role needs, prioritizing its required qualifications and named tools. Cover a range rather than five variations of one skill.

RULES THAT FOLLOW FROM THE PRINCIPLE
1. Calibrate to the candidate. Ask about work they have actually done. If the profile shows retail, ask "Have you used any software tools in your work, like a point-of-sale system?" — not "Which of these have you done in Figma?". If the profile already shows relevant professional experience, you may use more advanced phrasing, but still verify rather than assume.
2. Use the candidate's own vocabulary. Never use insider terminology they have shown no exposure to. Never name a specific professional tool from the job description in a question as if they have used it. targetSkill is an internal label in the destination's terms; it does not need to appear in the text.
3. Measure traits through transferable experience. To learn how someone approaches an unfamiliar tool, ask about a tool they HAVE used ("When you had to learn your store's POS system, how did you go about it?"). Same signal, honest framing. Apply this to learning style, work style, pressure, confidence, and unfamiliar situations.
4. Choose the format from the shape of the question, not a count. If a person could honestly resonate with more than one option (learning styles, experiences they've had, situations they've handled), it MUST be MULTI_SELECT. If the options are mutually exclusive (a scale, a confidence level, one clear position), it must be SINGLE_SELECT — and write those options so only one truly fits; the person should never feel torn on a single-select question.
5. Scale options: ordered low to high, each anchored to something observable ("Never done it" / "Done it once with help" / "Do it regularly on my own" / "Others ask me how"), never bare adjectives. Multi-select options: distinct, checkable facts. Do not add "None of these", "Other" or "Not applicable" — the interface adds "None of these" to every multi-select question.
6. Decision-useful only. Each question must change the plan depending on the answer; if every answer would lead to the same module, cut it.
7. Make honesty easy: neutral wording, no option that reads as the embarrassing one, no jargon.

STYLE
- Second person, under 30 words per question, plain language.
- Return by calling the return_questionnaire tool.
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
  const noneLike = q.questions.filter((x) =>
    x.options.some((o) => /^(none of (these|the above)|other|not applicable|n\/a)\b/i.test(o)),
  ).length;
  if (noneLike > 0) {
    problems.push(
      `${noneLike} questions include a 'None of these' / 'Other' style option — remove them; the interface adds 'None of these' itself`,
    );
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
      description: `Return exactly ${TOTAL_QUESTIONS} questions calibrated to this candidate's real starting point.`,
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
    // On the last attempt accept a schema-valid payload rather than fail the
    // user; the server strips any stray "None/Other" options anyway.
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

// Profile first, on purpose: it is the starting point the questions come
// from. The job follows, labelled as the destination.
function buildUserMessage(i: GenerateQuestionnaireInput): string {
  return [
    "=== THE CANDIDATE (starting point — generate questions from here) ===",
    "Work history:",
    i.profileWorkHistorySummary || "(no work history parsed — treat as no professional experience on record)",
    "",
    "Skills they list themselves (claims to verify):",
    bullets(i.profileExplicitSkills, "none listed"),
    "",
    "Skills implied by their responsibilities (inferences to verify):",
    bullets(i.profileImpliedSkills, "none"),
    "",
    "Tools and software they have actually mentioned using (the only tools you may name as used):",
    bullets(i.profileToolsMentioned, "none — do not name any professional tool as used"),
    "",
    "Certifications:",
    bullets(i.profileCertifications, "none"),
    "",
    "=== THE DESTINATION (what to measure distance to — not how to phrase) ===",
    `Target role: ${i.jobTitle} at ${i.companyName}`,
    "",
    "Required qualifications:",
    bullets(i.requiredQualifications, "none listed"),
    "",
    "Preferred qualifications:",
    bullets(i.preferredQualifications, "none listed"),
    "",
    "Tools named by the role (measure distance to these via experience the candidate actually has; do not assume use):",
    bullets(i.tools, "none named"),
    "",
    "Responsibilities of the role:",
    bullets(i.responsibilities, "none listed"),
    "",
    "Soft skills the role expects:",
    bullets(i.softSkills, "none named"),
    "",
    `Set startingPoint, then write the ${TOTAL_QUESTIONS} questions per the principle and call ${TOOL_NAME}.`,
  ].join("\n");
}
