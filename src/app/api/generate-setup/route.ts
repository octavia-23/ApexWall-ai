import { NextRequest, NextResponse } from "next/server";
import { callGroqWithFallback } from "@/lib/groq";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    const userBrief = `
Sim racing title: ${game}
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

    const systemPrompt = `You are a professional race engineer who builds car setups for sim racing titles (iRacing, Assetto Corsa Competizione, Assetto Corsa, rFactor 2, Automobilista 2, Le Mans Ultimate, F1 24/25, Gran Turismo 7, RaceRoom, etc).

Given details about a game, car, track, conditions, and driver preferences, produce a complete, realistic setup. Use setup ranges and terminology that are actually plausible for the named title and car class — a GT3 car in ACC uses different fields than an F1 car or an oval stock car in iRacing, so tailor the fields to the real car/game rather than reusing one generic template.

Respond with ONLY valid JSON, no markdown fences, no commentary outside the JSON, matching exactly this shape:

{
  "summary": "2-3 sentence engineer's summary of the overall philosophy for this setup",
  "sections": [
    {
      "title": "Tyres & Pressures",
      "items": [
        { "label": "Front Left Pressure", "value": "26.5 psi (cold)" },
        { "label": "...", "value": "..." }
      ]
    },
    {
      "title": "Suspension",
      "items": [ { "label": "...", "value": "..." } ]
    },
    {
      "title": "Aerodynamics",
      "items": [ { "label": "...", "value": "..." } ]
    },
    {
      "title": "Differential & Drivetrain",
      "items": [ { "label": "...", "value": "..." } ]
    },
    {
      "title": "Brakes",
      "items": [ { "label": "...", "value": "..." } ]
    },
    {
      "title": "Gearing",
      "items": [ { "label": "...", "value": "..." } ]
    },
    {
      "title": "Electronics",
      "items": [ { "label": "...", "value": "..." } ]
    }
  ],
  "engineerNotes": "3-5 sentences explaining the key trade-offs made and what to try if the balance still isn't right, written like a race engineer talking to their driver on the radio."
}

Rules:
- Only include sections that are actually relevant to the named car/game.
- Keep "items" concrete and numeric wherever the real game exposes numeric fields.
- Never say you are an AI or add disclaimers inside the JSON.`;

    const setup = await callGroqWithFallback([
      { role: "system", content: systemPrompt },
      { role: "user", content: userBrief },
    ], 2000, 0.6);

    return NextResponse.json(setup);
  } catch (err: any) {
    console.error("Setup generation error:", err);
    return NextResponse.json(
      { error: "Something went wrong generating the setup." },
      { status: 500 }
    );
  }
}
