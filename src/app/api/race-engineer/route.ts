import { NextRequest, NextResponse } from "next/server";
import { callGroqChatText } from "@/lib/groq";
import { detectChassisArchetype } from "@/lib/chassis-archetypes";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const {
    messages = [],
    telemetryContext,
    setupContext,
    activeSim = "Assetto Corsa Competizione",
  } = body;

  const lastUserMessage = messages[messages.length - 1]?.content || "";

  // 1. Build rich context summary from active telemetry and setup
  let sessionContextText = `ACTIVE SIMULATOR: ${activeSim}\n`;

  if (setupContext) {
    sessionContextText += `\n--- CURRENT LOADED SETUP ---\n`;
    sessionContextText += `Car: ${setupContext.car || "GT3 / Prototype"}\n`;
    sessionContextText += `Track: ${setupContext.track || "Grand Prix Circuit"}\n`;
    if (setupContext.summary) {
      sessionContextText += `Setup Philosophy: ${setupContext.summary}\n`;
    }
    if (setupContext.sections && Array.isArray(setupContext.sections)) {
      sessionContextText += `Setup Parameters:\n`;
      setupContext.sections.forEach((sec: any) => {
        const itemsStr = (sec.items || [])
          .map((it: any) => `${it.label}: ${it.value}`)
          .slice(0, 6)
          .join(", ");
        sessionContextText += `  • [${sec.title}]: ${itemsStr}\n`;
      });
    }
  }

  if (telemetryContext) {
    sessionContextText += `\n--- SESSION TELEMETRY & LAP ANALYSIS ---\n`;
    if (telemetryContext.lapTime) sessionContextText += `Lap Time: ${telemetryContext.lapTime}\n`;
    if (telemetryContext.topSpeed) sessionContextText += `Top Speed: ${telemetryContext.topSpeed} km/h\n`;
    if (telemetryContext.trailBrakingScore != null) {
      sessionContextText += `Trail-Braking Efficiency Score: ${telemetryContext.trailBrakingScore}/100\n`;
    }
    if (telemetryContext.gripUtilization != null) {
      sessionContextText += `Peak Grip Utilization: ${telemetryContext.gripUtilization}%\n`;
    }
    if (telemetryContext.tyres) {
      const t = telemetryContext.tyres;
      sessionContextText += `Tyre Status: FL ${t.FL?.pressure || ""} (${t.FL?.temp || ""}), FR ${t.FR?.pressure || ""} (${t.FR?.temp || ""}), RL ${t.RL?.pressure || ""} (${t.RL?.temp || ""}), RR ${t.RR?.pressure || ""} (${t.RR?.temp || ""})\n`;
    }
    if (telemetryContext.keyCorners && Array.isArray(telemetryContext.keyCorners)) {
      sessionContextText += `Key Corner Deltas:\n`;
      telemetryContext.keyCorners.slice(0, 5).forEach((c: any) => {
        sessionContextText += `  • ${c.corner}: Speed ${c.driverSpeed} km/h (Δ ${c.speedDelta > 0 ? "+" : ""}${c.speedDelta} km/h), Time Δ ${c.timeDelta > 0 ? "+" : ""}${c.timeDelta}s — ${c.verdict || ""}\n`;
      });
    }
  }

  const detectedCar = setupContext?.car || telemetryContext?.car || "GT3";
  const archetype = detectChassisArchetype(detectedCar, activeSim);

  const systemPrompt = `You are the Chief Race Engineer on the pit wall for an elite sim racing driver, communicating live over the team radio and pit-lane telemetry debrief.
Your tone is professional, direct, analytical, and supportive—modeled after premier F1 and WEC race engineers (like Peter Bonnington "Bono" or Gianpiero Lambiase "GP").

Driver's Session Data:
${sessionContextText}

VEHICLE ARCHETYPE PHYSICS RULES FOR "${detectedCar}" (${archetype.displayName}):
${archetype.promptGuidance}

Guidelines:
1. Always sound like an authentic race engineer on the radio ("Copy driver", "Understood", "Looking at your telemetry trace into...").
2. When the driver asks about handling issues (e.g. oversteer on entry, mid-corner understeer, snap oversteer on kerbs, traction loss):
   - Diagnose whether the issue is mechanical balance, aerodynamic balance, damper transition, or driving technique (e.g. brake release profile).
3. Enforce authentic physics: Never recommend tyre pressures outside this archetype's operating window, never invert diff lock logic, and only mention components actually present on this vehicle.
4. If recommending setup changes, format them cleanly with bullet points:
   • Component: [Setting Change] (Brief technical rationale)
5. Be concise and high-signal. Avoid fluff or generic motivational padding. Keep answers practical and driver-focused.
6. Proportionality & Balance: Never recommend wild, polar extreme adjustments (e.g., maxing wings, stripping all aero, or jacking up extreme rake). Recommend measured, incremental changes (1-2 clicks, 2-4% diff, 2-3mm ride height) to maintain vehicle balance without introducing new handling hazards.`;

  try {
    const formattedMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.slice(-8).map((m: ChatMessage) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const reply = await callGroqChatText(formattedMessages, 1200, 0.6);
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.warn("Groq chat error, falling back to procedural race engineer response:", err?.message || err);

    // Procedural Motorsport Race Engineer Fallback
    const fallbackReply = generateProceduralEngineerResponse(
      lastUserMessage,
      activeSim,
      setupContext,
      telemetryContext
    );

    return NextResponse.json({ reply: fallbackReply });
  }
}

