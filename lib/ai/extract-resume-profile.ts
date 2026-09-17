import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  resumeProfileSchema,
  resumeProfileJsonSchema,
  type ResumeProfileExtraction,
} from "@/lib/schemas/resume-profile";

const SYSTEM_PROMPT = `You are a rigorous resume analyst for a career-transition platform.

You will be given the raw text extracted from a candidate's resume, plus optional freeform supplemental notes the candidate typed in themselves (additional work history, additional skills, additional certifications). Resumes are often outdated or tailored to a specific past job, so the supplemental notes may fill in things the resume doesn't reflect.

Your job is to produce ONE unified skill inventory by MERGING the resume and the supplemental notes.

Rules:
1. Extract chronological work history from the resume (most recent role first). Include the role, company, date range, a one-sentence summary of the role, and the concrete responsibilities pulled from bullet points.
2. Add extra roles from the "additional work history" supplemental field as extra work-history entries. Mark date ranges as best you can — write 'Unspecified' if truly not stated.
3. impliedSkills = skills you infer from role responsibilities, even if the resume doesn't list them explicitly (e.g. "managed a team of 6" implies people management).
4. explicitSkills = anything the candidate listed in their own Skills section OR added via the supplemental "additional skills" field. Merge and dedupe.
5. toolsMentioned = concrete named products, platforms, languages, frameworks anywhere in the resume or supplements. Skip generic categories.
6. certifications = combine the resume's certifications with the supplemental "additional certifications" field. Dedupe.
7. Return your answer by calling the return_resume_profile tool with a payload matching the provided JSON schema exactly.
8. Do not fabricate. If a field has no items, return an empty array — never invent.
`;

export interface ExtractResumeProfileInput {
  rawResumeText: string;
  supplementalWorkHistory?: string;
  supplementalSkills?: string;
  supplementalCertifications?: string;
}

export interface ExtractResumeProfileResult {
  profile: ResumeProfileExtraction;
  rawExtraction: unknown;
}

const TOOL_NAME = "return_resume_profile";

export async function extractResumeProfile(
  input: ExtractResumeProfileInput,
): Promise<ExtractResumeProfileResult> {
  const client = getAnthropicClient();

  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description:
        "Return the unified resume profile extracted from the resume text and any supplemental notes.",
      input_schema:
        resumeProfileJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
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
      const parsed = resumeProfileSchema.safeParse(toolUse.input);
      if (parsed.success) {
        return { profile: parsed.data, rawExtraction: toolUse.input };
      }
      lastError = new Error(
        `Resume extractor output failed validation: ${parsed.error.message}`,
      );
      messages.push({ role: "assistant", content: [toolUse] });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            is_error: true,
            content:
              "Your previous call did not match the required schema: " +
              parsed.error.issues
                .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
                .join("; ") +
              ". Call return_resume_profile again with a fully valid payload.",
          },
        ],
      });
      continue;
    }

    lastError = new Error(
      "Resume extractor did not emit a tool_use block on this attempt.",
    );
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
        "You must respond by calling the return_resume_profile tool. Do so now.",
    });
  }

  throw lastError ?? new Error("Resume extractor failed for unknown reasons.");
}

function buildUserMessage(i: ExtractResumeProfileInput): string {
  const parts: string[] = [];
  parts.push("--- BEGIN RESUME TEXT ---");
  parts.push(i.rawResumeText.trim());
  parts.push("--- END RESUME TEXT ---");
  if (i.supplementalWorkHistory && i.supplementalWorkHistory.trim().length > 0) {
    parts.push("");
    parts.push("Supplemental — Additional work history (candidate-supplied):");
    parts.push(i.supplementalWorkHistory.trim());
  }
  if (i.supplementalSkills && i.supplementalSkills.trim().length > 0) {
    parts.push("");
    parts.push("Supplemental — Additional skills (candidate-supplied):");
    parts.push(i.supplementalSkills.trim());
  }
  if (
    i.supplementalCertifications &&
    i.supplementalCertifications.trim().length > 0
  ) {
    parts.push("");
    parts.push("Supplemental — Additional certifications (candidate-supplied):");
    parts.push(i.supplementalCertifications.trim());
  }
  parts.push("");
  parts.push(
    "Extract the unified profile and call return_resume_profile now.",
  );
  return parts.join("\n");
}
