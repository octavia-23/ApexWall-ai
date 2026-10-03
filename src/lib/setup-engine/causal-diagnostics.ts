import { HandlingProblemPhase, SetupDiagnosticPlan, ParameterDefinition } from "./types";
import { findParameterDefinition } from "./parameter-catalog";

/**
 * ============================================================================
 * VEHICLE-DYNAMICS CAUSAL REASONING & DIAGNOSTIC ENGINE
 * ============================================================================
 * Dissects handling complaints by corner phase (Entry, Mid, Exit, High-Speed, Kerbs).
 * Enforces causal ordering:
 * 1. DRIVER INPUT
 * 2. TYRE STATE
 * 3. VEHICLE BALANCE
 * 4. MECHANICAL PLATFORM
 * 5. AERO PLATFORM
 * 6. DRIVETRAIN
 * 7. DAMPERS
 * 8. SECONDARY COMPENSATION
 *
 * Prevents "shotgun setups" by identifying:
 * - Primary Cause (1-3 parameters)
 * - Secondary Contributors (0-2 parameters)
 * - Non-Cause / Protected Baseline Parameters (everything else)
 *
 * Enforces conservative delta limits and transparent trade-offs.
 * ============================================================================
 */

export interface TelemetryEvidenceExtraction {
  hasTelemetry: boolean;
  driverTechniqueIssue?: string;
  observedPhenomena: string[];
  missingChannels: string[];
}

export function extractTelemetryEvidence(telemetryContext: any): TelemetryEvidenceExtraction {
  if (!telemetryContext || Object.keys(telemetryContext).length === 0) {
    return {
      hasTelemetry: false,
      observedPhenomena: [],
      missingChannels: ["All telemetry channels missing (telemetry file not provided)"],
    };
  }

  const observed: string[] = [];
  const missing: string[] = [];
  let driverTechniqueIssue: string | undefined = undefined;

  // 1. Check Driver Input (Braking & Throttle)
  if (telemetryContext.trailBrakingScore != null) {
    if (telemetryContext.trailBrakingScore < 50) {
      driverTechniqueIssue = `Abrupt brake release detected (trail-braking score: ${telemetryContext.trailBrakingScore}/100). Chassis pitch snaps forward rather than smooth weight transfer.`;
      observed.push(`Driver trail-braking efficiency is low (${telemetryContext.trailBrakingScore}/100)`);
    } else {
      observed.push(`Driver trail-braking is proficient (${telemetryContext.trailBrakingScore}/100)`);
    }
  } else {
    missing.push("Brake pressure / trail-braking trace");
  }

  // 2. Check Grip Utilization
  if (telemetryContext.gripUtilization != null) {
    observed.push(`Peak friction circle grip utilization: ${telemetryContext.gripUtilization}%`);
  }

  // 3. Check Corner Speed Deltas
  if (Array.isArray(telemetryContext.keyCorners) && telemetryContext.keyCorners.length > 0) {
    telemetryContext.keyCorners.slice(0, 3).forEach((c: any) => {
      if (c.verdict) observed.push(`${c.corner}: ${c.verdict} (Δ ${c.speedDelta} km/h)`);
    });
  }

  // 4. Check Tyre Pressures & Temps
  if (telemetryContext.tyres) {
    observed.push("Telemetry tyre pressures and surface temperatures logged");
  } else {
    missing.push("Dynamic tyre surface & core temperatures");
  }

  // 5. Check Corner-Phase Understeer / Oversteer Balance
  if (telemetryContext.phaseBalance) {
    const pb = telemetryContext.phaseBalance;
    observed.push(`Measured Corner Phase Balance: ${pb.verdict} (Entry Δ: ${pb.entryDeltaDeg}°, Apex Δ: ${pb.midDeltaDeg}°, Exit Δ: ${pb.exitDeltaDeg}°)`);
  }

  // 6. Check Empirical Tyre Pressure Optimization
  if (telemetryContext.tyreOptimization?.recommendedCold) {
    const opt = telemetryContext.tyreOptimization;
    const fmtCold = (v: number | null) => (v != null ? `${v}` : "—");
    const fmtDelta = (v: number | null) => (v != null ? `${v >= 0 ? "+" : ""}${v}` : "—");
    observed.push(
      `Calibrated Cold Pressures: FL ${fmtCold(opt.recommendedCold.FL)}, FR ${fmtCold(opt.recommendedCold.FR)}, RL ${fmtCold(opt.recommendedCold.RL)}, RR ${fmtCold(opt.recommendedCold.RR)} psi (Target hot: ${opt.targetHot != null ? opt.targetHot : "—"} psi, Δ: FL ${fmtDelta(opt.pressureDelta.FL)}, FR ${fmtDelta(opt.pressureDelta.FR)}, RL ${fmtDelta(opt.pressureDelta.RL)}, RR ${fmtDelta(opt.pressureDelta.RR)} psi)`
    );
  }

  // 7. Check Driver vs Mechanical Separation
  if (telemetryContext.driverVsCar?.driverTechniquePoints?.length > 0) {
    const primaryTechnique = telemetryContext.driverVsCar.driverTechniquePoints[0];
    if (!driverTechniqueIssue && !primaryTechnique.includes("disciplined")) {
      driverTechniqueIssue = primaryTechnique;
    }
  }

  return {
    hasTelemetry: observed.length > 0,
    driverTechniqueIssue,
    observedPhenomena: observed,
    missingChannels: missing,
  };
}

