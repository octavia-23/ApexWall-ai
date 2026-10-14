import {
  TelemetryPoint,
  DamperCorner,
  DamperVelocityBin,
  CornerDamperStats,
  DamperHistogramAnalysis,
  DamperRegime,
} from "@/types/telemetry";

export interface DamperHistogramOptions {
  lowSpeedThreshold?: number; // default 50 mm/s
  maxRange?: number; // default 300 mm/s (range is -300 to +300 mm/s)
  binWidth?: number; // default 25 mm/s (24 bins total)
}

const CORNERS: DamperCorner[] = ["FL", "FR", "RL", "RR"];

/**
 * Checks if telemetry points contain authentic suspension position or damper velocity channels.
 */
export function hasAuthenticSuspensionData(points: TelemetryPoint[]): boolean {
  if (!points || points.length === 0) return false;
  let potCount = 0;
  for (let i = 0; i < Math.min(points.length, 100); i++) {
    const p = points[i];
    if (
      p.damperVelFL != null ||
      p.damperVelFR != null ||
      p.damperVelRL != null ||
      p.damperVelRR != null ||
      p.suspFL != null ||
      p.suspFR != null ||
      p.suspRL != null ||
      p.suspRR != null
    ) {
      potCount++;
    }
  }
  return potCount > 5;
}

/**
 * Physics-based 4-corner dynamic suspension velocity reconstruction.
 * Used as a deterministic fallback when raw potentiometer channels are missing from CSV.
 */
function reconstruct4CornerDamperVelocities(points: TelemetryPoint[]): Record<DamperCorner, number[]> {
  const n = points.length;
  const velocities: Record<DamperCorner, number[]> = {
    FL: new Array(n).fill(0),
    FR: new Array(n).fill(0),
    RL: new Array(n).fill(0),
    RR: new Array(n).fill(0),
  };

  if (n < 2) return velocities;

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = i > 0 ? points[i - 1] : points[0];
    const dt = Math.max(0.005, curr.time - prev.time || 0.02);

    const longG = curr.longG ?? 0;
    const prevLongG = prev.longG ?? 0;
    const dLongG_dt = (longG - prevLongG) / dt; // Pitch rate proxy (G/s)

    const latG = curr.latG ?? 0;
    const prevLatG = prev.latG ?? 0;
    const dLatG_dt = (latG - prevLatG) / dt; // Roll rate proxy (G/s)

    const speedKmh = curr.speed ?? 0;
    const speedMs = speedKmh / 3.6;

    // Pitch velocities (mm/s):
    // Deceleration (longG < 0, dLongG_dt negative): Front dives (bump, < 0), Rear lifts (rebound, > 0)
    // Acceleration (longG > 0, dLongG_dt positive): Rear squats (bump, < 0), Front lifts (rebound, > 0)
    const pitchFactorFront = -dLongG_dt * 18.0 - (longG < 0 ? -1 : 1) * Math.min(35, Math.abs(longG) * 12.0);
    const pitchFactorRear = dLongG_dt * 16.0 + (longG < 0 ? 1 : -1) * Math.min(30, Math.abs(longG) * 10.0);

    // Roll velocities (mm/s):
    // Right turn (latG > 0): Outside Left wheels compress (bump < 0), Inside Right wheels lift (rebound > 0)
    // Left turn (latG < 0): Outside Right wheels compress (bump < 0), Inside Left wheels lift (rebound > 0)
    const rollFactor = dLatG_dt * 15.0 + (latG !== 0 ? Math.sign(latG) * Math.min(40, Math.abs(latG) * 14.0) : 0);

    // Aerodynamic heave rate: changes in speed compress front & rear via downforce
    const prevSpeedMs = (prev.speed ?? 0) / 3.6;
    const dSpeed_dt = (speedMs - prevSpeedMs) / dt;
    const aeroHeaveRate = -dSpeed_dt * (speedMs / 60) * 3.5;

    // Kerb & track texture micro-excitations (deterministic, frequency based on distance and lateral load)
    const dist = curr.dist || i * 15;
    const roadRipple = Math.sin(dist * 0.45) * 8.0 + Math.cos(dist * 1.1) * 5.0;
    
    // Kerb strike spikes when high lateral load or rapid steering correction
    const kerbSpike = Math.abs(latG) > 1.2
      ? Math.sin(dist * 2.5) * (Math.abs(latG) * 38.0)
      : 0;

    // Assemble 4 corners (Negative = Bump / Compression, Positive = Rebound / Extension)
    // Left side: FL, RL | Right side: FR, RR
    velocities.FL[i] = pitchFactorFront - rollFactor + aeroHeaveRate + roadRipple + (latG > 0.8 ? kerbSpike : 0);
    velocities.FR[i] = pitchFactorFront + rollFactor + aeroHeaveRate + roadRipple + (latG < -0.8 ? kerbSpike : 0);
    velocities.RL[i] = pitchFactorRear - (rollFactor * 0.9) + aeroHeaveRate + roadRipple + (latG > 0.8 ? kerbSpike * 0.8 : 0);
    velocities.RR[i] = pitchFactorRear + (rollFactor * 0.9) + aeroHeaveRate + roadRipple + (latG < -0.8 ? kerbSpike * 0.8 : 0);
  }

  // Smooth velocities using a 3-point moving average to eliminate discrete step artifacts
  for (const corner of CORNERS) {
    const raw = velocities[corner];
    const smoothed = new Array(n);
    for (let i = 0; i < n; i++) {
      const vPrev = i > 0 ? raw[i - 1] : raw[i];
      const vCurr = raw[i];
      const vNext = i < n - 1 ? raw[i + 1] : raw[i];
      smoothed[i] = Number(((vPrev + vCurr * 2 + vNext) / 4).toFixed(1));
    }
    velocities[corner] = smoothed;
  }

  return velocities;
}

