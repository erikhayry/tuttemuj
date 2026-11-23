import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type Answer, Draft } from "./ask.ts";
import { SYSTEM_PROMPT } from "./facts.ts";

/** The model that writes answers. Override with ASK_MODEL (for example a cheaper one). */
export const DEFAULT_ASK_MODEL = "claude-opus-5-5";

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
      output_config: { effort: "low", format: zodOutputFormat(Draft) },
      messages: [{ role: "user", content: prompt }],
    });
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return NOTHING;
    const text = res.content.find((b) => b.type === "text");
    if (text?.type !== "text") return NOTHING;
    return Draft.parse(JSON.parse(text.text));
  };
}
