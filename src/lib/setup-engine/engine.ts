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

  // 4b. Dynamic Telemetry Closed-Loop Damper Adjustments
  if (!fullBaselineRequested && telemetryContext?.damperHistograms?.corners) {
    const dh = telemetryContext.damperHistograms.corners;
    const flBump = dh.FL?.bumpPct ?? 50;
    const frBump = dh.FR?.bumpPct ?? 50;
    const rlBump = dh.RL?.bumpPct ?? 50;
    const rrBump = dh.RR?.bumpPct ?? 50;

    // Front Dampers
    if (flBump > 56 || frBump > 56 || dh.FL?.isPackingDown || dh.FR?.isPackingDown) {
      const def = findParameterDefinition(catalog, "BUMP_SLOW_F");
      if (def) {
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const baseItem =
            baseline.parameterMap.get(def.label.toLowerCase().trim()) ||
            baseline.parameterMap.get(def.id.toLowerCase().trim());
          const baseNum = baseItem?.numericVal ?? def.defaultValue;
          const newNum = Math.max(def.min, baseNum - 2 * def.step);
          proposedAdjustments.push({
            parameter: def.label,
            newValue: def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`,
            diagnosis: `MoTeC damper histogram detected front compression over-damping (${Math.round(flBump)}% FL / ${Math.round(frBump)}% FR bump). Front axle packs down over road undulations.`,
            rationale: `Softening slow bump damping by 2 clicks allows the front suspension to compress and absorb road ripples instead of skipping across the surface.`,
            tradeoff: `Slightly softer pitch support during initial hard braking entry.`,
            expectedEffect: `Reduced front axle skitter and improved compliance over kerbs and bumps.`,
            validationTest: `Run 3 laps and verify damper velocity histogram moves closer to 50/50 symmetric distribution.`,
          });
        }
      }
    } else if (flBump < 44 || frBump < 44) {
      const def = findParameterDefinition(catalog, "REBOUND_SLOW_F");
      if (def) {
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const baseItem =
            baseline.parameterMap.get(def.label.toLowerCase().trim()) ||
            baseline.parameterMap.get(def.id.toLowerCase().trim());
          const baseNum = baseItem?.numericVal ?? def.defaultValue;
          const newNum = Math.max(def.min, baseNum - 2 * def.step);
          proposedAdjustments.push({
            parameter: def.label,
            newValue: def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`,
            diagnosis: `MoTeC damper histogram detected front extension over-damping (${Math.round(100 - flBump)}% FL / ${Math.round(100 - frBump)}% FR rebound). Front suspension slow to return.`,
            rationale: `Softening slow rebound allows the front tyres to follow road depressions and maintain continuous contact patch grip.`,
            tradeoff: `Slightly more chassis rebound bounce over sudden crests.`,
            expectedEffect: `Improved mechanical grip and contact patch fidelity under weight transfer.`,
            validationTest: `Run 3 laps; monitor suspension potentiometer extension rates.`,
          });
        }
      }
    }

    // Rear Dampers
    if (rlBump > 56 || rrBump > 56 || dh.RL?.isPackingDown || dh.RR?.isPackingDown) {
      const def = findParameterDefinition(catalog, "BUMP_SLOW_R");
      if (def) {
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const baseItem =
            baseline.parameterMap.get(def.label.toLowerCase().trim()) ||
            baseline.parameterMap.get(def.id.toLowerCase().trim());
          const baseNum = baseItem?.numericVal ?? def.defaultValue;
          const newNum = Math.max(def.min, baseNum - 2 * def.step);
          proposedAdjustments.push({
            parameter: def.label,
            newValue: def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`,
            diagnosis: `MoTeC damper histogram detected rear compression over-damping (${Math.round(rlBump)}% RL / ${Math.round(rrBump)}% RR bump).`,
            rationale: `Softening rear slow bump allows the rear axle to absorb kerb strikes without kicking the rear into snap oversteer.`,
            tradeoff: `Slightly more rear squat under hard acceleration.`,
            expectedEffect: `Enhanced rear traction over bumps and kerbs.`,
            validationTest: `Check exit traction out of chicane kerbs over 3 laps.`,
          });
        }
      }
    }
  }

  // 4c. Dynamic Telemetry Closed-Loop Aero Platform & Ride Height
  if (!fullBaselineRequested && telemetryContext?.aeroMap) {
    const am = telemetryContext.aeroMap;
    const minFront = am.minFrontRideHeightMm != null ? Number(am.minFrontRideHeightMm) : null;
    const groundingEvents = Array.isArray(am.groundingEvents) ? am.groundingEvents : [];

    if ((minFront != null && minFront < 5.5) || groundingEvents.length > 0) {
      const def = findParameterDefinition(catalog, "RIDE_HEIGHT_F") || findParameterDefinition(catalog, "FRONT_RIDE_HEIGHT");
      if (def) {
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const baseItem =
            baseline.parameterMap.get(def.label.toLowerCase().trim()) ||
            baseline.parameterMap.get(def.id.toLowerCase().trim());
          const baseNum = baseItem?.numericVal ?? def.defaultValue;
          const newNum = Math.min(def.max, baseNum + 2 * def.step);
          proposedAdjustments.push({
            parameter: def.label,
            newValue: def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`,
            diagnosis: `Dynamic Aero Map detected front platform collapse (min front ride height ${minFront != null ? `${minFront.toFixed(1)}mm` : "<5.5mm"}, ${groundingEvents.length} grounding event(s)).`,
            rationale: `Raising front static ride height by +2mm prevents splitter scraping and maintains consistent underbody ground-effect diffuser sealing under peak braking load.`,
            tradeoff: `Minor reduction in straight-line top speed from frontal area increase.`,
            expectedEffect: `Eliminates splitter stall and maintains predictable aerodynamic balance during high-speed braking.`,
            validationTest: `Inspect high-speed braking zones in telemetry; verify min front ride height stays above 5.5mm.`,
          });
        }
      }
    }
  }

  // 4d. Endurance Stint Tyre Degradation Camber Trimming
  if (!fullBaselineRequested && telemetryContext?.enduranceStrategy?.tyreDegradation) {
    const td = telemetryContext.enduranceStrategy.tyreDegradation;
    if (td.degradationRatePerLapSeconds > 0.08 && (td.limitingTyreCorner === "FL" || td.limitingTyreCorner === "FR")) {
      const def = findParameterDefinition(catalog, "CAMBER_FRONT");
      if (def) {
        const alreadyProposed = proposedAdjustments.some(
          (a) => a.parameter && a.parameter.toLowerCase().trim() === def.label.toLowerCase().trim()
        );
        if (!alreadyProposed) {
          const baseItem =
            baseline.parameterMap.get(def.label.toLowerCase().trim()) ||
            baseline.parameterMap.get(def.id.toLowerCase().trim());
          const baseNum = baseItem?.numericVal ?? def.defaultValue;
          const newNum = Math.min(def.max, baseNum + 2 * def.step);
          proposedAdjustments.push({
            parameter: def.label,
            newValue: def.formatDisplay ? def.formatDisplay(newNum) : `${newNum}`,
            diagnosis: `Endurance degradation rate is critical (+${td.degradationRatePerLapSeconds.toFixed(3)}s/lap) limited by front axle inside shoulder thermal scrub.`,
            rationale: `Backing off front negative camber by 0.2° distributes tyre contact pressure more evenly across the tread, cooling the inside edge and slowing thermal degradation.`,
            tradeoff: `Approx. 1% loss in peak steady-state lateral G at absolute limit.`,
            expectedEffect: `Extends stint tyre lifespan by 4-6 laps and flattens lap time degradation slope.`,
            validationTest: `Run a 5-lap stint; verify front tyre temperature spread across Inner-Middle-Outer remains within 8°C.`,
          });
        }
      }
    }
  }

  // 5. Apply Proposed Adjustments to Baseline Sections
  const modifiedSections: SetupSection[] = baseline.sections.map((sec) => ({
    title: sec.title,
    items: sec.items.map((it) => {
      const itDef = findParameterDefinition(catalog, it.label);
      const matchingAdj = proposedAdjustments.find((adj) => {
        if (!adj.parameter) return false;
        const adjTrim = adj.parameter.toLowerCase().trim();
        const itTrim = it.label.toLowerCase().trim();
        if (adjTrim === itTrim) return true;
        if (itDef) {
          const adjDef = findParameterDefinition(catalog, adj.parameter);
          if (adjDef && adjDef.id === itDef.id) return true;
        }
        return false;
      });
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
      : diagnosticPlan.primaryTargetParams
          .concat(diagnosticPlan.secondaryTargetParams)
          .concat(
            proposedAdjustments.map((a) => {
              const d = findParameterDefinition(catalog, a.parameter);
              return d?.id || "";
            }).filter(Boolean)
          ),
    maxDeltas: diagnosticPlan.allowedDeltas,
  });

  // 7. Calculate Structured Parameter Diff (SetupChange[])
  const finalChanges: SetupChange[] = [];

  if (!fullBaselineRequested) {
    validation.repairedSections.forEach((sec) => {
      sec.items.forEach((it) => {
        const itDef = findParameterDefinition(catalog, it.label);
        const baseItem =
          baseline.parameterMap.get(it.label.toLowerCase().trim()) ||
          (itDef ? baseline.parameterMap.get(itDef.id.toLowerCase().trim()) : undefined) ||
          (itDef ? baseline.parameterMap.get(itDef.label.toLowerCase().trim()) : undefined);
        const baseVal = baseItem ? baseItem.value : "N/A";
        if (baseItem && baseItem.value !== it.value) {
          const baseNum = baseItem.numericVal;
          const newNum = parseNumericValue(it.value);
          if (baseNum !== null && newNum !== null && Math.abs(baseNum - newNum) < 0.0001) {
            return;
          }

          const adj = proposedAdjustments.find((a) => {
            if (!a.parameter) return false;
            const aTrim = a.parameter.toLowerCase().trim();
            const itTrim = it.label.toLowerCase().trim();
            if (aTrim === itTrim) return true;
            if (itDef) {
              const aDef = findParameterDefinition(catalog, a.parameter);
              if (aDef && aDef.id === itDef.id) return true;
            }
            return false;
          });

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