export function classifyHandlingPhase(complaint: string): HandlingProblemPhase {
  const raw = (complaint || "").toLowerCase();

  // 1. Kerbs & Surface Compliance takes highest priority when mentioned
  if (/kerb|curb|chicane curb|bottoming|bouncing|bounces|pothole/i.test(raw)) {
    return "KERBS";
  }
  // 2. High-speed flow & aerodynamic load
  if (/high speed|high-speed|copse|blanchimont|fast sweeper|fast bend|top speed/i.test(raw)) {
    return "HIGH_SPEED";
  }
  // 3. Entry & Braking phase
  if (/trail|entry|braking|brake|turn-in|turn in|downshift/i.test(raw)) {
    return "ENTRY";
  }
  // 4. Exit & Traction phase
  if (/exit|power|throttle|squat|traction|acceleration/i.test(raw)) {
    return "EXIT";
  }
  // 5. Mid-corner steady state
  if (/apex|mid-corner|mid corner|middle of the corner|long sweeper|steady state/i.test(raw)) {
    return "MID_CORNER";
  }
  // 6. Tyre Thermal degradation
  if (/tyre wear|overheating|blister|cold tyre|grain/i.test(raw)) {
    return "TYRES_THERMAL";
  }
  // 7. Straight line drag
  if (/straight|drag|terminal velocity/i.test(raw)) {
    return "STRAIGHT";
  }

  return "GENERAL";
}

/**
 * Derives a targeted, non-shotgun diagnostic plan adhering to causal ordering.
 */
