import { SetupEngineRequest, SetupEngineResult, SetupChange } from "./types";
import { getAuthoritativeCatalog, parseNumericValue, findParameterDefinition } from "./parameter-catalog";
import { buildBaselineSetup } from "./baseline-generator";
import { formulateDiagnosticPlan } from "./causal-diagnostics";
import { validateAndRepairSetup } from "./validator";
import { callGroqWithFallback } from "../groq";
import { getGameSetupProfile } from "../game-setup-profiles";
import { detectChassisArchetype } from "../chassis-archetypes";
import { getCircuitAeroProfile } from "../circuit-aero-profiles";
import { SetupSection } from "@/types/telemetry";

/**
 * ============================================================================
 * HYBRID SETUP GENERATION ENGINE // APEXWALL AI
 * ============================================================================
 * Coordinates:
 * 1. Deterministic baseline establishment
 * 2. Causal vehicle-dynamics diagnosis
 * 3. Bounded LLM reasoning & trade-off explanation
 * 4. Deterministic post-generation validation, step-snapping, and repair
 * 5. Comprehensive structured diff calculation and test protocol
 * ============================================================================
 */

export async function generateCalibratedSetup(
  request: SetupEngineRequest
): Promise<SetupEngineResult> {
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
    handlingIssue = "None stated, optimize for a balanced conservative baseline",
    skillLevel,
    customModProfile,
    baselineSetup,
    telemetryContext,
    fullBaselineRequested = false,
  } = request;

  // 1. Resolve Authoritative Simulator Knowledge Base
  const profile = getGameSetupProfile(game);
  const archetype = detectChassisArchetype(car, game);
  const aeroProfile = getCircuitAeroProfile(track);
  const catalog = getAuthoritativeCatalog(game, car, customModProfile);

  // 2. Establish or Preserve Baseline Setup
  const baseline = buildBaselineSetup(
    game,
    car,
    track,
    {
      sessionType,
      weather,
      trackTemp,
      airTemp,
      fuelLoad,
      tyreCompound,
      driverStyle,
      handlingIssue,
      skillLevel,
    },
    baselineSetup,
    fullBaselineRequested
  );

  // 3. Formulate Causal Diagnostic Plan (Enforce Anti-Shotgun & Causal Ordering)
  const diagnosticPlan = formulateDiagnosticPlan(
    handlingIssue,
    catalog,
    telemetryContext,
    aeroProfile
  );

  // If driver technique is the primary limiter, note it prominently
  let engineerNotes = "";
  if (diagnosticPlan.driverTechniqueFlag) {
    engineerNotes = `Driver coaching note: ${diagnosticPlan.driverTechniqueFlag} Before making aggressive mechanical setup changes, prioritize smoother pedal modulation. `;
  }

  // 4. Bounded LLM Prompt Formulation
  // Instead of asking the LLM to invent 50 numbers, we give it the exact 1-3 target parameters
  // and require it to explain the causal trade-offs.
  const targetDefSummary = diagnosticPlan.primaryTargetParams
    .map((k) => {
      const def = findParameterDefinition(catalog, k);
      if (!def) return null;
      const baseVal = baseline.parameterMap.get(def.label.toLowerCase().trim())?.value ?? `${def.defaultValue}`;
      return `• [${def.menuTab}] ${def.label}: Current Baseline "${baseVal}", Legal Range [${def.min} to ${def.max}], Step: ${def.step}`;
    })
    .filter(Boolean)
    .join("\n");

  const telemetryBrief = diagnosticPlan.hasTelemetryEvidence
    ? `AUTHENTIC TELEMETRY EVIDENCE DETECTED:\n${diagnosticPlan.evidenceFound.map((e) => `• ${e}`).join("\n")}`
    : "NOTE: No dynamic telemetry file was provided. Do NOT claim 'telemetry shows'; ground your reasoning in the stated setup context and vehicle dynamics physics.";

  const systemPrompt = `You are the Lead Race Engineer for ${profile.displayName}.
You are diagnosing a specific handling complaint: "${handlingIssue}".
You must adhere to the CAUSAL ORDERING of vehicle dynamics: Driver Input -> Tyre State -> Vehicle Balance -> Mechanical Platform -> Aero Platform -> Drivetrain -> Dampers.

CONSTRAINTS:
1. NEVER invent a new complete car setup or shotgun random changes across multiple subsystems.
2. The current baseline setup is already established. You are permitted to modify ONLY these 1-3 primary target parameters:
${targetDefSummary}
3. All changes MUST be conservative (1-3 clicks, small deltas).
4. Every change must explicitly state its DESIRED EFFECT and its unavoidable TRADE-OFF (no change is free).
5. Output ONLY valid JSON matching this exact structure:

{
  "summary": "2-3 sentence engineer's summary explaining the diagnosis and setup philosophy",
  "proposedAdjustments": [
    {
      "parameter": "Exact parameter label from list above",
      "newValue": "Numeric value with units (e.g. 26.2 psi, 4 / 10, -3.2°)",
      "diagnosis": "Specific mechanical or aerodynamic cause identified",
      "rationale": "Physics mechanism explaining why this change was selected",
      "tradeoff": "Secondary physical downside or compromise introduced",
      "expectedEffect": "Measurable handling response expected on track",
      "validationTest": "Specific 2-3 lap test procedure to evaluate if this change succeeded"
    }
  ],
  "engineerRadio": "2-3 sentences talking to the driver over team radio explaining the planned test order"
}`;

  const userBrief = `
Car: ${car} (${archetype.displayName})
Track: ${track} (${aeroProfile.tierName})
Weather: ${weather || "Dry"}, Track Temp: ${trackTemp || "30°C"}, Air Temp: ${airTemp || "22°C"}
Handling Issue / Target: ${handlingIssue}
Driver Technique Context: ${driverStyle || "Standard"}
${telemetryBrief}
`.trim();

  let proposedAdjustments: any[] = [];
  let summaryText = baseline.summary;

  // If user explicitly requested a full baseline, skip adjustments and preserve pure baseline
  if (fullBaselineRequested) {
    proposedAdjustments = [];
  } else {
    try {
      const aiResponse: any = await callGroqWithFallback(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userBrief },
        ],
        1800,
        0.3
      );

      if (aiResponse && Array.isArray(aiResponse.proposedAdjustments)) {
        proposedAdjustments = aiResponse.proposedAdjustments;
        summaryText = aiResponse.summary || summaryText;
        if (aiResponse.engineerRadio) {
          engineerNotes += aiResponse.engineerRadio;
        }
      }
    } catch (err: any) {
      console.warn("LLM bounded reasoning fallback:", err?.message || err);
      // Deterministic fallback adjustment if LLM fails
      proposedAdjustments = diagnosticPlan.primaryTargetParams.slice(0, 2).map((k) => {
        const def = findParameterDefinition(catalog, k);
        if (!def) return null;
        const baseItem = baseline.parameterMap.get(def.label.toLowerCase().trim());
        const baseNum = baseItem?.numericVal ?? def.defaultValue;
        const deltaInfo = diagnosticPlan.allowedDeltas[k] || { maxSteps: 1, maxAbsDelta: def.step };
        const direction = deltaInfo.preferredDirection === "decrease" ? -1 : 1;
        const newNum = baseNum + direction * def.step;
        const formatted = def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`;

        return {
          parameter: def.label,
          newValue: formatted,
          diagnosis: diagnosticPlan.primaryLimiter,
          rationale: diagnosticPlan.tradeoffsConsidered.desired,
          tradeoff: diagnosticPlan.tradeoffsConsidered.secondaryRisk,
          expectedEffect: "Targeted mechanical balance adjustment",
          validationTest: "Run a 3-lap stint comparing telemetry throttle pickup and lateral slip.",
        };
      }).filter(Boolean);
    }
  }

  // If dynamic telemetry detected tyre thermal/pressure discrepancies, inject empirical tyre adjustments
  if (!fullBaselineRequested && telemetryContext?.tyreOptimization?.recommendedCold) {
    const to = telemetryContext.tyreOptimization;
    const wheels = ["FL", "FR", "RL", "RR"] as const;
    const hasDiscrepancy = wheels.some((w) => {
      const v = (to.pressureDelta as any)?.[w];
      return v != null && Math.abs(v) >= 0.3;
    });
    if (hasDiscrepancy) {
      wheels.forEach((w) => {
        const paramId = `TYRE_PRESSURE_${w}`;
        const def = findParameterDefinition(catalog, paramId);
        if (!def) return;
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const rawRec = (to.recommendedCold as any)[w];
          const recCold = rawRec != null ? Number(rawRec) : null;
          if (recCold != null && !isNaN(recCold) && recCold > 0) {
            const rawDelta = (to.pressureDelta as any)?.[w];
            const rawObsHot = (to.observedHot as any)?.[w];
            const delta = rawDelta != null ? Number(rawDelta) : null;
            const obsHot = rawObsHot != null ? Number(rawObsHot) : null;
            proposedAdjustments.push({
              parameter: def.label,
              newValue: def.formatDisplay ? def.formatDisplay(recCold) : `${recCold.toFixed(1)} psi`,
              diagnosis: `Hot tyre pressure offset on ${w} (${obsHot != null ? `${obsHot.toFixed(1)} psi` : "—"} vs target ${to.targetHot != null ? `${to.targetHot.toFixed(1)} psi` : "26.8 psi"})`,
              rationale: `Calibrated cold pressure adjusted by ${delta != null ? `${delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} psi` : "optimal margin"} to bring running hot pressures into optimal contact patch window.`,
              tradeoff: "None (thermodynamic pressure alignment).",
              expectedEffect: "Even contact patch pressure distribution and maximum tyre grip.",
              validationTest: "Run 3 hotlaps and verify hot pressure reaches target window.",
            });
          }
        }
      });
    }
  }

  // 5. Apply Proposed Adjustments to Baseline Sections
  const modifiedSections: SetupSection[] = baseline.sections.map((sec) => ({
    title: sec.title,
    items: sec.items.map((it) => {
      const matchingAdj = proposedAdjustments.find(
        (adj) => adj.parameter && adj.parameter.toLowerCase().trim() === it.label.toLowerCase().trim()
      );
      if (matchingAdj && matchingAdj.newValue) {
        return {
          label: it.label,
          value: String(matchingAdj.newValue),
          styleNote: matchingAdj.expectedEffect || it.styleNote,
        };
      }
      return { ...it };
    }),
  }));

  // 6. Post-Generation Deterministic Validation & Repair Pass
  const validation = validateAndRepairSetup(modifiedSections, {
    game,
    car,
    catalog,
    baseline,
    allowedTargetParams: fullBaselineRequested
      ? []
      : diagnosticPlan.primaryTargetParams.concat(diagnosticPlan.secondaryTargetParams),
    maxDeltas: diagnosticPlan.allowedDeltas,
  });

  // 7. Calculate Structured Parameter Diff (SetupChange[])
  const finalChanges: SetupChange[] = [];

  if (!fullBaselineRequested) {
    validation.repairedSections.forEach((sec) => {
      sec.items.forEach((it) => {
        const baseItem = baseline.parameterMap.get(it.label.toLowerCase().trim());
        const baseVal = baseItem ? baseItem.value : "N/A";
        if (baseItem && baseItem.value !== it.value) {
          const baseNum = baseItem.numericVal;
          const newNum = parseNumericValue(it.value);
          if (baseNum !== null && newNum !== null && Math.abs(baseNum - newNum) < 0.0001) {
            return;
          }

          const adj = proposedAdjustments.find(
            (a) => a.parameter && a.parameter.toLowerCase().trim() === it.label.toLowerCase().trim()
          );

          finalChanges.push({
            parameter: it.label,
            oldValue: baseVal,
            newValue: it.value,
            delta: `${baseVal} → ${it.value}`,
            evidence: diagnosticPlan.evidenceFound,
            diagnosis: adj?.diagnosis || diagnosticPlan.primaryLimiter,
            rationale: adj?.rationale || diagnosticPlan.tradeoffsConsidered.desired,
            tradeoff: adj?.tradeoff || diagnosticPlan.tradeoffsConsidered.secondaryRisk,
            expectedEffect: adj?.expectedEffect || "Improved phase-specific balance and tyre contact patch stability",
            confidence: diagnosticPlan.confidence,
            validationTest: adj?.validationTest || "Complete a 3-lap benchmark stint; measure apex minimum speed and exit throttle pickup.",
          });
        }
      });
    });
  }

  // 8. Test Order & Protocol Formulation
  const testOrder: string[] = [];
  if (finalChanges.length > 0) {
    finalChanges.forEach((ch, idx) => {
      testOrder.push(`Step ${idx + 1}: Apply ${ch.parameter} (${ch.delta}). Run 3 laps. ${ch.validationTest}`);
    });
    testOrder.push(`Step ${finalChanges.length + 1}: Check tyre pressures and core temps; only proceed to secondary changes if balance remains limited.`);
  } else {
    testOrder.push("Baseline configuration confirmed. Run a 5-lap baseline evaluation stint to log reference telemetry.");
  }

  const knownLimitations: string[] = [];
  if (!diagnosticPlan.hasTelemetryEvidence) {
    knownLimitations.push("No dynamic telemetry trace provided: recommendations are derived from vehicle dynamics priors rather than measured wheel slip.");
  }
  if (finalChanges.some((c) => c.tradeoff)) {
    knownLimitations.push(`Trade-off note: ${finalChanges.map((c) => `${c.parameter}: ${c.tradeoff}`).join("; ")}`);
  }

  if (!engineerNotes) {
    engineerNotes = `Radio check driver: setup sheet prepared with ${finalChanges.length} targeted adjustment${finalChanges.length === 1 ? "" : "s"} to address ${diagnosticPlan.primaryLimiter.toLowerCase()}. We're testing one subsystem at a time to keep the car balanced.`;
  }

  return {
    summary: summaryText,
    setupPhilosophy: `${diagnosticPlan.phase} phase optimization: ${diagnosticPlan.primaryLimiter}. Operating with ${finalChanges.length} measured adjustment(s) from baseline.`,
    primaryLimiter: diagnosticPlan.primaryLimiter,
    isBaseline: baseline.isBaseline && finalChanges.length === 0,
    sections: validation.repairedSections,
    changes: finalChanges,
    evidence: diagnosticPlan.evidenceFound,
    rationale: diagnosticPlan.tradeoffsConsidered.desired,
    tradeoff: diagnosticPlan.tradeoffsConsidered.secondaryRisk,
    expectedEffect: "Targeted correction with minimum intervention set.",
    confidence: diagnosticPlan.confidence,
    testOrder,
    knownLimitations,
    engineerNotes,
    validationStatus: validation.report,
  };
}
