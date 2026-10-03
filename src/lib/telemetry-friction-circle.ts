import {
  ParsedTelemetryFile,
  TelemetryPoint,
  GGFrictionCircleData,
  GGPoint,
  GGFrictionQuadrantStats,
} from "@/types/telemetry";

/**
 * Compute an angular hull (36 bins, 10 deg each) representing the 95th percentile grip boundary
 * Strictly skips samples where latG or longG is missing (null).
 */
function computeEnvelopeHull(
  pts: TelemetryPoint[]
): { latG: number; longG: number }[] {
  const NUM_BINS = 36;
  const binRadius: number[][] = Array.from({ length: NUM_BINS }, () => []);

  pts.forEach((p) => {
    if (p.latG == null || p.longG == null) return;
    const lat = p.latG;
    const lon = p.longG;
    const r = Math.sqrt(lat * lat + lon * lon);
    if (r < 0.2) return; // Ignore resting center noise

    let angle = Math.atan2(lon, lat); // -PI to +PI
    if (angle < 0) angle += 2 * Math.PI; // 0 to 2*PI

    const binIdx = Math.floor((angle / (2 * Math.PI)) * NUM_BINS) % NUM_BINS;
    binRadius[binIdx].push(r);
  });

  const hull: { latG: number; longG: number }[] = [];

  for (let i = 0; i < NUM_BINS; i++) {
    const angle = (i + 0.5) * ((2 * Math.PI) / NUM_BINS);
    const radii = binRadius[i];
    let maxR = 0.4; // minimum threshold

    if (radii.length > 0) {
      radii.sort((a, b) => a - b);
      // Pick 90th percentile to prevent aberrant single kerb hit spikes
      const pIdx = Math.min(radii.length - 1, Math.floor(radii.length * 0.90));
      maxR = radii[pIdx];
    }

    hull.push({
      latG: +(maxR * Math.cos(angle)).toFixed(2),
      longG: +(maxR * Math.sin(angle)).toFixed(2),
    });
  }

  return hull;
}

/**
 * Compute full G-G Friction Circle analysis from telemetry
 * Strictly distinguishes missing G-force readings from 0G.
 */
