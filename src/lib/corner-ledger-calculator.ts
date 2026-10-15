import {
  TelemetryPoint,
  LapComparisonSummary,
  CornerLedgerItem,
  CornerLedgerAnalysis,
} from "@/types/telemetry";
import { getAuthenticTrackGeometry } from "./circuit-geometries";

export function computeCornerLedger(
  points: TelemetryPoint[],
  lapComparison?: LapComparisonSummary | null,
  trackName: string = "Circuit de Spa-Francorchamps"
): CornerLedgerAnalysis {
  if (!points || points.length === 0) {
    return {
      corners: [],
      totalTimeLostInCornersSeconds: 0,
      biggestLossCorner: "None",
      biggestGainCorner: "None",
      averageApexSpeedDeltaKmh: 0,
      brakingConsistencyScore: 85,
      overallCorneringEfficiencyPct: 80,
    };
  }

  const geometry = getAuthenticTrackGeometry(trackName);

  // 1. Establish corner targets from authentic geometry or lapComparison
  interface CornerTarget {
    id: string;
    cornerNumber: number;
    name: string;
    dist: number;
  }

  let cornerTargets: CornerTarget[] = [];

  if (geometry && geometry.corners && geometry.corners.length > 0) {
    cornerTargets = geometry.corners.map((c, idx) => ({
      id: c.shortName || `T${idx + 1}`,
      cornerNumber: idx + 1,
      name: c.name || `Turn ${idx + 1}`,
      dist: c.dist,
    }));
  } else if (lapComparison && lapComparison.cornerComparisons && lapComparison.cornerComparisons.length > 0) {
    cornerTargets = lapComparison.cornerComparisons.map((c, idx) => ({
      id: c.shortName || `T${idx + 1}`,
      cornerNumber: idx + 1,
      name: c.corner,
      dist: c.dist,
    }));
  } else {
    // Fallback: Detect physical local speed minima where lateral acceleration |latG| > 0.5G
    let lastApexDist = -300;
    let turnCount = 1;
    for (let i = 15; i < points.length - 15; i++) {
      const p = points[i];
      if (p.dist - lastApexDist < 160) continue;
      const isLocalMin =
        p.speed != null &&
        points[i - 5]?.speed != null &&
        points[i + 5]?.speed != null &&
        p.speed <= points[i - 5].speed! &&
        p.speed <= points[i + 5].speed! &&
        p.speed < 230 &&
        Math.abs(p.latG || 0) > 0.5;

      if (isLocalMin) {
        cornerTargets.push({
          id: `T${turnCount}`,
          cornerNumber: turnCount,
          name: `Turn ${turnCount}`,
          dist: p.dist,
        });
        turnCount++;
        lastApexDist = p.dist;
      }
    }
  }

  // Measure demonstrated peak vehicle deceleration and lateral grip capacity from telemetry
  let peakLapDecelG = 1.4;
  let peakLapLatG = 1.6;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.longG != null && pt.longG < -peakLapDecelG) {
      peakLapDecelG = Math.abs(pt.longG);
    }
    if (pt.latG != null && Math.abs(pt.latG) > peakLapLatG) {
      peakLapLatG = Math.abs(pt.latG);
    }
  }
  const peakDecelAccMs2 = peakLapDecelG * 9.80665;
  const peakLatAccMs2 = peakLapLatG * 9.80665;

  // 2. Compute Phase-by-Phase Performance for Each Corner
  const ledgerItems: CornerLedgerItem[] = [];
  let totalTimeLost = 0;
  let biggestLoss = { corner: "None", delta: -Infinity };
  let biggestGain = { corner: "None", delta: Infinity };
  let speedDeltaSum = 0;
  let countWithDelta = 0;
  const brakeDeltaList: number[] = [];
  const cornerEfficiencyList: number[] = [];

  cornerTargets.forEach((target) => {
    const apexDist = target.dist;
    let apexIdx = 0;
    let minD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].dist - apexDist);
      if (d < minD) {
        minD = d;
        apexIdx = i;
      }
    }

    const apexPoint = points[apexIdx] || points[0];
    const driverApexSpeed = apexPoint.speed != null ? Math.round(apexPoint.speed) : 100;
    const apexLatG = apexPoint.latG != null ? Number(Math.abs(apexPoint.latG).toFixed(2)) : 1.5;

    // Scan backward to identify discrete braking onset
    let brakeStartDist = apexDist - 60;
    let entrySpeed = driverApexSpeed + 50;
    let cornerPeakDecelG = 1.2;

    for (let i = apexIdx; i >= Math.max(0, apexIdx - 120); i--) {
      const pt = points[i];
      if (pt.longG != null && Math.abs(pt.longG) > cornerPeakDecelG && pt.longG < 0) {
        cornerPeakDecelG = Math.abs(pt.longG);
      }
      if (pt.brake != null && pt.brake > 15) {
        brakeStartDist = pt.dist;
        entrySpeed = pt.speed != null ? pt.speed : entrySpeed;
      } else if (pt.brake != null && pt.brake < 5 && brakeStartDist > pt.dist) {
        break; // found initiation threshold
      }
    }

    // Scan forward to find full throttle commit point
    let throttleCommitDist = apexDist + 40;
    let exitSpeed = driverApexSpeed + 30;

    for (let i = apexIdx; i < Math.min(points.length, apexIdx + 90); i++) {
      const pt = points[i];
      if (pt.throttle != null && pt.throttle > 90) {
        throttleCommitDist = pt.dist;
        exitSpeed = pt.speed != null ? Math.round(pt.speed) : exitSpeed;
        break;
      }
      if (pt.speed != null && pt.speed > exitSpeed) {
        exitSpeed = Math.round(pt.speed);
      }
    }
    if (exitSpeed <= driverApexSpeed) {
      exitSpeed = driverApexSpeed + 25;
    }

    // Check if lapComparison has matching corner data
    const matchedComparison = lapComparison?.cornerComparisons?.find(
      (c) =>
        c.corner.toLowerCase().includes(target.name.toLowerCase()) ||
        c.shortName?.toLowerCase() === target.id.toLowerCase() ||
        Math.abs(c.dist - apexDist) < 140
    );

    let brakeDeltaMeters: number;
    let refApexSpeed: number;
    let apexSpeedDelta: number;
    let throttleCommitDeltaMeters: number;
    let totalCornerTimeDelta: number;
    let entryTimeDelta: number;
    let apexTimeDelta: number;
    let exitTimeDelta: number;

    if (matchedComparison) {
      brakeDeltaMeters = matchedComparison.brakingPointDeltaMeters ?? 0;
      refApexSpeed = matchedComparison.refMinSpeed ?? Math.round(driverApexSpeed + 3);
      apexSpeedDelta = matchedComparison.speedDelta ?? Number((driverApexSpeed - refApexSpeed).toFixed(1));
      throttleCommitDeltaMeters = matchedComparison.throttleCommitDeltaMeters ?? 0;
      totalCornerTimeDelta = matchedComparison.timeDelta;

      // Phase splits derived from authentic physics deltas
      const vEntryMs = Math.max(15, entrySpeed / 3.6);
      const vApexMs = Math.max(10, driverApexSpeed / 3.6);
      const avgEntrySpeedMs = (vEntryMs + vApexMs) / 2;

      entryTimeDelta = Number((brakeDeltaMeters / avgEntrySpeedMs).toFixed(3));
      const cornerRadiusM = Math.max(12, (vApexMs * vApexMs) / Math.max(0.5 * 9.81, apexLatG * 9.81));
      const apexArcLengthM = Math.min(120, Math.max(25, cornerRadiusM * (Math.PI / 3)));
      const vRefApexMs = Math.max(10, refApexSpeed / 3.6);
      apexTimeDelta = Number((apexArcLengthM * (1 / vApexMs - 1 / vRefApexMs)).toFixed(3));
      exitTimeDelta = Number((totalCornerTimeDelta - entryTimeDelta - apexTimeDelta).toFixed(3));
    } else {
      // ----------------------------------------------------------------------
      // REAL VEHICLE DYNAMICS FIRST-PRINCIPLES MATHEMATICS
      // ----------------------------------------------------------------------
      const vEntryMs = Math.max(15, entrySpeed / 3.6);
      const vApexMs = Math.max(10, driverApexSpeed / 3.6);
      const avgEntrySpeedMs = (vEntryMs + vApexMs) / 2;

      // 1. Kinetic energy work: d_brake_optimal = (v_entry^2 - v_apex^2) / (2 * a_decel_max)
      const optimalBrakeDistM = (Math.pow(vEntryMs, 2) - Math.pow(vApexMs, 2)) / (2 * peakDecelAccMs2);
      const observedBrakeDistM = Math.max(10, apexDist - brakeStartDist);
      brakeDeltaMeters = Math.round(observedBrakeDistM - optimalBrakeDistM);
      entryTimeDelta = Number((brakeDeltaMeters / avgEntrySpeedMs).toFixed(3));

      // 2. Steady-state cornering radius & optimal speed: v_opt = sqrt(a_lat_max * R)
      const actualLatAccMs2 = Math.max(3.0, apexLatG * 9.80665);
      const cornerRadiusM = Math.max(12, Math.pow(vApexMs, 2) / actualLatAccMs2);
      const optimalApexSpeedMs = Math.sqrt(peakLatAccMs2 * cornerRadiusM);
      refApexSpeed = Math.round(optimalApexSpeedMs * 3.6);
      apexSpeedDelta = Number((driverApexSpeed - refApexSpeed).toFixed(1));

      // Time delta over the corner arc length: Delta t = L * (1/v_actual - 1/v_optimal)
      const apexArcLengthM = Math.min(120, Math.max(25, cornerRadiusM * (Math.PI / 3)));
      apexTimeDelta = Number((apexArcLengthM * (1 / vApexMs - 1 / optimalApexSpeedMs)).toFixed(3));

      // 3. Exit traction boundary from friction ellipse:
      // Lateral load threshold allowing full longitudinal throttle pickup
      const optimalCommitOffsetM = Math.min(50, Math.max(15, cornerRadiusM * 0.45));
      const observedCommitOffsetM = Math.max(5, throttleCommitDist - apexDist);
      throttleCommitDeltaMeters = Math.round(optimalCommitOffsetM - observedCommitOffsetM);

      const vExitMs = Math.max(vApexMs + 5, exitSpeed / 3.6);
      const avgExitSpeedMs = (vApexMs + vExitMs) / 2;
      exitTimeDelta = Number((-throttleCommitDeltaMeters / avgExitSpeedMs).toFixed(3));

      totalCornerTimeDelta = Number((entryTimeDelta + apexTimeDelta + exitTimeDelta).toFixed(3));
    }

    brakeDeltaList.push(brakeDeltaMeters);
    const cornerEfficiency = Math.min(100, Math.max(40, (driverApexSpeed / Math.max(1, refApexSpeed)) * 100));
    cornerEfficiencyList.push(cornerEfficiency);

    // Status classification
    let status: "gained" | "lost" | "neutral" = "neutral";
    if (totalCornerTimeDelta > 0.03) status = "lost";
    else if (totalCornerTimeDelta < -0.03) status = "gained";

    // Actionable root-cause verdict & coaching cue
    let verdictBadge = "Solid Phase Execution";
    let coachingCue = "Consistent corner profile through all three phases.";

    if (totalCornerTimeDelta > 0.15) {
      if (apexSpeedDelta < -5) {
        verdictBadge = `Overslowed Apex (${apexSpeedDelta.toFixed(0)} km/h)`;
        coachingCue = `Release brake earlier into apex; car has capacity for higher minimum rolling speed (+${Math.abs(apexSpeedDelta).toFixed(0)} km/h).`;
      } else if (brakeDeltaMeters > 8) {
        verdictBadge = `Braked ${Math.abs(brakeDeltaMeters)}m Early`;
        coachingCue = `Push braking marker ${Math.abs(brakeDeltaMeters)}m deeper; use high initial pedal pressure to compress braking zone.`;
      } else if (throttleCommitDeltaMeters < -8) {
        verdictBadge = `Delayed Throttle (${Math.abs(throttleCommitDeltaMeters)}m)`;
        coachingCue = "Unwind steering lock earlier on exit to commit to 100% throttle sooner without snap oversteer.";
      } else {
        verdictBadge = `Time Loss (+${totalCornerTimeDelta.toFixed(2)}s)`;
        coachingCue = "Sub-optimal entry-to-exit trajectory; focus on squaring off the exit.";
      }
    } else if (totalCornerTimeDelta < -0.05) {
      if (apexSpeedDelta > 2) {
        verdictBadge = `High Rolling Speed (+${apexSpeedDelta.toFixed(0)} km/h)`;
        coachingCue = "Excellent mid-corner grip carry; platform balanced right on friction circle threshold.";
      } else {
        verdictBadge = `Pace Advantage (${totalCornerTimeDelta.toFixed(2)}s)`;
        coachingCue = "Superior exit traction and committed throttle pickup.";
      }
    }

    if (totalCornerTimeDelta > 0) {
      totalTimeLost += totalCornerTimeDelta;
    }

    if (totalCornerTimeDelta > biggestLoss.delta) {
      biggestLoss = { corner: target.name, delta: totalCornerTimeDelta };
    }
    if (totalCornerTimeDelta < biggestGain.delta) {
      biggestGain = { corner: target.name, delta: totalCornerTimeDelta };
    }

    speedDeltaSum += apexSpeedDelta;
    countWithDelta++;

    ledgerItems.push({
      id: target.id,
      cornerNumber: target.cornerNumber,
      name: target.name,
      dist: Math.round(apexDist),
      brakeStartDistMeters: Math.round(brakeStartDist),
      brakeDeltaMeters,
      entryPeakDecelG: Number(cornerPeakDecelG.toFixed(2)),
      entryTimeDeltaSeconds: entryTimeDelta,
      driverApexSpeedKmh: driverApexSpeed,
      refApexSpeedKmh: refApexSpeed,
      apexSpeedDeltaKmh: apexSpeedDelta,
      apexLatG,
      apexTimeDeltaSeconds: apexTimeDelta,
      throttleCommitDistMeters: Math.round(throttleCommitDist),
      throttleCommitDeltaMeters,
      exitSpeedKmh: exitSpeed,
      exitTimeDeltaSeconds: exitTimeDelta,
      totalCornerTimeDeltaSeconds: Number(totalCornerTimeDelta.toFixed(3)),
      status,
      verdictBadge,
      coachingCue,
    });
  });

  const avgApexSpeedDelta = countWithDelta > 0 ? Number((speedDeltaSum / countWithDelta).toFixed(1)) : 0;

  // Statistical standard deviation of braking point error: sigma = sqrt(sum((x - mean)^2) / N)
  let brakeConsistency = 88;
  if (brakeDeltaList.length > 1) {
    const meanBrakeDelta = brakeDeltaList.reduce((a, b) => a + b, 0) / brakeDeltaList.length;
    const variance =
      brakeDeltaList.reduce((sum, val) => sum + Math.pow(val - meanBrakeDelta, 2), 0) / brakeDeltaList.length;
    const stdDevMeters = Math.sqrt(variance);
    brakeConsistency = Math.max(45, Math.min(98, Math.round(100 - stdDevMeters * 3.2)));
  }

  // Mean Cornering Efficiency across all corners
  const overallEfficiency =
    cornerEfficiencyList.length > 0
      ? Math.round(cornerEfficiencyList.reduce((a, b) => a + b, 0) / cornerEfficiencyList.length)
      : 80;

  return {
    corners: ledgerItems,
    totalTimeLostInCornersSeconds: Number(totalTimeLost.toFixed(3)),
    biggestLossCorner: biggestLoss.delta > 0.05 ? biggestLoss.corner : "None",
    biggestGainCorner: biggestGain.delta < -0.03 ? biggestGain.corner : "None",
    averageApexSpeedDeltaKmh: avgApexSpeedDelta,
    brakingConsistencyScore: brakeConsistency,
    overallCorneringEfficiencyPct: overallEfficiency,
  };
}