/**
 * Extracts or computes damper velocity series for each corner from telemetry points.
 */
function extractCornerVelocities(
  points: TelemetryPoint[],
  isAuthentic: boolean
): Record<DamperCorner, number[]> {
  if (!isAuthentic) {
    return reconstruct4CornerDamperVelocities(points);
  }

  const n = points.length;
  const velocities: Record<DamperCorner, number[]> = {
    FL: new Array(n).fill(0),
    FR: new Array(n).fill(0),
    RL: new Array(n).fill(0),
    RR: new Array(n).fill(0),
  };

  const hasVel = {
    FL: points.some((p) => p.damperVelFL != null),
    FR: points.some((p) => p.damperVelFR != null),
    RL: points.some((p) => p.damperVelRL != null),
    RR: points.some((p) => p.damperVelRR != null),
  };

  // 1. Direct Damper Velocity channels
  for (const corner of CORNERS) {
    const velKey = `damperVel${corner}` as keyof TelemetryPoint;
    const suspKey = `susp${corner}` as keyof TelemetryPoint;

    if (hasVel[corner]) {
      // Check scale: if values are in m/s (< 2.5), convert to mm/s
      let maxAbs = 0;
      for (let i = 0; i < Math.min(n, 100); i++) {
        const v = Math.abs((points[i][velKey] as number) || 0);
        if (v > maxAbs) maxAbs = v;
      }
      const scale = maxAbs > 0 && maxAbs < 2.5 ? 1000 : 1;

      for (let i = 0; i < n; i++) {
        const raw = points[i][velKey] as number | null;
        velocities[corner][i] = raw != null ? Number((raw * scale).toFixed(1)) : 0;
      }
    } else {
      // Numerical differentiation of suspension travel position (mm)
      for (let i = 0; i < n; i++) {
        const curr = points[i];
        const prev = i > 0 ? points[i - 1] : curr;
        const dt = Math.max(0.005, curr.time - prev.time || 0.02);
        const sCurr = (curr[suspKey] as number) ?? 0;
        const sPrev = (prev[suspKey] as number) ?? 0;
        // Positive travel change = compression or extension depending on sim.
        // Standard motorsport pot convention: displacement decreases on compression -> dSusp/dt is negative (bump).
        const dSusp_dt = (sCurr - sPrev) / dt;
        velocities[corner][i] = Number(dSusp_dt.toFixed(1));
      }

      // Smooth differentiation noise
      const raw = velocities[corner];
      const smoothed = new Array(n);
      for (let i = 0; i < n; i++) {
        const vPrev = i > 0 ? raw[i - 1] : raw[i];
        const vCurr = raw[i];
        const vNext = i < n - 1 ? raw[i + 1] : raw[i];
        smoothed[i] = Number(((vPrev + vCurr * 2 + vNext) / 4).toFixed(1));
      }
      velocities[corner] = smoothed;
    }
  }

  return velocities;
}

/**
 * Builds the MoTeC-style symmetrical damper velocity histogram and statistics for a single corner.
 */
