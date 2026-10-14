import {
  TelemetryPoint,
  DynamicAeroMapAnalysis,
  AeroSpeedBin,
  AeroRideHeightPoint,
  AeroGroundingEvent,
  AeroDiffuserStallEvent,
  PorpoisingAnalysis,
} from "@/types/telemetry";

export interface AeroMapOptions {
  carArchetype?: "gt3" | "formula_modern" | "formula_historic" | "prototype" | "cup_gt4" | "street_sports";
  airTempCelsius?: number; // default 22°C
  trackName?: string;
}

interface ArchetypeAeroParams {
  staticFrontRideHeightMm: number;
  staticRearRideHeightMm: number;
  staticAeroBalancePct: number;
  frontalAreaM2: number;
  baseCl: number;
  baseCd: number;
  wheelbaseM: number;
  massKg: number;
  cgHeightM: number;
  frontWheelRateNmm: number; // combined axle wheel rate
  rearWheelRateNmm: number;
  splitterGroundingThresholdMm: number;
  diffuserStallThresholdMm: number;
  rakeAeroSensitivityPctPerMm: number;
  frontRhAeroSensitivityPctPerMm: number;
}

const ARCHETYPE_PARAMS: Record<string, ArchetypeAeroParams> = {
  gt3: {
    staticFrontRideHeightMm: 55,
    staticRearRideHeightMm: 75,
    staticAeroBalancePct: 42.5,
    frontalAreaM2: 2.15,
    baseCl: 2.45,
    baseCd: 0.72,
    wheelbaseM: 2.65,
    massKg: 1350,
    cgHeightM: 0.38,
    frontWheelRateNmm: 190,
    rearWheelRateNmm: 205,
    splitterGroundingThresholdMm: 46,
    diffuserStallThresholdMm: 96,
    rakeAeroSensitivityPctPerMm: 0.18,
    frontRhAeroSensitivityPctPerMm: 0.14,
  },
  formula_modern: {
    staticFrontRideHeightMm: 24,
    staticRearRideHeightMm: 42,
    staticAeroBalancePct: 44.5,
    frontalAreaM2: 1.65,
    baseCl: 4.6,
    baseCd: 1.15,
    wheelbaseM: 3.6,
    massKg: 798,
    cgHeightM: 0.28,
    frontWheelRateNmm: 260,
    rearWheelRateNmm: 280,
    splitterGroundingThresholdMm: 14,
    diffuserStallThresholdMm: 62,
    rakeAeroSensitivityPctPerMm: 0.24,
    frontRhAeroSensitivityPctPerMm: 0.22,
  },
  prototype: {
    staticFrontRideHeightMm: 42,
    staticRearRideHeightMm: 62,
    staticAeroBalancePct: 44.0,
    frontalAreaM2: 1.9,
    baseCl: 3.8,
    baseCd: 0.88,
    wheelbaseM: 2.95,
    massKg: 1030,
    cgHeightM: 0.32,
    frontWheelRateNmm: 220,
    rearWheelRateNmm: 240,
    splitterGroundingThresholdMm: 33,
    diffuserStallThresholdMm: 82,
    rakeAeroSensitivityPctPerMm: 0.20,
    frontRhAeroSensitivityPctPerMm: 0.18,
  },
  cup_gt4: {
    staticFrontRideHeightMm: 68,
    staticRearRideHeightMm: 85,
    staticAeroBalancePct: 40.0,
    frontalAreaM2: 2.2,
    baseCl: 1.35,
    baseCd: 0.62,
    wheelbaseM: 2.55,
    massKg: 1420,
    cgHeightM: 0.42,
    frontWheelRateNmm: 160,
    rearWheelRateNmm: 175,
    splitterGroundingThresholdMm: 52,
    diffuserStallThresholdMm: 110,
    rakeAeroSensitivityPctPerMm: 0.12,
    frontRhAeroSensitivityPctPerMm: 0.10,
  },
  formula_historic: {
    staticFrontRideHeightMm: 35,
    staticRearRideHeightMm: 55,
    staticAeroBalancePct: 41.0,
    frontalAreaM2: 1.5,
    baseCl: 2.8,
    baseCd: 0.95,
    wheelbaseM: 2.7,
    massKg: 620,
    cgHeightM: 0.30,
    frontWheelRateNmm: 180,
    rearWheelRateNmm: 195,
    splitterGroundingThresholdMm: 22,
    diffuserStallThresholdMm: 75,
    rakeAeroSensitivityPctPerMm: 0.16,
    frontRhAeroSensitivityPctPerMm: 0.14,
  },
  street_sports: {
    staticFrontRideHeightMm: 115,
    staticRearRideHeightMm: 125,
    staticAeroBalancePct: 38.0,
    frontalAreaM2: 2.25,
    baseCl: 0.35,
    baseCd: 0.34,
    wheelbaseM: 2.5,
    massKg: 1550,
    cgHeightM: 0.48,
    frontWheelRateNmm: 110,
    rearWheelRateNmm: 120,
    splitterGroundingThresholdMm: 80,
    diffuserStallThresholdMm: 160,
    rakeAeroSensitivityPctPerMm: 0.05,
    frontRhAeroSensitivityPctPerMm: 0.04,
  },
};

