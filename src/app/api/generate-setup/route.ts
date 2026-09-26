import { NextRequest, NextResponse } from "next/server";
import { callGroqWithFallback } from "@/lib/groq";
import { getGameSetupProfile } from "@/lib/game-setup-profiles";

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
  } = body;

  if (!game || !car || !track) {
    return NextResponse.json(
      { error: "Game, car, and track are required." },
      { status: 400 }
    );
  }

  // Resolve the game-authentic profile for the chosen simulator
  const profile = getGameSetupProfile(game);

  const userBrief = `
Sim racing title: ${game} (Match in-game setup garage format exactly)
Car: ${car}
Track / layout: ${track}
Session type: ${sessionType || "Not specified"}
Weather: ${weather || "Dry"}
Track temperature: ${trackTemp || "Not specified"}
Air temperature: ${airTemp || "Not specified"}
Fuel load: ${fuelLoad || "Not specified"}
Tyre compound: ${tyreCompound || "Not specified"}
Driver style: ${driverStyle || "Not specified"}
Known handling issue / focus: ${handlingIssue || "None stated, optimize for a balanced all-round setup"}
Driver skill level: ${skillLevel || "Not specified"}
`.trim();

  const systemPrompt = `You are a professional race engineer who builds game-authentic car setups for sim racing titles.

CRITICAL INSTRUCTION: You must NEVER output generic setup categories or generic numbers. You must tailor the section titles, parameter labels, units, and click ranges to match the EXACT in-game garage setup menu of "${profile.displayName}".

${profile.systemPromptGuidance}

Respond with ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching this shape:

{
  "summary": "2-3 sentence engineer's summary of the overall philosophy for this setup, explicitly referencing the game-specific physics behavior",
  "sections": [
    {
      "title": "${profile.menuTabs[0]}",
      "items": [
        { "label": "...", "value": "..." }
      ]
    }
  ],
  "engineerNotes": "3-5 sentences explaining the key trade-offs made and how to adjust the in-game clicks/settings if the balance still isn't right, written like a race engineer talking to their driver on the radio."
}

Rules:
- Section titles MUST match the actual garage tabs of ${profile.displayName} (${profile.menuTabs.join(", ")}).
- Use the authentic in-game units: for example in Assetto Corsa, toe is in clicks or mm (e.g. -6 clicks / -1.5mm), dampers are in 0-40 clicks, rear wing in notches 0-12. In F1, wings are 1-50, suspension is 1-41, ARB is 1-21.
- Never use generic placeholder templates.
- Keep all parameter items concrete and numeric as they appear in the game.`;

  try {
    const setup = await callGroqWithFallback([
      { role: "system", content: systemPrompt },
      { role: "user", content: userBrief },
    ], 2200, 0.4);

    return NextResponse.json(setup);
  } catch (err: any) {
    console.warn(`AI model generation issue, using game-authentic procedural profile for ${profile.displayName}:`, err?.message || err);

    try {
      const fallbackSetup = profile.generateProceduralSetup({
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
      });

      return NextResponse.json(fallbackSetup);
    } catch (fallbackErr: any) {
      console.error("Setup generation error:", fallbackErr);
      return NextResponse.json(
        { error: err?.message || "Failed to generate game-specific setup." },
        { status: 500 }
      );
    }
  }
}
