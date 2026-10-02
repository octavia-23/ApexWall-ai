import { NextRequest, NextResponse } from "next/server";
import { generateCalibratedSetup } from "@/lib/setup-engine";

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
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
  } = body;

  if (!game || !car || !track) {
    return NextResponse.json(
      { error: "Game, car, and track are required." },
      { status: 400 }
    );
  }

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
      baselineSetup,
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
