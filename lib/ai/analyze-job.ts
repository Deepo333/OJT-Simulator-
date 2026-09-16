import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, DEFAULT_MODEL } from "./client";
import {
  JOB_ANALYSIS_SYSTEM_PROMPT,
  buildUserMessage,
} from "./prompts";
import {
  competencyMapSchema,
  competencyMapJsonSchema,
  type CompetencyMap,
} from "@/lib/schemas/competency-map";

export interface AnalyzeJobInput {
  rawJobText: string;
  companyName?: string;
  sourceUrl?: string;
  candidateContext?: string;
}

export interface AnalyzeJobResult {
  competencyMap: CompetencyMap;
  rawAnalysis: unknown;
}

const TOOL_NAME = "return_competency_map";

// Analyze a raw job listing and return a validated CompetencyMap.
//
// Uses Anthropic's tool-use pattern to force JSON that matches
// `competencyMapJsonSchema`. If validation fails on the first attempt (e.g.
// the model returned prose or an empty tool_use block), we retry once with a
// blunt correction message before giving up.
export async function analyzeJob(
  input: AnalyzeJobInput,
): Promise<AnalyzeJobResult> {
  const client = getAnthropicClient();

  const tools: Anthropic.Messages.Tool[] = [
    {
      name: TOOL_NAME,
      description:
        "Return the extracted competency map for the provided job listing.",
      // The SDK types input_schema loosely; our schema is well-formed.
      input_schema: competencyMapJsonSchema as unknown as Anthropic.Messages.Tool["input_schema"],
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
      system: JOB_ANALYSIS_SYSTEM_PROMPT,
      tools,
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages,
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use" && block.name === TOOL_NAME,
    );

    if (toolUse) {
      const parsed = competencyMapSchema.safeParse(toolUse.input);
      if (parsed.success) {
        return {
          competencyMap: parsed.data,
          rawAnalysis: toolUse.input,
        };
      }
      lastError = new Error(
        `Analyzer output failed schema validation: ${parsed.error.message}`,
      );
      messages.push({
        role: "assistant",
        content: [toolUse],
      });
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
              ". Please call return_competency_map again with a fully valid payload.",
          },
        ],
      });
      continue;
    }

    lastError = new Error(
      "Analyzer did not emit a tool_use block on this attempt.",
    );
    const assistantText =
      response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("\n") || "(no text)";
    messages.push({ role: "assistant", content: assistantText });
    messages.push({
      role: "user",
      content:
        "You must respond by calling the return_competency_map tool with a valid JSON payload. Do so now.",
    });
  }

  throw lastError ?? new Error("Analyzer failed for unknown reasons.");
}