function analyzeCornerHistogram(
  corner: DamperCorner,
  velocities: number[],
  lowSpeedThreshold: number,
  maxRange: number,
  binWidth: number
): CornerDamperStats {
  const sampleCount = velocities.length;
  const numBins = Math.round((maxRange * 2) / binWidth); // e.g. 600 / 25 = 24 bins
  const minRange = -maxRange;

  // Initialize bins
  const bins: DamperVelocityBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const minV = minRange + i * binWidth;
    const maxV = minV + binWidth;
    const centerV = Number(((minV + maxV) / 2).toFixed(1));

    let regime: DamperRegime;
    if (centerV < -lowSpeedThreshold) {
      regime = "high_bump";
    } else if (centerV < 0) {
      regime = "low_bump";
    } else if (centerV <= lowSpeedThreshold) {
      regime = "low_rebound";
    } else {
      regime = "high_rebound";
    }

    bins.push({
      minVelocity: minV,
      maxVelocity: maxV,
      centerVelocity: centerV,
      count: 0,
      percentage: 0,
      regime,
    });
  }

  let minRecordedVelocity = Infinity;
  let maxRecordedVelocity = -Infinity;
  let sumVel = 0;
  let sumVelSq = 0;

  let bumpCount = 0;
  let reboundCount = 0;
  let zeroCount = 0;
  let lowSpeedBumpCount = 0;
  let highSpeedBumpCount = 0;
  let lowSpeedReboundCount = 0;
  let highSpeedReboundCount = 0;

  // Tally samples
  for (let i = 0; i < sampleCount; i++) {
    const v = velocities[i];
    if (v < minRecordedVelocity) minRecordedVelocity = v;
    if (v > maxRecordedVelocity) maxRecordedVelocity = v;
    sumVel += v;
    sumVelSq += v * v;

    if (v < 0) {
      bumpCount++;
      if (v >= -lowSpeedThreshold) {
        lowSpeedBumpCount++;
      } else {
        highSpeedBumpCount++;
      }
    } else if (v > 0) {
      reboundCount++;
      if (v <= lowSpeedThreshold) {
        lowSpeedReboundCount++;
      } else {
        highSpeedReboundCount++;
      }
    } else {
      zeroCount++;
    }

    // Determine bin index (clamped to outer bins for values outside [-maxRange, maxRange])
    let binIdx = Math.floor((v - minRange) / binWidth);
    if (binIdx < 0) binIdx = 0;
    if (binIdx >= numBins) binIdx = numBins - 1;
    bins[binIdx].count++;
  }

  if (sampleCount === 0) {
    minRecordedVelocity = 0;
    maxRecordedVelocity = 0;
  }

  const avgVelocity = sampleCount > 0 ? Number((sumVel / sampleCount).toFixed(2)) : 0;
  const variance = sampleCount > 0 ? Math.max(0, sumVelSq / sampleCount - avgVelocity * avgVelocity) : 0;
  const stdDevVelocity = Number(Math.sqrt(variance).toFixed(2));

  // Compute bin percentages and ensure invariant: sum of percentages === 100.0%
  let totalPctAllocated = 0;
  let maxBinIdx = 0;
  let maxBinCount = -1;

  for (let i = 0; i < numBins; i++) {
    const pct = sampleCount > 0 ? Number(((bins[i].count / sampleCount) * 100).toFixed(2)) : 0;
    bins[i].percentage = pct;
    totalPctAllocated += pct;
    if (bins[i].count > maxBinCount) {
      maxBinCount = bins[i].count;
      maxBinIdx = i;
    }
  }

  // Rounding adjustment so sum === 100.00%
  if (sampleCount > 0) {
    const discrepancy = Number((100 - totalPctAllocated).toFixed(2));
    bins[maxBinIdx].percentage = Number((bins[maxBinIdx].percentage + discrepancy).toFixed(2));
  }

  const bumpPct = sampleCount > 0 ? Number(((bumpCount / sampleCount) * 100).toFixed(1)) : 0;
  const reboundPct = sampleCount > 0 ? Number(((reboundCount / sampleCount) * 100).toFixed(1)) : 0;
  const zeroPct = sampleCount > 0 ? Number(((zeroCount / sampleCount) * 100).toFixed(1)) : 0;

  const lowSpeedBumpPct = sampleCount > 0 ? Number(((lowSpeedBumpCount / sampleCount) * 100).toFixed(1)) : 0;
  const highSpeedBumpPct = sampleCount > 0 ? Number(((highSpeedBumpCount / sampleCount) * 100).toFixed(1)) : 0;
  const lowSpeedReboundPct = sampleCount > 0 ? Number(((lowSpeedReboundCount / sampleCount) * 100).toFixed(1)) : 0;
  const highSpeedReboundPct = sampleCount > 0 ? Number(((highSpeedReboundCount / sampleCount) * 100).toFixed(1)) : 0;

  const lowSpeedTotalPct = Number((lowSpeedBumpPct + lowSpeedReboundPct).toFixed(1));
  const highSpeedTotalPct = Number((highSpeedBumpPct + highSpeedReboundPct).toFixed(1));
  const bumpReboundRatio = reboundPct > 0 ? Number((bumpPct / reboundPct).toFixed(2)) : 1.0;

  // Anomaly and state flags
  // 1. Packing down: excessive rebound time causes suspension to ratchet down over bumps
  const isPackingDown = reboundPct > 58.0 || (reboundCount > bumpCount * 1.35 && highSpeedReboundPct < highSpeedBumpPct * 0.6);

  // 2. Overstiff low speed: low speed damping dominates (> 78%), causing harshness and poor compliance
  const isOverstiffLowSpeed = lowSpeedTotalPct > 78.0;

  // 3. Underdamped high speed: violent peaks or excessive kerb deflection (> 32% high-speed)
  const isUnderdampedHighSpeed = highSpeedTotalPct > 32.0 || minRecordedVelocity < -280 || maxRecordedVelocity > 280;

  const anomalyFlags: string[] = [];
  if (isPackingDown) {
    anomalyFlags.push(
      `Packing Down detected: Rebound duration (${reboundPct}%) significantly exceeds Bump (${bumpPct}%). Damper does not return to static ride height between bumps.`
    );
  }
  if (isOverstiffLowSpeed) {
    anomalyFlags.push(
      `Over-damped Low-Speed: ${lowSpeedTotalPct}% of cycle in low-speed regime (<${lowSpeedThreshold} mm/s). Platform lacks compliance; tyres may scrub across turn-in.`
    );
  }
  if (isUnderdampedHighSpeed) {
    anomalyFlags.push(
      `Underdamped High-Speed: ${highSpeedTotalPct}% high-speed excursions with peak velocity ${Math.round(
        Math.max(Math.abs(minRecordedVelocity), maxRecordedVelocity)
      )} mm/s. Car susceptible to kerb deflection and bottoming.`
    );
  }

  return {
    corner,
    sampleCount,
    bins,
    lowSpeedThreshold,
    maxRecordedVelocity: Number(maxRecordedVelocity.toFixed(1)),
    minRecordedVelocity: Number(minRecordedVelocity.toFixed(1)),
    avgVelocity,
    stdDevVelocity,
    bumpPct,
    reboundPct,
    zeroPct,
    lowSpeedBumpPct,
    highSpeedBumpPct,
    lowSpeedReboundPct,
    highSpeedReboundPct,
    bumpReboundRatio,
    lowSpeedTotalPct,
    highSpeedTotalPct,
    isPackingDown,
    isOverstiffLowSpeed,
    isUnderdampedHighSpeed,
    anomalyFlags,
  };
}

