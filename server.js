require("dotenv").config();
const express = require("express");
const path = require("path");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "\n⚠️  GROQ_API_KEY is missing. Copy .env.example to .env and add your free key from https://console.groq.com/keys\n"
  );
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Support large telemetry payloads (CSVs, JSON traces, downsampled MoTeC logs)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

/**
 * Helper to call Groq with fallback models in case of rate limits or model adjustments.
 */
async function callGroqWithFallback(messages, maxTokens = 2500, temperature = 0.5) {
  const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];
  let lastErr = null;

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
    } catch (err) {
      console.warn(`Model ${model} notice: ${err.message}. Trying next available fallback...`);
      lastErr = err;
    }
  }

  throw lastErr || new Error("Failed to get valid response from AI models.");
}

// -------------------------------------------------------------
// Endpoint 1: Setup Generator
// -------------------------------------------------------------
app.post("/api/generate-setup", async (req, res) => {
  try {
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
    } = req.body;

    if (!game || !car || !track) {
      return res
        .status(400)
        .json({ error: "Game, car, and track are required." });
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
- Only include sections that are actually relevant to the named car/game (e.g. omit "Electronics" for a car with no driver aids, omit "Aerodynamics" for a car with no adjustable aero).
- Keep "items" concrete and numeric wherever the real game exposes numeric fields.
- Never say you are an AI or add disclaimers inside the JSON.`;

    const setup = await callGroqWithFallback([
      { role: "system", content: systemPrompt },
      { role: "user", content: userBrief },
    ], 2000, 0.6);

    res.json(setup);
  } catch (err) {
    console.error("Setup generation error:", err);
    res.status(500).json({ error: "Something went wrong generating the setup." });
  }
});

// -------------------------------------------------------------
// Endpoint 2: Telemetry Analyzer (AI Race & Performance Engineer)
// -------------------------------------------------------------
app.post("/api/analyze-telemetry", async (req, res) => {
  try {
    const {
      game,
      car,
      track,
      sessionType,
      weather,
      trackTemp,
      airTemp,
      tyreCompound,
      fuelLoad,
      driverStyle,
      balancePreference,
      setupTarget,
      driverComplaint,
      summaryMetrics,
      sampledPoints,
      anomalies,
    } = req.body;

    if (!game || !car || !track) {
      return res
        .status(400)
        .json({ error: "Game, car, and track are required for telemetry analysis." });
    }

    const telemetryReport = `
=== TELEMETRY INGEST SESSION ===
Simulator: ${game}
Car Model: ${car}
Circuit / Layout: ${track}
Session: ${sessionType || "Practice / Hotlap"}
Weather: ${weather || "Dry"}
Track Temperature: ${trackTemp || "30°C"}
Ambient Air Temperature: ${airTemp || "22°C"}
Tyre Compound: ${tyreCompound || "Standard Slick"}
Fuel Load: ${fuelLoad || "35 L"}

=== DRIVER PROFILE & ADAPTIVE SETUP TARGETS ===
Natural Driving Style: ${driverStyle || "Heavy Trail-Braker"}
Chassis Balance Preference: ${balancePreference || "Neutral Balance"}
Optimization Target: ${setupTarget || "Qualifying Hotlap (Peak Grip)"}
Driver's Specific Feedback or Goal: ${driverComplaint || "Analyze overall lap pace, entry stability, and apex rotation"}

=== COMPUTED TELEMETRY CHANNELS & METRICS ===
Recorded Lap Time: ${summaryMetrics?.lapTime || "N/A"}
Top Speed: ${summaryMetrics?.topSpeed || "N/A"} km/h
Minimum Corner Speeds: ${JSON.stringify(summaryMetrics?.minCornerSpeeds || [])}
Calculated Trail-Braking Smoothness Score: ${summaryMetrics?.trailBrakingScore != null ? summaryMetrics.trailBrakingScore + "/100" : "N/A"}
Throttle Progression & Traction Score: ${summaryMetrics?.throttleSmoothness != null ? summaryMetrics.throttleSmoothness + "/100" : "N/A"}
Steering Scrub & Understeer Index: ${summaryMetrics?.steeringScrub != null ? summaryMetrics.steeringScrub + "/100" : "N/A"}
Peak Braking Deceleration: ${summaryMetrics?.maxDecelG != null ? summaryMetrics.maxDecelG + " G" : "N/A"}
Peak Lateral Acceleration: ${summaryMetrics?.maxLatG != null ? summaryMetrics.maxLatG + " G" : "N/A"}

Tyre Pressures & Thermals:
FL: ${JSON.stringify(summaryMetrics?.tyres?.FL || { temp: "84°C", pressure: "27.2 psi" })}
FR: ${JSON.stringify(summaryMetrics?.tyres?.FR || { temp: "86°C", pressure: "27.4 psi" })}
RL: ${JSON.stringify(summaryMetrics?.tyres?.RL || { temp: "82°C", pressure: "26.8 psi" })}
RR: ${JSON.stringify(summaryMetrics?.tyres?.RR || { temp: "83°C", pressure: "26.9 psi" })}

Detected Telemetry Events & Anomalies:
${(anomalies || []).map((a, i) => `${i + 1}. [${a.location || 'Lap Zone'}] ${a.description} (Channel: ${a.channel || 'telemetry'})`).join("\n") || "No extreme telemetry spikes detected."}

Sampled Distance-Speed-Pedal Telemetry Slice:
${JSON.stringify((sampledPoints || []).slice(0, 45))}
`.trim();

    const systemPrompt = `You are a World-Class Chief Performance & Race Telemetry Engineer (Formula 1 & GT World Challenge level, master of MoTeC i2 Pro and sim racing vehicle dynamics).
You are performing a two-fold engineering task:
1. In-depth analysis of the driver's telemetry log (pedal curves, trail-braking decay, steering scrub, corner min-speeds, tyre thermals).
2. Synthesizing a COMPLETE, NEW, CALIBRATED CAR SETUP engineered specifically around this driver's natural driving style (${driverStyle || 'Heavy Trail-Braker'}) and balance preference (${balancePreference || 'Neutral Balance'}), designed to mechanically neutralize their observed telemetry flaws and extract maximum lap time.

You MUST respond with ONLY valid JSON (no markdown formatting, no commentary outside the JSON), matching exactly this structure:

{
  "overallScore": 82,
  "verdictTitle": "Aggressive Trail-Braking Truncation with Mid-Corner Push",
  "lapTimeObserved": "${summaryMetrics?.lapTime || '2:17.482'}",
  "estimatedTimeLost": "0.75s - 1.10s",
  "primaryLimiter": "Entry Understeer & Early Throttle Hesitation",
  "executiveSummary": "2-3 crisp, authoritative sentences from the chief race engineer analyzing overall pace, tyre loading, and vehicle dynamics on this lap.",
  "kpiRatings": [
    { "name": "Trail Braking", "score": 72, "status": "Needs Work", "feedback": "Detailed observation on brake pressure decay and release rate into turns." },
    { "name": "Throttle Traction", "score": 85, "status": "Good", "feedback": "Evaluation of throttle feed-in, hesitations, or wheelspin on exit." },
    { "name": "Steering Efficiency", "score": 74, "status": "Fair", "feedback": "Steering scrub vs yaw rate analysis (excessive lock at apex)." },
    { "name": "Tyre Management", "score": 88, "status": "Optimal", "feedback": "Evaluation of hot tyre pressures, camber heat gradient, and overheating." },
    { "name": "Chassis Balance", "score": 76, "status": "Understeer", "feedback": "Mechanical vs aero balance diagnosis (entry, apex, or exit biased)." }
  ],
  "cornerBreakdowns": [
    {
      "corner": "Corner / Sector Name (e.g. Turn 1 Heavy Braking)",
      "timeDelta": "+0.32s",
      "driverInput": "Exact driver input flaw shown in telemetry (pedal/wheel movement).",
      "chassisResponse": "Exact chassis reaction (suspension pitch, tyre slip angle, yaw rate, loss of apex speed).",
      "actionableFix": "Precise driver coaching cue to gain back the lap time."
    }
  ],
  "driverCoaching": [
    { "phase": "Braking & Entry", "icon": "brake", "tip": "Actionable technique guidance for pedal release and braking markers." },
    { "phase": "Apex & Rotation", "icon": "steer", "tip": "Steering input smoothness and slip angle management." },
    { "phase": "Exit & Power Delivery", "icon": "throttle", "tip": "Throttle application timing and avoiding wheelspin/traction control intervention." }
  ],
  "setupAdjustments": [
    {
      "category": "Anti-Roll Bars",
      "component": "Front Anti-Roll Bar",
      "adjustment": "-1 click (Softer)",
      "rationale": "Reduces front roll resistance and allows more front tyre bite into mid-corner."
    }
  ],
  "adaptiveSetup": {
    "philosophy": "Detailed explanation of how this entire setup was custom-tailored to the driver's specific driving style (${driverStyle}) and telemetry tendencies to give them confidence while curing their lap time loss.",
    "sections": [
      {
        "title": "Tyres & Cold Pressures",
        "items": [
          { "label": "Front Left Cold Pressure", "value": "26.4 psi", "styleNote": "Tuned to stabilize outer shoulder under your braking load" },
          { "label": "Front Right Cold Pressure", "value": "26.7 psi", "styleNote": "Compensates for circuit load direction" },
          { "label": "Rear Left Cold Pressure", "value": "26.2 psi", "styleNote": "Maximizes contact patch on traction exit" },
          { "label": "Rear Right Cold Pressure", "value": "26.4 psi", "styleNote": "Equalizes hot pressure targets" }
        ]
      },
      {
        "title": "Suspension & Wheel Alignment",
        "items": [
          { "label": "Front Anti-Roll Bar", "value": "3 / 6 (Medium-Soft)", "styleNote": "Softened to cure your mid-corner push without losing high-speed response" },
          { "label": "Rear Anti-Roll Bar", "value": "2 / 6 (Soft)", "styleNote": "Keeps the rear axle glued during your early throttle commitment" },
          { "label": "Front Camber", "value": "-3.6°", "styleNote": "Optimized for high lateral G at apex" },
          { "label": "Rear Camber", "value": "-2.8°", "styleNote": "Balance between traction and lateral support" },
          { "label": "Front Toe", "value": "-0.08° (Toe-out)", "styleNote": "Aids initial turn-in bite" },
          { "label": "Rear Toe", "value": "+0.16° (Toe-in)", "styleNote": "High-speed stability under braking" }
        ]
      },
      {
        "title": "Dampers (Bump & Rebound)",
        "items": [
          { "label": "Front Low-Speed Bump", "value": "6 / 11", "styleNote": "Absorbs pitch to forgive abrupt brake releases" },
          { "label": "Rear Low-Speed Rebound", "value": "7 / 11", "styleNote": "Controls rear lift during hard deceleration" }
        ]
      },
      {
        "title": "Aerodynamics & Ride Height",
        "items": [
          { "label": "Front Ride Height", "value": "52 mm", "styleNote": "Maximizes front splitter downforce" },
          { "label": "Rear Wing Angle", "value": "8 / 12", "styleNote": "High-speed rear stability matched to your confidence margin" }
        ]
      },
      {
        "title": "Differential & Drivetrain",
        "items": [
          { "label": "Diff Preload / Coast Lock", "value": "60 Nm", "styleNote": "Permits easier off-throttle rotation without destabilizing the rear" }
        ]
      },
      {
        "title": "Brakes & Electronics",
        "items": [
          { "label": "Brake Bias", "value": "54.2% (Rearward Shift)", "styleNote": "Helps initiate trail-braking rotation without front lockup" },
          { "label": "ABS Setting", "value": "3 / 11", "styleNote": "Prevents aggressive spikes while retaining modulation" },
          { "label": "Traction Control (TC1)", "value": "3 / 11", "styleNote": "Permits optimal slip angle on corner exit" }
        ]
      }
    ]
  },
  "pitRadioMessage": "Authentic, immersive radio communication from race engineer to driver over team comms."
}

Rules:
- Give at least 3 distinct corner breakdowns for actual turns of ${track}.
- In 'adaptiveSetup', generate realistic, concrete numeric and click parameters across Tyres, Suspension, Dampers, Aerodynamics, Differential, and Brakes/Electronics that explicitly match the requested game (${game}) and car class (${car}).
- The 'styleNote' for each setup parameter must explain how that specific setting complements their natural driving style and fixes their telemetry flaw.
- Ensure the JSON is completely valid and parseable.`;

    const analysis = await callGroqWithFallback([
      { role: "system", content: systemPrompt },
      { role: "user", content: telemetryReport },
    ], 2500, 0.4);

    res.json(analysis);
  } catch (err) {
    console.error("Telemetry analysis error:", err);
    res.status(500).json({ error: "Something went wrong analyzing the telemetry." });
  }
});

app.listen(PORT, () => {
  console.log(`\n🏁  Sim Setup AI running at http://localhost:${PORT}\n`);
});