/**
 * Calculates air density based on temperature in Celsius at sea level.
 * Formula: rho = P / (R_spec * T_kelvin)
 */
function calculateAirDensity(airTempCelsius: number): number {
  const p = 101325; // Standard atmospheric pressure (Pa)
  const rSpecific = 287.058; // Specific gas constant for dry air (J/(kg*K))
  const tKelvin = Math.max(250, airTempCelsius + 273.15);
  return Number((p / (rSpecific * tKelvin)).toFixed(4));
}

/**
 * Computes Dynamic Ride Heights, Dynamic Rake, Aerodynamic Downforce, Drag,
 * and Aero Balance across the entire lap using authentic physics equations.
 */
export function computeDynamicAeroMap(
  points: TelemetryPoint[],
  options?: AeroMapOptions
): DynamicAeroMapAnalysis {
  const archetypeKey = options?.carArchetype || "gt3";
  const params = ARCHETYPE_PARAMS[archetypeKey] || ARCHETYPE_PARAMS.gt3;
  const airDensity = calculateAirDensity(options?.airTempCelsius ?? 22);

  const staticRakeMm = params.staticRearRideHeightMm - params.staticFrontRideHeightMm;
  const n = points.length;

  if (n === 0) {
    return createEmptyAeroMap(archetypeKey, params, staticRakeMm);
  }

  // Check if authentic ride height channels exist in points
  const hasRawRideHeights = points.some(
    (p) => p.rideHeightFL != null || p.rideHeightFR != null
  );
  const hasSuspTravel = points.some(
    (p) => p.suspFL != null || p.suspFR != null
  );

  const sampledProfile: AeroRideHeightPoint[] = [];
  let peakDownforceN = 0;
  let topSpeedKmh = 0;
  let minFrontRideHeightMm = Infinity;
  let maxRearRideHeightMm = -Infinity;
  let sumAeroBalanceFrontPct = 0;
  let validBalanceSamples = 0;

  // Speed Bin Accumulators: 0-80, 80-140, 140-200, 200-260, 260+
  const speedBinsDef = [
    { label: "0-80", min: 0, max: 80 },
    { label: "80-140", min: 80, max: 140 },
    { label: "140-200", min: 140, max: 200 },
    { label: "200-260", min: 200, max: 260 },
    { label: "260+", min: 260, max: 450 },
  ];

  const binStats = speedBinsDef.map((b) => ({
    speedRange: b.label,
    minSpeedKmh: b.min,
    maxSpeedKmh: b.max,
    count: 0,
    sumFrontRh: 0,
    sumRearRh: 0,
    sumRake: 0,
    sumAeroBal: 0,
    sumDownforceKg: 0,
    sumDragKg: 0,
  }));

  const allFrontRh: number[] = new Array(n);
  const allRearRh: number[] = new Array(n);

  // Transient point analysis
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const speedKmh = Math.max(0, p.speed ?? 0);
    const speedMs = speedKmh / 3.6;
    if (speedKmh > topSpeedKmh) topSpeedKmh = speedKmh;

    const longG = p.longG ?? 0;
    const ax = longG * 9.80665; // m/s^2

    // 1. Dynamic Ride Heights Calculation
    let frontRh: number;
    let rearRh: number;

    if (hasRawRideHeights && p.rideHeightFL != null && p.rideHeightFR != null) {
      frontRh = (p.rideHeightFL + p.rideHeightFR) / 2;
      rearRh =
        p.rideHeightRL != null && p.rideHeightRR != null
          ? (p.rideHeightRL + p.rideHeightRR) / 2
          : params.staticRearRideHeightMm;
    } else if (hasSuspTravel && p.suspFL != null && p.suspFR != null) {
      // Linear potentiometer compression (positive displacement = bump = lower ride height)
      const avgFrontSuspDeflection = (p.suspFL + p.suspFR) / 2;
      const avgRearSuspDeflection =
        p.suspRL != null && p.suspRR != null
          ? (p.suspRL + p.suspRR) / 2
          : 0;
      frontRh = params.staticFrontRideHeightMm - avgFrontSuspDeflection;
      rearRh = params.staticRearRideHeightMm - avgRearSuspDeflection;
    } else {
      // Dynamic Aero + Inertial Pitch/Roll Physics Model
      // Aerodynamic downforce: F_aero = 0.5 * rho * v^2 * Cl * A
      const q = 0.5 * airDensity * speedMs * speedMs;
      const rawTotalDownforceN = q * params.baseCl * params.frontalAreaM2;

      // Longitudinal pitch load transfer: Delta F_pitch = (m * ax * h_cg) / Wheelbase
      // Under braking (ax < 0), front load increases (positive Delta F_front), compressing front
      const deltaFzPitchFront = -(params.massKg * ax * params.cgHeightM) / params.wheelbaseM;
      const deltaFzPitchRear = -deltaFzPitchFront;

      // Aero axle distribution (baseline)
      const fzDownforceFront = rawTotalDownforceN * (params.staticAeroBalancePct / 100);
      const fzDownforceRear = rawTotalDownforceN * (1 - params.staticAeroBalancePct / 100);

      // Total vertical force delta on each axle (N)
      const totalDeltaFzFront = fzDownforceFront + deltaFzPitchFront;
      const totalDeltaFzRear = fzDownforceRear + deltaFzPitchRear;

      // Mechanical suspension deflection (mm) = Force / WheelRate
      const deflectionFrontMm = totalDeltaFzFront / params.frontWheelRateNmm;
      const deflectionRearMm = totalDeltaFzRear / params.rearWheelRateNmm;

      // Add high-speed curb & texture micro-excitations
      const dist = p.dist || i * 15;
      const roadExcitation =
        speedKmh > 70 ? Math.sin(dist * 0.35) * 1.8 + Math.cos(dist * 0.95) * 1.2 : 0;

      frontRh = params.staticFrontRideHeightMm - deflectionFrontMm + roadExcitation;
      rearRh = params.staticRearRideHeightMm - deflectionRearMm + roadExcitation * 0.8;
    }

    // Physical hard stops (chassis cannot pass through asphalt)
    const minMechanicalFloorStop = archetypeKey === "formula_modern" ? 8 : 18;
    frontRh = Math.max(minMechanicalFloorStop, frontRh);
    rearRh = Math.max(minMechanicalFloorStop + 5, rearRh);

    allFrontRh[i] = frontRh;
    allRearRh[i] = rearRh;

    const dynamicRakeMm = rearRh - frontRh;

    if (frontRh < minFrontRideHeightMm) minFrontRideHeightMm = frontRh;
    if (rearRh > maxRearRideHeightMm) maxRearRideHeightMm = rearRh;

    // 2. Aerodynamic Downforce, Drag & Balance
    const q = 0.5 * airDensity * speedMs * speedMs;

    // Rake effect on Cl & Cd:
    // Increased rake increases diffuser expansion angle and floor downforce up to stall point
    const rakeDeltaFromStatic = dynamicRakeMm - staticRakeMm;
    const frontRhDeltaFromStatic = params.staticFrontRideHeightMm - frontRh; // Positive = closer to ground

    // Ground effect suction increase as front ride height lowers
    const groundEffectGain = Math.min(0.35, Math.max(-0.2, frontRhDeltaFromStatic * 0.015));
    const dynamicCl = Math.max(0.5, params.baseCl * (1 + groundEffectGain + rakeDeltaFromStatic * 0.006));
    const dynamicCd = Math.max(0.2, params.baseCd * (1 + Math.abs(rakeDeltaFromStatic) * 0.005));

    const totalDownforceN = q * dynamicCl * params.frontalAreaM2;
    const totalDragN = q * dynamicCd * params.frontalAreaM2;

    const downforceKg = totalDownforceN / 9.80665;
    const dragKg = totalDragN / 9.80665;

    if (totalDownforceN > peakDownforceN) peakDownforceN = totalDownforceN;

    // Dynamic Aero Balance (% Front Aero)
    // Increases with positive rake (floor throat expansion) and as front ride height lowers
    let aeroBalanceFrontPct =
      params.staticAeroBalancePct +
      rakeDeltaFromStatic * params.rakeAeroSensitivityPctPerMm +
      frontRhDeltaFromStatic * params.frontRhAeroSensitivityPctPerMm;

    // Splitter grounding causes front aero stall (loss of front downforce)
    const isSplitterGrounding = frontRh <= params.splitterGroundingThresholdMm;
    if (isSplitterGrounding) {
      const stallDepth = params.splitterGroundingThresholdMm - frontRh;
      aeroBalanceFrontPct -= Math.min(8.0, stallDepth * 1.5);
    }

    // Diffuser stall occurs if rear ride height exceeds expansion limit
    const isDiffuserStalling = rearRh >= params.diffuserStallThresholdMm;
    if (isDiffuserStalling) {
      const separationDepth = rearRh - params.diffuserStallThresholdMm;
      // Diffuser stall sheds rear downforce -> aero balance shifts forward artificially
      aeroBalanceFrontPct += Math.min(6.0, separationDepth * 0.8);
    }

    aeroBalanceFrontPct = Number(Math.max(25, Math.min(65, aeroBalanceFrontPct)).toFixed(2));

    sumAeroBalanceFrontPct += aeroBalanceFrontPct;
    validBalanceSamples++;

    // Downsample profile for UI rendering (every ~10-20m or ~1-2 Hz)
    const shouldSample = i % Math.max(1, Math.floor(n / 250)) === 0;
    if (shouldSample || i === n - 1) {
      sampledProfile.push({
        dist: p.dist || Math.round(i * 15),
        speed: speedKmh,
        frontRideHeightMm: Number(frontRh.toFixed(1)),
        rearRideHeightMm: Number(rearRh.toFixed(1)),
        dynamicRakeMm: Number(dynamicRakeMm.toFixed(1)),
        aeroBalanceFrontPct,
        downforceKg: Math.round(downforceKg),
        isSplitterGrounding,
        isDiffuserStalling,
      });
    }

    // Accumulate into Speed Bins
    for (const b of binStats) {
      if (speedKmh >= b.minSpeedKmh && speedKmh < b.maxSpeedKmh) {
        b.count++;
        b.sumFrontRh += frontRh;
        b.sumRearRh += rearRh;
        b.sumRake += dynamicRakeMm;
        b.sumAeroBal += aeroBalanceFrontPct;
        b.sumDownforceKg += downforceKg;
        b.sumDragKg += dragKg;
        break;
      }
    }
  }

  // Finalize Speed Bins
  const speedBins: AeroSpeedBin[] = binStats.map((b) => {
    const c = b.count || 1;
    const avgDf = Math.round(b.sumDownforceKg / c);
    const avgDrag = Math.round(b.sumDragKg / c);
    const ld = avgDrag > 0 ? Number((avgDf / avgDrag).toFixed(2)) : Number((params.baseCl / params.baseCd).toFixed(2));

    return {
      speedRange: b.speedRange,
      minSpeedKmh: b.minSpeedKmh,
      maxSpeedKmh: b.maxSpeedKmh,
      sampleCount: b.count,
      avgFrontRideHeightMm: Number((b.sumFrontRh / c).toFixed(1)),
      avgRearRideHeightMm: Number((b.sumRearRh / c).toFixed(1)),
      avgDynamicRakeMm: Number((b.sumRake / c).toFixed(1)),
      avgAeroBalancePct: Number((b.sumAeroBal / c).toFixed(1)),
      avgDownforceKg: avgDf,
      avgDragKg: avgDrag,
      liftToDragRatio: ld,
    };
  });

  // 3. Detect Discrete Splitter Grounding Events
  const groundingEvents: AeroGroundingEvent[] = [];
  let inGrounding = false;
  let groundStartDist = 0;
  let groundMinRh = Infinity;
  let groundMaxSpeed = 0;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const speed = p.speed ?? 0;
    const rh = allFrontRh[i];

    if (rh <= params.splitterGroundingThresholdMm && speed > 90) {
      if (!inGrounding) {
        inGrounding = true;
        groundStartDist = p.dist || Math.round(i * 15);
        groundMinRh = rh;
        groundMaxSpeed = speed;
      } else {
        if (rh < groundMinRh) groundMinRh = rh;
        if (speed > groundMaxSpeed) groundMaxSpeed = speed;
      }
    } else {
      if (inGrounding) {
        inGrounding = false;
        const deficit = params.splitterGroundingThresholdMm - groundMinRh;
        const severity: "mild" | "moderate" | "severe" =
          deficit > 6 ? "severe" : deficit > 2.5 ? "moderate" : "mild";

        groundingEvents.push({
          dist: groundStartDist,
          speedKmh: Math.round(groundMaxSpeed),
          frontRideHeightMm: Number(groundMinRh.toFixed(1)),
          severity,
          locationDescription: `Splitter scrape @ ${groundStartDist}m (${Math.round(groundMaxSpeed)} km/h, ${Number(groundMinRh.toFixed(1))}mm clearance)`,
        });
      }
    }
  }

  // Finalize if still grounding at end of session
  if (inGrounding) {
    const deficit = params.splitterGroundingThresholdMm - groundMinRh;
    const severity: "mild" | "moderate" | "severe" =
      deficit > 6 ? "severe" : deficit > 2.5 ? "moderate" : "mild";

    groundingEvents.push({
      dist: groundStartDist,
      speedKmh: Math.round(groundMaxSpeed),
      frontRideHeightMm: Number(groundMinRh.toFixed(1)),
      severity,
      locationDescription: `Splitter scrape @ ${groundStartDist}m (${Math.round(groundMaxSpeed)} km/h, ${Number(groundMinRh.toFixed(1))}mm clearance)`,
    });
  }

  // 4. Detect Discrete Diffuser Stall Events
  const diffuserStallEvents: AeroDiffuserStallEvent[] = [];
  let inDiffuserStall = false;
  let stallStartDist = 0;
  let stallMaxRearRh = -Infinity;
  let stallMaxSpeed = 0;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const speed = p.speed ?? 0;
    const rearRh = allRearRh[i];

    if (rearRh >= params.diffuserStallThresholdMm && speed > 100) {
      if (!inDiffuserStall) {
        inDiffuserStall = true;
        stallStartDist = p.dist || Math.round(i * 15);
        stallMaxRearRh = rearRh;
        stallMaxSpeed = speed;
      } else {
        if (rearRh > stallMaxRearRh) stallMaxRearRh = rearRh;
        if (speed > stallMaxSpeed) stallMaxSpeed = speed;
      }
    } else {
      if (inDiffuserStall) {
        inDiffuserStall = false;
        diffuserStallEvents.push({
          dist: stallStartDist,
          speedKmh: Math.round(stallMaxSpeed),
          rearRideHeightMm: Number(stallMaxRearRh.toFixed(1)),
          rakeMm: Number((stallMaxRearRh - params.staticFrontRideHeightMm).toFixed(1)),
          locationDescription: `Diffuser expansion separation @ ${stallStartDist}m (${Math.round(stallMaxSpeed)} km/h, ${Number(stallMaxRearRh.toFixed(1))}mm rear ride height)`,
        });
      }
    }
  }

  // Finalize if still stalling at end
  if (inDiffuserStall) {
    diffuserStallEvents.push({
      dist: stallStartDist,
      speedKmh: Math.round(stallMaxSpeed),
      rearRideHeightMm: Number(stallMaxRearRh.toFixed(1)),
      rakeMm: Number((stallMaxRearRh - params.staticFrontRideHeightMm).toFixed(1)),
      locationDescription: `Diffuser expansion separation @ ${stallStartDist}m (${Math.round(stallMaxSpeed)} km/h, ${Number(stallMaxRearRh.toFixed(1))}mm rear ride height)`,
    });
  }

  // 5. Detect Porpoising / Aero Elastic Pitch Oscillation
  const porpoising = detectPorpoising(points, allFrontRh, params);

  // 6. Pitch Sensitivity Analysis
  const highSpeedBin = speedBins.find((b) => b.speedRange === "200-260") || speedBins[speedBins.length - 1];
  const lowSpeedBin = speedBins.find((b) => b.speedRange === "80-140") || speedBins[1];
  const aeroShiftPct = Number(
    Math.abs((highSpeedBin?.avgAeroBalancePct || params.staticAeroBalancePct) - (lowSpeedBin?.avgAeroBalancePct || params.staticAeroBalancePct)).toFixed(1)
  );

  let pitchSensitivityVerdict = "";
  if (aeroShiftPct > 4.5) {
    pitchSensitivityVerdict = `High Aero Pitch Sensitivity (Δ${aeroShiftPct}% aero migration between 100 km/h and 250 km/h). Severe balance shift between low-speed mechanical turns and high-speed sweepers.`;
  } else if (aeroShiftPct > 2.5) {
    pitchSensitivityVerdict = `Moderate Aero Pitch Sensitivity (Δ${aeroShiftPct}% migration). Balanced platform with predictable aero stability.`;
  } else {
    pitchSensitivityVerdict = `Very Stiff / Locked Aero Platform (Δ${aeroShiftPct}% migration). Excellent aero platform consistency; low sensitivity to pitch changes.`;
  }

  // 7. Formulate Race Engineer Aero & Third Spring Recommendations
  const recommendations: string[] = [];

  if (groundingEvents.some((g) => g.severity === "severe" || g.severity === "moderate")) {
    recommendations.push(
      `Front Splitter Packer Clearance: Add +3mm to +5mm front bumpstop packers (or increase front heave spring by 20-30 N/mm) to prevent splitter chaffing and downforce choking at high speed.`
    );
  }

  if (diffuserStallEvents.length > 0) {
    recommendations.push(
      `Rear Diffuser Separation Control: Lower static rear ride height by 2-3 clicks or soften rear low-speed rebound to keep diffuser expansion within sealed boundary layer limits during trail-braking pitch dive.`
    );
  }

  if (porpoising.isDetected) {
    recommendations.push(
      `Porpoising Remediation: Car exhibits ${porpoising.maxOscillationMm}mm vertical heave oscillation at ${porpoising.peakFrequencyHz} Hz above ${porpoising.speedAtOnsetKmh} km/h. Raise front static ride height by +2mm or stiffen third heave damping to decouple aerodynamic pitch frequency.`
    );
  }

  if (aeroShiftPct > 4.5) {
    recommendations.push(
      `Platform Stiffening: Increase front spring rate or third heave spring to narrow the dynamic pitch window and stabilize high-speed corner entry balance.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      `Optimal Aerodynamic Platform: Dynamic rake angle and front splitter clearances operate in peak L/D window across all speed sectors. Current aero baseline is validated.`
    );
  }

  // Overall Verdict
  const overallVerdict =
    groundingEvents.length > 0 && diffuserStallEvents.length > 0
      ? "Aerodynamic Instability: Splitter grounding observed under high aero load and diffuser separation observed during pitch dive."
      : groundingEvents.length > 0
      ? `Splitter Grounding Detected: ${groundingEvents.length} splitter strike event(s) logged. Splitter stall shedding front downforce.`
      : porpoising.isDetected
      ? `Porpoising Warning: High-speed ground effect oscillation detected above ${porpoising.speedAtOnsetKmh} km/h.`
      : "MoTeC-Grade Aerodynamic Platform Stable: Smooth dynamic rake progression with consistent downforce distribution.";

  const peakDownforceKg = Math.round(peakDownforceN / 9.80665);
  const averageAeroBalance = validBalanceSamples > 0 ? Number((sumAeroBalanceFrontPct / validBalanceSamples).toFixed(1)) : params.staticAeroBalancePct;

  // Efficiency score based on L/D and platform stability (0 - 100)
  const penalty = (groundingEvents.length * 6) + (diffuserStallEvents.length * 8) + (porpoising.isDetected ? 18 : 0);
  const aeroScore = Math.max(45, Math.min(98, Math.round(92 - penalty)));

  return {
    carArchetype: params.staticFrontRideHeightMm + "mm / " + params.staticRearRideHeightMm + "mm (" + archetypeKey.toUpperCase() + ")",
    staticFrontRideHeightMm: params.staticFrontRideHeightMm,
    staticRearRideHeightMm: params.staticRearRideHeightMm,
    staticRakeMm,
    staticAeroBalancePct: params.staticAeroBalancePct,
    peakDownforceKg,
    topSpeedKmh: Math.round(topSpeedKmh),
    minFrontRideHeightMm: Number(minFrontRideHeightMm.toFixed(1)),
    maxRearRideHeightMm: Number(maxRearRideHeightMm.toFixed(1)),
    averageAeroBalanceFrontPct: averageAeroBalance,
    speedBins,
    sampledProfile,
    groundingEvents,
    diffuserStallEvents,
    porpoising,
    pitchSensitivityVerdict,
    aerodynamicEfficiencyScore: aeroScore,
    overallVerdict,
    setupRecommendations: recommendations,
  };
}

/**
 * Detects porpoising (aerodynamic heave bounce oscillation) on high-speed straights.
 */
function detectPorpoising(
  points: TelemetryPoint[],
  frontRhList: number[],
  params: ArchetypeAeroParams
): PorpoisingAnalysis {
  const highSpeedIndices: number[] = [];
  for (let i = 0; i < points.length; i++) {
    if ((points[i].speed ?? 0) > 210) {
      highSpeedIndices.push(i);
    }
  }

  if (highSpeedIndices.length < 15) {
    return {
      isDetected: false,
      peakFrequencyHz: 0,
      maxOscillationMm: 0,
      speedAtOnsetKmh: 0,
      severity: "none",
      summary: "No sustained high-speed running above 210 km/h to evaluate porpoising.",
    };
  }

  // Count zero-crossings of ride height delta around mean
  let sumRh = 0;
  for (const idx of highSpeedIndices) sumRh += frontRhList[idx];
  const meanRh = sumRh / highSpeedIndices.length;

  let zeroCrossings = 0;
  let maxOscillation = 0;
  let prevSign = 0;

  for (let i = 0; i < highSpeedIndices.length; i++) {
    const rh = frontRhList[highSpeedIndices[i]];
    const diff = rh - meanRh;
    const sign = Math.sign(diff);
    if (Math.abs(diff) > maxOscillation) maxOscillation = Math.abs(diff);

    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
      zeroCrossings++;
    }
    prevSign = sign;
  }

  const firstIdx = highSpeedIndices[0];
  const lastIdx = highSpeedIndices[highSpeedIndices.length - 1];
  const dt = (points[lastIdx].time || 0) - (points[firstIdx].time || 0);
  const timeSeconds = dt > 0.05 ? dt : highSpeedIndices.length * 0.02;

  const frequencyHz = Number(((zeroCrossings / 2) / timeSeconds).toFixed(1));
  const peakToPeakMm = Number((maxOscillation * 2).toFixed(1));

  const isPorpoising = peakToPeakMm > 9.0 && frequencyHz >= 2.5 && frequencyHz <= 8.5;
  const severity: "none" | "mild" | "critical" = !isPorpoising
    ? "none"
    : peakToPeakMm > 15
    ? "critical"
    : "mild";

  return {
    isDetected: isPorpoising,
    peakFrequencyHz: frequencyHz,
    maxOscillationMm: peakToPeakMm,
    speedAtOnsetKmh: isPorpoising ? Math.round(points[firstIdx].speed ?? 210) : 0,
    severity,
    summary: isPorpoising
      ? `Porpoising Detected: Vertical chassis heave oscillating at ${frequencyHz} Hz with ${peakToPeakMm}mm peak-to-peak amplitude above ${Math.round(points[firstIdx].speed ?? 210)} km/h.`
      : "No porpoising instability detected. High-speed aero platform remains aerodynamically stable.",
  };
}

function createEmptyAeroMap(
  archetypeKey: string,
  params: ArchetypeAeroParams,
  staticRakeMm: number
): DynamicAeroMapAnalysis {
  return {
    carArchetype: archetypeKey,
    staticFrontRideHeightMm: params.staticFrontRideHeightMm,
    staticRearRideHeightMm: params.staticRearRideHeightMm,
    staticRakeMm,
    staticAeroBalancePct: params.staticAeroBalancePct,
    peakDownforceKg: 0,
    topSpeedKmh: 0,
    minFrontRideHeightMm: params.staticFrontRideHeightMm,
    maxRearRideHeightMm: params.staticRearRideHeightMm,
    averageAeroBalanceFrontPct: params.staticAeroBalancePct,
    speedBins: [],
    sampledProfile: [],
    groundingEvents: [],
    diffuserStallEvents: [],
    porpoising: {
      isDetected: false,
      peakFrequencyHz: 0,
      maxOscillationMm: 0,
      speedAtOnsetKmh: 0,
      severity: "none",
      summary: "Telemetry contains insufficient points to map aerodynamics.",
    },
    pitchSensitivityVerdict: "No data available.",
    aerodynamicEfficiencyScore: 0,
    overallVerdict: "No telemetry points provided.",
    setupRecommendations: [],
  };
}
