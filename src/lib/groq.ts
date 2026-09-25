import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY || "";

export const groq = new Groq({
  apiKey: apiKey || "dummy-key-for-init",
});

function extractJSON(text: string): any {
  // Strip markdown fences if present
  let clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Try direct parse
  try {
    return JSON.parse(clean);
  } catch {
    // Locate the first { and the last }
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = clean.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error("Could not find valid JSON object in model response.");
  }
}

export async function callGroqWithFallback(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens: number = 2000,
  temperature: number = 0.5
) {
  if (!apiKey || apiKey === "dummy-key-for-init") {
    throw new Error("GROQ_API_KEY is not configured in environment variables.");
  }

  const models = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ];

  let lastErr: any = null;

  for (const model of models) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        response_format: { type: "json_object" },
        messages,
      });

      const rawText = completion.choices[0]?.message?.content?.trim() || "";
      return extractJSON(rawText);
    } catch (err: any) {
      console.warn(`Model ${model} error: ${err.message}. Trying next fallback...`);
      lastErr = err;

      // If rate limited or context overflow, attempt once with tighter token window
      if (err?.status === 413 || err?.status === 429) {
        try {
          const retryCompletion = await groq.chat.completions.create({
            model,
            max_tokens: Math.min(maxTokens, 1200),
            temperature,
            response_format: { type: "json_object" },
            messages,
          });
          const rawText = retryCompletion.choices[0]?.message?.content?.trim() || "";
          return extractJSON(rawText);
        } catch {
          // Continue to next model
        }
      }
    }
  }

  throw lastErr || new Error("Failed to get valid response from AI models.");
}