export function formulateDiagnosticPlan(
  complaint: string,
  catalog: ParameterDefinition[],
  telemetryContext?: any,
  trackProfile?: any
): SetupDiagnosticPlan {
  let phase = classifyHandlingPhase(complaint);
  const raw = (complaint || "").toLowerCase();
  const telExtraction = extractTelemetryEvidence(telemetryContext);

  // If user complaint is general or empty, but dynamic telemetry detected an understeer/oversteer gradient:
  if (phase === "GENERAL" && telemetryContext?.phaseBalance) {
    const pb = telemetryContext.phaseBalance;
    const entryMag = Math.abs(pb.entryDeltaDeg || 0);
    const midMag = Math.abs(pb.midDeltaDeg || 0);
    const exitMag = Math.abs(pb.exitDeltaDeg || 0);
    const maxMag = Math.max(entryMag, midMag, exitMag);

    if (maxMag >= 1.0) {
      if (maxMag === exitMag && pb.exit !== "Neutral") {
        phase = "EXIT";
      } else if (maxMag === midMag && pb.mid !== "Neutral") {
        phase = "MID_CORNER";
      } else if (maxMag === entryMag && pb.entry !== "Neutral") {
        phase = "ENTRY";
      }
    }
  }

  let primaryLimiter = "General balance and platform calibration";
  let primaryTargetParams: string[] = [];
  let secondaryTargetParams: string[] = [];
  let doNotTouchParams: string[] = [];
  let allowedDeltas: Record<string, { maxSteps: number; maxAbsDelta: number; preferredDirection?: "increase" | "decrease" }> = {};
  let tradeoffsConsidered = { desired: "Improved lap time and stability", secondaryRisk: "Potential platform stiffness compromise" };
  let confidence: "HIGH" | "MEDIUM" | "LOW" = telExtraction.hasTelemetry ? "HIGH" : "MEDIUM";

  // Check if driver technique is the true root cause before modifying mechanical setup
  let driverTechniqueFlag = telExtraction.driverTechniqueIssue;

  // --------------------------------------------------------------------------
  // CAUSAL PHASE DISPATCH
  // --------------------------------------------------------------------------

  if (phase === "EXIT") {
    // E.g. Snap oversteer on exit / traction loss under power
    if (/snap|oversteer|loose|wheelspin/i.test(raw)) {
      primaryLimiter = "Rear axle lateral traction breakdown under throttle pickup";
      // Causal ordering: Drivetrain (Power lock) & Mechanical roll stiffness (Rear ARB)
      primaryTargetParams = ["DIFF_POWER", "DIFF_ON_THROTTLE", "ARB_REAR", "REAR_ARB"];
      secondaryTargetParams = ["REBOUND_SLOW_F", "TYRE_PRESSURE_RL", "TYRE_PRESSURE_RR"];
      doNotTouchParams = ["FRONT_WING", "FRONT_WING_AERO", "REAR_WING", "FRONT_CAMBER", "FRONT_SUSPENSION", "ABS"];

      allowedDeltas = {
        DIFF_POWER: { maxSteps: 2, maxAbsDelta: 10, preferredDirection: "decrease" },
        DIFF_ON_THROTTLE: { maxSteps: 4, maxAbsDelta: 5, preferredDirection: "decrease" },
        ARB_REAR: { maxSteps: 1, maxAbsDelta: 2, preferredDirection: "decrease" },
        REAR_ARB: { maxSteps: 1, maxAbsDelta: 2, preferredDirection: "decrease" },
      };

      tradeoffsConsidered = {
        desired: "Softer rear roll resistance & lower diff lock improves corner-exit traction and prevents sudden torque snap",
        secondaryRisk: "Slightly delayed initial throttle rotation; may induce mild mid-to-exit understeer if rear ARB is softened too far",
      };
    } else {
      // Exit understeer (pushing wide on power)
      primaryLimiter = "Front axle scrub under acceleration / excessive diff lock";
      primaryTargetParams = ["DIFF_POWER", "DIFF_ON_THROTTLE", "ARB_FRONT", "FRONT_ARB"];
      secondaryTargetParams = ["ARB_REAR", "REAR_ARB"];
      doNotTouchParams = ["REAR_WING", "BRAKE_PRESSURE", "ABS"];

      allowedDeltas = {
        DIFF_POWER: { maxSteps: 1, maxAbsDelta: 5, preferredDirection: "decrease" },
        DIFF_ON_THROTTLE: { maxSteps: 3, maxAbsDelta: 4, preferredDirection: "decrease" },
        ARB_FRONT: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "decrease" },
        FRONT_ARB: { maxSteps: 1, maxAbsDelta: 2, preferredDirection: "decrease" },
      };

      tradeoffsConsidered = {
        desired: "Lower diff power lock lets the outside rear tire rotate freely, reducing the push on corner exit",
        secondaryRisk: "Slightly less forward drive out of low-speed hairpins",
      };
    }
  } else if (phase === "ENTRY") {
    // Braking instability / snap on entry / turn-in wash
    if (/snap|oversteer|loose|spin|wander|step out|tail/i.test(raw)) {
      primaryLimiter = "Rear axle lateral unweighting and dynamic differential coast unlock during heavy braking and turn-in";
      primaryTargetParams = ["BRAKE_BIAS", "FRONT_BRAKE_BIAS", "DIFF_COAST", "DIFF_OFF_THROTTLE"];
      secondaryTargetParams = ["REBOUND_SLOW_R", "BUMP_SLOW_F"];
      doNotTouchParams = ["REAR_WING", "DIFF_POWER", "DIFF_ON_THROTTLE", "TC1"];

      allowedDeltas = {
        BRAKE_BIAS: { maxSteps: 2, maxAbsDelta: 1.0, preferredDirection: "increase" }, // Forward bias
        FRONT_BRAKE_BIAS: { maxSteps: 2, maxAbsDelta: 2.0, preferredDirection: "increase" },
        DIFF_COAST: { maxSteps: 2, maxAbsDelta: 10, preferredDirection: "increase" }, // More lock
        DIFF_OFF_THROTTLE: { maxSteps: 3, maxAbsDelta: 4, preferredDirection: "increase" },
      };

      tradeoffsConsidered = {
        desired: "Moving brake bias forward and stiffening diff coast locks the rear axle under deceleration, suppressing turn-in rotation snap",
        secondaryRisk: "Increased tendency toward initial entry understeer; front tyres do more heavy braking work",
      };
    } else {
      // Entry understeer / reluctant turn-in
      primaryLimiter = "Front axle lateral grip deficit and excessive differential coast locking on turn-in";
      primaryTargetParams = ["BRAKE_BIAS", "FRONT_BRAKE_BIAS", "DIFF_COAST", "DIFF_OFF_THROTTLE", "ARB_FRONT", "FRONT_ARB"];
      secondaryTargetParams = ["TOE_FRONT", "FRONT_TOE_OUT"];
      doNotTouchParams = ["REAR_WING", "DIFF_POWER", "DIFF_ON_THROTTLE"];

      allowedDeltas = {
        BRAKE_BIAS: { maxSteps: 2, maxAbsDelta: 0.8, preferredDirection: "decrease" }, // Rearward
        FRONT_BRAKE_BIAS: { maxSteps: 2, maxAbsDelta: 1.5, preferredDirection: "decrease" },
        DIFF_COAST: { maxSteps: 2, maxAbsDelta: 10, preferredDirection: "decrease" },
        DIFF_OFF_THROTTLE: { maxSteps: 2, maxAbsDelta: 3, preferredDirection: "decrease" },
        ARB_FRONT: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "decrease" },
      };

      tradeoffsConsidered = {
        desired: "Reduced diff coast lock and rearward brake bias allows the car to yaw eagerly on trail-braking entry",
        secondaryRisk: "Requires progressive, disciplined brake pedal release to avoid rear axle wander",
      };
    }
  } else if (phase === "MID_CORNER") {
    // Steady-state apex understeer or oversteer
    if (/understeer|push|wash/i.test(raw)) {
      primaryLimiter = "Mechanical roll stiffness distribution biased excessively toward the front axle";
      primaryTargetParams = ["ARB_FRONT", "FRONT_ARB", "CAMBER_FRONT", "FRONT_CAMBER"];
      secondaryTargetParams = ["ARB_REAR", "REAR_ARB"];
      doNotTouchParams = ["DIFF_POWER", "DIFF_ON_THROTTLE", "BRAKE_PRESSURE", "REAR_RIDE_HEIGHT"];

      allowedDeltas = {
        ARB_FRONT: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "decrease" },
        FRONT_ARB: { maxSteps: 1, maxAbsDelta: 2, preferredDirection: "decrease" },
        CAMBER_FRONT: { maxSteps: 2, maxAbsDelta: 0.2, preferredDirection: "decrease" }, // More negative
      };

      tradeoffsConsidered = {
        desired: "Softer front ARB increases front mechanical compliance and grip across the apex",
        secondaryRisk: "Mild increase in front body roll angle during high-speed transitions",
      };
    } else {
      // Apex oversteer / loose mid-corner
      primaryLimiter = "Excessive rear mechanical roll stiffness / inadequate rear camber contact patch";
      primaryTargetParams = ["ARB_REAR", "REAR_ARB", "CAMBER_REAR", "REAR_CAMBER"];
      secondaryTargetParams = ["ARB_FRONT", "FRONT_ARB"];
      doNotTouchParams = ["DIFF_POWER", "BRAKE_BIAS"];

      allowedDeltas = {
        ARB_REAR: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "decrease" },
        REAR_ARB: { maxSteps: 1, maxAbsDelta: 2, preferredDirection: "decrease" },
      };

      tradeoffsConsidered = {
        desired: "Softening rear ARB reduces rear tyre lateral load transfer, increasing mid-corner rear stability",
        secondaryRisk: "May slightly diminish car's agility in fast left-right chicanes",
      };
    }
  } else if (phase === "HIGH_SPEED") {
    // Fast sweepers, Copse, Blanchimont, high-speed stability
    if (/loose|snap|unstable|float|rear wash/i.test(raw)) {
      primaryLimiter = "High-speed aerodynamic balance shift and diffuser pitch/rake instability";
      primaryTargetParams = ["REAR_WING", "REAR_WING_AERO", "REAR_RIDE_HEIGHT", "ROD_LENGTH_R"];
      secondaryTargetParams = ["ARB_FRONT", "FRONT_ARB"];
      doNotTouchParams = ["DIFF_POWER", "DIFF_COAST", "BRAKE_BIAS"];

      allowedDeltas = {
        REAR_WING: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "increase" },
        REAR_WING_AERO: { maxSteps: 2, maxAbsDelta: 2, preferredDirection: "increase" },
        REAR_RIDE_HEIGHT: { maxSteps: 2, maxAbsDelta: 2, preferredDirection: "decrease" }, // Less extreme rake
        ROD_LENGTH_R: { maxSteps: 2, maxAbsDelta: 2, preferredDirection: "decrease" },
      };

      tradeoffsConsidered = {
        desired: "Controlled rear wing increase and lowered rear ride height stabilizes the diffuser and aero center of pressure",
        secondaryRisk: "Minor 1-2 km/h drag penalty on long straights",
      };
    } else {
      // High-speed understeer / high-drag top-speed deficit
      primaryLimiter = "Aerodynamic front downforce deficit or excessive rear wing induced drag";
      primaryTargetParams = ["FRONT_WING", "FRONT_WING_AERO", "REAR_WING", "REAR_WING_AERO"];
      secondaryTargetParams = ["FRONT_RIDE_HEIGHT", "ROD_LENGTH_F"];
      doNotTouchParams = ["DIFF_POWER", "BRAKE_BIAS"];

      allowedDeltas = {
        FRONT_WING: { maxSteps: 1, maxAbsDelta: 1, preferredDirection: "increase" },
        FRONT_WING_AERO: { maxSteps: 2, maxAbsDelta: 2, preferredDirection: "increase" },
      };

      tradeoffsConsidered = {
        desired: "Additional front wing angle increases high-speed front bite and turn-in precision",
        secondaryRisk: "Must not exceed rear wing balance to avoid high-speed oversteer",
      };
    }
  } else if (phase === "KERBS") {
    // Kerb strike instability / violent deflection
    primaryLimiter = "High-frequency curb impact shock transmitted through excessive fast damping or bumpstop bottoming";
    primaryTargetParams = ["BUMP_SLOW_F", "REBOUND_SLOW_F", "FRONT_SUSPENSION", "REAR_SUSPENSION"];
    secondaryTargetParams = ["RIDE_HEIGHT_F", "RIDE_HEIGHT_R"];
    doNotTouchParams = ["FRONT_WING", "REAR_WING", "DIFF_POWER"];

    allowedDeltas = {
      FRONT_SUSPENSION: { maxSteps: 2, maxAbsDelta: 3, preferredDirection: "decrease" },
      REAR_SUSPENSION: { maxSteps: 2, maxAbsDelta: 2, preferredDirection: "decrease" },
    };

    tradeoffsConsidered = {
      desired: "Softer damping compliance allows the wheel to track curb contours without bouncing the chassis",
      secondaryRisk: "Slightly less responsive platform feel on flat tarmac transitions",
    };
  } else {
    // General or missing complaint -> conservative balanced baseline
    primaryLimiter = "General platform balance and tyre pressure optimization";
    primaryTargetParams = ["TYRE_PRESSURE_FL", "TYRE_PRESSURE_FR", "TYRE_PRESSURE_RL", "TYRE_PRESSURE_RR"];
    secondaryTargetParams = ["BRAKE_BIAS", "FRONT_BRAKE_BIAS"];
    doNotTouchParams = [];
    confidence = "MEDIUM";

    tradeoffsConsidered = {
      desired: "Even tyre footprint and balanced mechanical platform",
      secondaryRisk: "None (conservative baseline configuration)",
    };
  }

  // If empirical telemetry shows tyre pressure offsets, include tyre parameters for calibration
  if (telemetryContext?.tyreOptimization?.pressureDelta) {
    const pd = telemetryContext.tyreOptimization.pressureDelta;
    const deltas = [pd.FL, pd.FR, pd.RL, pd.RR].filter((v): v is number => v != null);
    const hasPressureDiscrepancy = deltas.some((v) => Math.abs(v) >= 0.3);

    if (hasPressureDiscrepancy) {
      const tyreParams = ["TYRE_PRESSURE_FL", "TYRE_PRESSURE_FR", "TYRE_PRESSURE_RL", "TYRE_PRESSURE_RR"];
      tyreParams.forEach((tp) => {
        if (!primaryTargetParams.includes(tp) && !secondaryTargetParams.includes(tp)) {
          secondaryTargetParams.push(tp);
        }
      });
    }
  }

  // Filter target params to those that actually exist in the current simulator catalog
  const filterExisting = (keys: string[]) => {
    return keys.filter((k) => findParameterDefinition(catalog, k) !== undefined);
  };

  const validPrimary = filterExisting(primaryTargetParams);
  const validSecondary = filterExisting(secondaryTargetParams);

  return {
    phase,
    primaryLimiter,
    primaryTargetParams: validPrimary.slice(0, 3), // Strictly 1 to 3 primary changes
    secondaryTargetParams: validSecondary.slice(0, 2), // Strictly 0 to 2 secondary changes
    doNotTouchParams,
    allowedDeltas,
    driverTechniqueFlag,
    tradeoffsConsidered,
    confidence,
    evidenceFound: telExtraction.observedPhenomena,
    hasTelemetryEvidence: telExtraction.hasTelemetry,
  };
}