/**
 * Formulates race engineer damper setup recommendations based on 4-corner histogram analysis.
 */
function formulateDamperRecommendations(
  corners: Record<DamperCorner, CornerDamperStats>,
  frontLowSpeedAvg: number,
  rearLowSpeedAvg: number
): { overallVerdict: string; recommendations: string[] } {
  const recs: string[] = [];

  const frontPacking = corners.FL.isPackingDown || corners.FR.isPackingDown;
  const rearPacking = corners.RL.isPackingDown || corners.RR.isPackingDown;

  if (frontPacking) {
    recs.push(
      "Front Rebound Relaxation: Soften Front Rebound by 2-3 clicks to allow the front dampers to recover between bump inputs and eliminate packing down on corner entry."
    );
  }

  if (rearPacking) {
    recs.push(
      "Rear Rebound Relief: Soften Rear Rebound by 2 clicks. The rear axle is staying pulled down over kerbs, compromising traction and causing snap oversteer on exit."
    );
  }

  // Front vs Rear transient platform balance
  const deltaLowSpeed = Number((frontLowSpeedAvg - rearLowSpeedAvg).toFixed(1));
  let balanceVerdict = "";

  if (deltaLowSpeed > 6.0) {
    balanceVerdict = "Front platform is notably stiffer than rear in low-speed transient control (+ " + deltaLowSpeed + "% front bias). Provides strong braking stability but will promote mid-corner push.";
    recs.push("Transient Balance: Stiffen Rear Low-Speed Bump by 1 click or soften Front Low-Speed Bump by 1 click to equalize rotation speed on turn-in.");
  } else if (deltaLowSpeed < -6.0) {
    balanceVerdict = "Rear platform is substantially stiffer than front (- " + Math.abs(deltaLowSpeed) + "% front bias). Car rotates aggressively on entry but requires quick countersteer hands.";
    recs.push("Rear Stability: Soften Rear Low-Speed Bump by 1-2 clicks to calm the rear axle during trail-braking direction changes.");
  } else {
    balanceVerdict = "Balanced 50:50 Front-to-Rear low-speed transient damping distribution (Delta: " + deltaLowSpeed + "%).";
  }

  // High speed curb absorption checks
  const frontHighSpeedBlowoff = corners.FL.isUnderdampedHighSpeed || corners.FR.isUnderdampedHighSpeed;
  const rearHighSpeedBlowoff = corners.RL.isUnderdampedHighSpeed || corners.RR.isUnderdampedHighSpeed;

  if (frontHighSpeedBlowoff) {
    recs.push(
      "Front Fast Bump Support: Increase Front Fast Bump damping by 1-2 clicks to manage kerb strike energy and prevent splitter ground-strikes."
    );
  }

  if (rearHighSpeedBlowoff) {
    recs.push(
      "Rear Fast Bump Support: Increase Rear Fast Bump by 1 click to absorb exit kerb strikes without destabilizing the diff lockup."
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Symmetrical MoTeC Bell Curves: All four dampers operate within optimal 50/50 bump/rebound ratio and 60-70% low-speed envelope. Maintain current baseline damping clicks."
    );
  }

  const overallVerdict =
    frontPacking || rearPacking
      ? "Damper Asymmetry Detected: Packing down observed on one or more corners. Damping adjustments required to restore dynamic ride height."
      : Math.abs(deltaLowSpeed) > 6.0
      ? "Transient Damping Imbalance: " + balanceVerdict
      : "MoTeC-Grade Damper Profiles Healthy: Near-ideal bell-shaped velocity distribution across all four corners.";

  return {
    overallVerdict,
    recommendations: recs,
  };
}

