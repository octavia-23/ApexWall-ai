import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY || "";

export const groq = new Groq({
  apiKey,
});

export async function callGroqWithFallback(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens: number = 1400,
  temperature: number = 0.4
) {
  const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
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
      const cleaned = rawText.replace(/^```json\s*|```\s*$/g, "").trim();
      return JSON.parse(cleaned);
    } catch (err: any) {
      console.warn(`Model ${model} warning: ${err.message}. Trying next fallback...`);
      lastErr = err;

      // If rate limited or request too large, attempt once with tighter token reservation
      if (err?.status === 413 || err?.status === 429) {
        try {
          const retryCompletion = await groq.chat.completions.create({
            model,
            max_tokens: Math.min(maxTokens, 900),
            temperature,
            response_format: { type: "json_object" },
            messages,
          });
          const rawText = retryCompletion.choices[0]?.message?.content?.trim() || "";
          const cleaned = rawText.replace(/^```json\s*|```\s*$/g, "").trim();
          return JSON.parse(cleaned);
        } catch {
          // Continue to next model
        }
      }
    }
  }

  throw lastErr || new Error("Failed to get valid response from AI models.");
}
