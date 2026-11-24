import Anthropic from "@anthropic-ai/sdk";
import { Schema } from "effect";
import { type Answer, Draft } from "./ask.ts";
import { SYSTEM_PROMPT } from "./facts.ts";

/** The model that writes answers. Override with ASK_MODEL (for example a cheaper one). */
export const DEFAULT_ASK_MODEL = "claude-opus-5-5";

// The JSON Schema Claude must follow, written by hand and kept in step with `Draft`. Effect can
// generate one (`Schema.toJsonSchemaDocument`), but it allows extra properties and adds integer
// bounds, which Claude's structured output does not accept.
const DRAFT_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      answerable: { type: "boolean" },
      answer: { type: "string" },
      used: { type: "array", items: { type: "integer" } },
    },
    required: ["answerable", "answer", "used"],
    additionalProperties: false,
  },
} as const;

const NOTHING: Draft = { answerable: false, answer: "", used: [] };

/** Ask Claude to answer from the numbered facts in `prompt`. Returns "not answerable" on a refusal. */
export function claudeAnswer(
  client: Anthropic = new Anthropic(),
  model: string = DEFAULT_ASK_MODEL,
): Answer {
  return async (prompt) => {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 1500,
      // If a safety classifier declines, retry on the fallback model inside the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: "low", format: DRAFT_FORMAT },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return NOTHING;
    const text = res.content.find((b) => b.type === "text");
    if (text?.type !== "text") return NOTHING;
    return Schema.decodeUnknownSync(Draft)(JSON.parse(text.text));
  };
}