/**
 * Intelligent Procedural Race Engineer fallback if AI API is offline or rate-limited
 */
function generateProceduralEngineerResponse(
  userQuery: string,
  sim: string,
  setupContext?: any,
  telemetryContext?: any
): string {
  const query = userQuery.toLowerCase();
  const car = setupContext?.car || "your car";
  const track = setupContext?.track || "this circuit";

  if (query.includes("oversteer") && (query.includes("entry") || query.includes("trail") || query.includes("braking"))) {
    return `Copy driver, entry oversteer under trail braking is usually caused by excessive forward weight transfer unloading the rear axle or differential coast lock releasing too abruptly.

Here is what we recommend on the telemetry data for ${sim}:
• **Rear Anti-Roll Bar**: Soften by 1 step (increases rear mechanical grip during corner entry roll).
• **Differential Coast / Preload**: Increase coast lock (+5% to +10%) or bump preload by +10–15 Nm to keep the rear axle unified under deceleration.
• **Front Brake Bias**: Shift forward by +0.8% to +1.2% to stabilize the rear under heavy initial braking.
• **Front Bump / Rear Rebound Dampers**: Add 1 click front bump or soften rear rebound by 1–2 clicks to slow down forward pitch rate.

Driving note: smooth out your brake release on turn-in. If you snap off the brake pedal instantly, the rear unweights and steps out.`;
  }

  if (query.includes("understeer") || query.includes("push") || query.includes("scrub")) {
    return `Understood driver. The front end is washing out and scrubbing front tyre compound. Looking at the setup baseline for ${car} at ${track}:

To induce turn-in rotation and cure front push:
• **Front Anti-Roll Bar**: Drop by 1 notch (softening front roll stiffness increases front mechanical grip).
• **Front Toe**: Add negative toe (toe-out) by -2 to -4 clicks or -0.05° to sharpen initial steering turn-in response.
• **Front Ride Height / Aero Rake**: Drop front ride height by 2–3mm or raise rear ride height by 3mm to shift aerodynamic balance forward.
• **Brake Bias**: Move rearward by 0.5%–1.0% to allow the car to pivot around the center of mass under trail braking.

Monitor your steering input: if you exceed 90° of wheel lock while the car is pushing, you're scrubbing grip. Back off the steering angle slightly to let the front bite.`;
  }

  if (query.includes("tyre") || query.includes("pressure") || query.includes("temp") || query.includes("psi")) {
    const t = telemetryContext?.tyres;
    const flP = t?.FL?.pressure || "26.8 psi";
    const frP = t?.FR?.pressure || "27.1 psi";

    return `Radio check driver, let's review your tyre telemetry.
Current hot readings: FL at ${flP}, FR at ${frP}.

For ${sim}:
• **Target Operating Window**: GT3 slicks operate best at 26.8–27.2 psi hot. If you're building beyond 27.5 psi, you'll lose lateral traction and overheat the shoulders.
• **Asymmetric Loading**: On clockwise circuits like Spa and Monza, the front-left and rear-left take high lateral load. Start cold pressures on the left side roughly 0.3–0.5 psi lower than the right to equalize hot pressures mid-stint.
• **Camber Adjustment**: If inner temps are >15°C hotter than outer temps, decrease negative camber by 0.2° to prevent blistering on the inside shoulder.`;
  }

  if (query.includes("turn 1") || query.includes("t1") || query.includes("hairpin") || query.includes("la source")) {
    return `Looking at the Turn 1 telemetry trace:
The key to Turn 1 is squaring off the exit for maximum traction onto the following straight.
• **Braking**: Peak deceleration needs to happen in a straight line before steering lock. Don't carry deep trail-braking past the apex or you'll delay throttle pickup.
• **Mechanical Setup Fix**: If you're getting exit power oversteer out of the hairpin, soften rear suspension spring rates or lower rear tyre pressures by 0.2 psi to plant the rear contact patch.`;
  }

  if (query.includes("kerb") || query.includes("bump") || query.includes("chicane")) {
    return `Copy driver. When attacking chicanes like the Bus Stop or Ascari, kerb compliance is determined by your fast damper valving.

Recommended adjustments for ${sim}:
• **Fast Bump Dampers**: Soften front and rear fast-bump by 2 clicks. This allows the suspension to compress quickly over kerb strikes without kicking the chassis into the air.
• **Bump Stop Range**: Increase bump stop window by 3–5mm so the suspension doesn't abruptly hit the hard rubber stops over aggressive kerbing.`;
  }

  // General Technical Debrief
  return `Copy driver, loud and clear on pit wall telemetry.
Looking at ${car} around ${track} in ${sim}:

Our primary focus is optimizing the transition between trail-braking and throttle commit. Let me know specifically:
1. Are you struggling with low-speed mechanical turn-in or high-speed aerodynamic stability?
2. How is tyre wear and pressure drift progressing through your stint?
3. Which specific corner or sector is costing you the most lap time against your target?

Give me your feedback and I'll call out the exact click adjustments to make in the garage.`;
}