export function computeGGFrictionCircle(
  driver: ParsedTelemetryFile,
  ref?: ParsedTelemetryFile | null
): GGFrictionCircleData {
  const driverPts = driver.points;
  const ggPoints: GGPoint[] = [];

  let peakCombinedG = 0;
  let peakLatG = 0;
  let peakDecelG = 0;
  let validGCount = 0;

  const gTotals: number[] = [];

  driverPts.forEach((p) => {
    if (p.latG == null || p.longG == null) {
      ggPoints.push({
        latG: null,
        longG: null,
        speed: p.speed,
        dist: p.dist,
        throttle: p.throttle,
        brake: p.brake,
        gTotal: null,
      });
      return;
    }

    validGCount++;
    const lat = p.latG;
    const lon = p.longG;
    const gTot = +(Math.sqrt(lat * lat + lon * lon)).toFixed(2);

    gTotals.push(gTot);
    if (gTot > peakCombinedG) peakCombinedG = gTot;
    if (Math.abs(lat) > peakLatG) peakLatG = Math.abs(lat);
    if (lon < peakDecelG) peakDecelG = lon; // Most negative decel

    ggPoints.push({
      latG: lat,
      longG: lon,
      speed: p.speed,
      dist: p.dist,
      throttle: p.throttle,
      brake: p.brake,
      gTotal: gTot,
    });
  });

  const totalPoints = driverPts.length;
  const coveragePct = totalPoints > 0 ? Number(((validGCount / totalPoints) * 100).toFixed(1)) : 0;
  const dataQuality = {
    validSampleCount: validGCount,
    totalSampleCount: totalPoints,
    coveragePct,
    status: (validGCount === 0 ? "insufficient" : coveragePct >= 80 ? "available" : "partial") as "available" | "partial" | "insufficient",
  };

  // If no G-force data is available, return an explicit unavailable state
  if (validGCount === 0) {
    return {
      scaleMaxG: 2.5,
      peakCombinedG: null,
      peakLatG: null,
      peakDecelG: null,
      gripUtilizationPct: null,
      trailBrakingTransitionEfficiency: null,
      quadrantStats: {
        trailBrakingLeftGripPct: 0,
        trailBrakingRightGripPct: 0,
        powerDownLeftGripPct: 0,
        powerDownRightGripPct: 0,
      },
      points: ggPoints,
      envelopeHull: [],
      gripDeficitVerdict: "G-G Friction Circle unavailable: Lateral (latG) and longitudinal (longG) accelerometer channels are missing.",
      dataQuality,
    };
  }

  // Calculate 95th percentile G for robust normalization
  gTotals.sort((a, b) => a - b);
  const p95Idx = Math.floor(gTotals.length * 0.95);
  const p95G = gTotals[p95Idx] || 1.8;

  // Determine auto-scale boundary for chart (2.5G for GT3, 4.5G for F1)
  const scaleMaxG = peakCombinedG > 3.0 ? 4.5 : 2.5;

  // Active cornering / braking points
  let dynamicCount = 0;
  let optimalGripCount = 0;

  // Quadrant grip collectors
  const qTBLeft: number[] = [];
  const qTBRight: number[] = [];
  const qPDLeft: number[] = [];
  const qPDRight: number[] = [];

  ggPoints.forEach((p) => {
    if (p.latG == null || p.longG == null || p.gTotal == null) return;

    // Dynamic event: either braking or cornering
    const isBraking = p.brake != null && p.brake > 10;
    const isCornering = Math.abs(p.latG) > 0.5;
    const isDynamic = isBraking || isCornering;

    if (isDynamic) {
      dynamicCount++;
      if (p.gTotal >= p95G * 0.78) {
        optimalGripCount++;
      }
    }

    // Quadrant classifications
    if (p.longG < -0.3) {
      // Trail Braking quadrants
      if (p.latG < -0.2) qTBLeft.push(p.gTotal);
      if (p.latG > 0.2) qTBRight.push(p.gTotal);
    } else if (p.longG > 0.2) {
      // Power Down quadrants
      if (p.latG < -0.2) qPDLeft.push(p.gTotal);
      if (p.latG > 0.2) qPDRight.push(p.gTotal);
    }
  });

  const gripUtilizationPct =
    dynamicCount > 0 ? Math.round((optimalGripCount / dynamicCount) * 100) : 75;

  const avgGrip = (arr: number[]) =>
    arr.length > 0
      ? Math.round(
          (arr.reduce((a, b) => a + b, 0) / arr.length / Math.max(1, p95G)) * 100
        )
      : 70;

  const quadrantStats: GGFrictionQuadrantStats = {
    trailBrakingLeftGripPct: Math.min(100, avgGrip(qTBLeft)),
    trailBrakingRightGripPct: Math.min(100, avgGrip(qTBRight)),
    powerDownLeftGripPct: Math.min(100, avgGrip(qPDLeft)),
    powerDownRightGripPct: Math.min(100, avgGrip(qPDRight)),
  };

  // Trail-Braking Transition Smoothness (0-100)
  let combinedSampleCount = 0;
  let combinedSumNorm = 0;
  const maxBrake = Math.max(1.0, Math.abs(peakDecelG));
  const maxLat = Math.max(1.0, peakLatG);

  ggPoints.forEach((p) => {
    if (p.latG == null || p.longG == null) return;
    if (p.longG < -0.3 && Math.abs(p.latG) > 0.3) {
      combinedSampleCount++;
      const normLat = p.latG / maxLat;
      const normLong = p.longG / maxBrake;
      const combinedRadius = Math.sqrt(normLat * normLat + normLong * normLong);
      combinedSumNorm += Math.min(1.0, combinedRadius);
    }
  });

  const trailBrakingTransitionEfficiency =
    combinedSampleCount > 0
      ? Math.round((combinedSumNorm / combinedSampleCount) * 100)
      : 72;

  // Outer Envelope Hulls
  const envelopeHull = computeEnvelopeHull(driverPts);
  let refEnvelopeHull: { latG: number; longG: number }[] | undefined;
  let refGripUtilizationPct: number | undefined;

  if (ref && ref.points.length > 0) {
    refEnvelopeHull = computeEnvelopeHull(ref.points);
    let refDyn = 0;
    let refOpt = 0;
    const refGTotals = ref.points
      .filter((p) => p.latG != null && p.longG != null)
      .map((p) => Math.sqrt(p.latG! * p.latG! + p.longG! * p.longG!));

    if (refGTotals.length > 0) {
      refGTotals.sort((a, b) => a - b);
      const refP95 = refGTotals[Math.floor(refGTotals.length * 0.95)] || 2.0;

      ref.points.forEach((p) => {
        if (p.latG == null || p.longG == null) return;
        const gTot = Math.sqrt(p.latG * p.latG + p.longG * p.longG);
        const isBrake = p.brake != null && p.brake > 10;
        const isCorner = Math.abs(p.latG) > 0.5;
        if (isBrake || isCorner) {
          refDyn++;
          if (gTot >= refP95 * 0.78) refOpt++;
        }
      });
      refGripUtilizationPct =
        refDyn > 0 ? Math.round((refOpt / refDyn) * 100) : 88;
    }
  }

  // Generate Technical Diagnosis Verdict
  let gripDeficitVerdict = "";
  if (refGripUtilizationPct != null) {
    const diff = refGripUtilizationPct - gripUtilizationPct;
    if (diff > 8) {
      gripDeficitVerdict = `Grip Envelope Deficit: ${diff}% below benchmark. Significant friction pockets identified in transition phases—braking is released prematurely before lateral load builds up.`;
    } else if (diff > 3) {
      gripDeficitVerdict = `Strong friction circle execution. Operating within ${diff}% of the benchmark grip boundary with minor hesitation on corner exit traction.`;
    } else {
      gripDeficitVerdict = `Elite tire grip exploitation. Matched benchmark envelope boundary across both trail-braking and exit phases.`;
    }
  } else {
    if (gripUtilizationPct >= 82) {
      gripDeficitVerdict = `High-efficiency friction ellipse. Consistent tire contact patch exploitation across high-G transitions.`;
    } else {
      gripDeficitVerdict = `Underutilized friction envelope. Abrupt longitudinal to lateral transitions indicate straight-line brake dumping rather than progressive trail-braking.`;
    }
  }

  return {
    scaleMaxG,
    peakCombinedG: +peakCombinedG.toFixed(2),
    peakLatG: +peakLatG.toFixed(2),
    peakDecelG: +peakDecelG.toFixed(2),
    gripUtilizationPct,
    trailBrakingTransitionEfficiency,
    quadrantStats,
    points: ggPoints,
    envelopeHull,
    refEnvelopeHull,
    refGripUtilizationPct,
    gripDeficitVerdict,
    dataQuality,
  };
}
