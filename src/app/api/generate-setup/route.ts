import { NextRequest, NextResponse } from "next/server";
import { generateCalibratedSetup } from "@/lib/setup-engine";
import {
  GenerateSetupRequestSchema,
  GenerateSetupRequest,
  MemoryRateLimiter,
  MAX_PAYLOAD_BYTES,
  getClientIp,
} from "@/lib/api-schemas";

/**
 * In-memory token-bucket limiter (10 requests per minute per IP).
 * Note: Rate limiting is per-serverless-instance, which is acceptable for a demo deployment.
 */
const generateSetupLimiter = new MemoryRateLimiter(10, 60 * 1000);

export async function POST(req: NextRequest) {
  // 1. In-memory Rate Limiting
  const clientIp = getClientIp(req.headers);
  const { allowed } = generateSetupLimiter.check(clientIp);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  // 2. Early Content-Length check (reject payloads > 32KB before parsing)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "Payload too large. Maximum allowed size is 32KB." },
      { status: 413 }
    );
  }

  // 3. Read body text with size cap check as a belt-and-braces measure
  let rawBodyText: string;
  try {
    rawBodyText = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (Buffer.byteLength(rawBodyText, "utf8") > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "Payload too large. Maximum allowed size is 32KB." },
      { status: 413 }
    );
  }

  // 4. Parse JSON
  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  // 5. Validate schema with safeParse
  const parseResult = GenerateSetupRequestSchema.safeParse(jsonBody);
  if (!parseResult.success) {
    const issueMessages = parseResult.error.issues.map((issue) => issue.message).join("; ");
    return NextResponse.json(
      { error: `Validation error: ${issueMessages}` },
      { status: 400 }
    );
  }

  const {
    game,
    car,
    track,
    sessionType,
    weather,
    trackTemp,
    airTemp,
    fuelLoad,
    tyreCompound,
    driverStyle,
    handlingIssue,
    skillLevel,
    customModProfile,
    baselineSetup,
    telemetryContext,
    fullBaselineRequested,
  }: GenerateSetupRequest = parseResult.data;

  try {
    const setupResult = await generateCalibratedSetup({
      game,
      car,
      track,
      sessionType,
      weather,
      trackTemp,
      airTemp,
      fuelLoad,
      tyreCompound,
      driverStyle,
      handlingIssue,
      skillLevel,
      customModProfile,
      baselineSetup: baselineSetup ?? undefined,
      telemetryContext,
      fullBaselineRequested,
    });

    return NextResponse.json(setupResult);
  } catch (err: any) {
    console.error("Hybrid setup engine generation failure:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate calibrated setup." },
      { status: 500 }
    );
  }
}