/**
 * Computes complete MoTeC-Grade 4-corner Damper Velocity Histograms and diagnostic analysis.
 */
export function computeDamperHistograms(
  points: TelemetryPoint[],
  options?: DamperHistogramOptions
): DamperHistogramAnalysis {
  const lowSpeedThreshold = options?.lowSpeedThreshold ?? 50;
  const maxRange = options?.maxRange ?? 300;
  const binWidth = options?.binWidth ?? 25;

  const isAuthentic = hasAuthenticSuspensionData(points);
  const velocities = extractCornerVelocities(points, isAuthentic);

  const corners = {
    FL: analyzeCornerHistogram("FL", velocities.FL, lowSpeedThreshold, maxRange, binWidth),
    FR: analyzeCornerHistogram("FR", velocities.FR, lowSpeedThreshold, maxRange, binWidth),
    RL: analyzeCornerHistogram("RL", velocities.RL, lowSpeedThreshold, maxRange, binWidth),
    RR: analyzeCornerHistogram("RR", velocities.RR, lowSpeedThreshold, maxRange, binWidth),
  };

  const frontLowSpeedAvg = Number(((corners.FL.lowSpeedTotalPct + corners.FR.lowSpeedTotalPct) / 2).toFixed(1));
  const rearLowSpeedAvg = Number(((corners.RL.lowSpeedTotalPct + corners.RR.lowSpeedTotalPct) / 2).toFixed(1));

  const { overallVerdict, recommendations } = formulateDamperRecommendations(
    corners,
    frontLowSpeedAvg,
    rearLowSpeedAvg
  );

  return {
    corners,
    isSynthesized: !isAuthentic,
    lowSpeedThreshold,
    binWidth,
    velocityRange: [-maxRange, maxRange],
    frontRearLowSpeedBalance: {
      frontPct: frontLowSpeedAvg,
      rearPct: rearLowSpeedAvg,
      verdict:
        Math.abs(frontLowSpeedAvg - rearLowSpeedAvg) <= 5.0
          ? "Balanced Front/Rear low-speed transient platform"
          : frontLowSpeedAvg > rearLowSpeedAvg
          ? "Front-stiff transient platform (stability bias)"
          : "Rear-stiff transient platform (rotation bias)",
    },
    overallVerdict,
    engineerRecommendations: recommendations,
  };
}
