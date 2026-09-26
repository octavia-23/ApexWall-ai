import {
  ParsedTelemetryFile,
  TelemetryPoint,
  LapComparisonSummary,
  CornerDeltaComparison,
  DeltaPoint,
} from "@/types/telemetry";

/**
 * Linearly interpolate a value from points array at a target distance
 */
function interpolateAtDist(points: TelemetryPoint[], targetDist: number): TelemetryPoint {
  if (points.length === 0) {
    return {
      time: 0,
      dist: targetDist,
      speed: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 6000,
      latG: 0,
      longG: 0,
      tempFL: 80,
      tempFR: 80,
      tempRL: 80,
      tempRR: 80,
      pressFL: 26.5,
      pressFR: 26.5,
      pressRL: 26.5,
      pressRR: 26.5,
    };
  }

  if (targetDist <= points[0].dist) return points[0];
  if (targetDist >= points[points.length - 1].dist) return points[points.length - 1];

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].dist === targetDist) return points[mid];
    if (points[mid].dist < targetDist) low = mid + 1;
    else high = mid - 1;
  }

  const p0 = points[Math.max(0, high)];
  const p1 = points[Math.min(points.length - 1, low)];
  const distRange = p1.dist - p0.dist;
  if (distRange <= 0.0001) return p0;

  const factor = (targetDist - p0.dist) / distRange;

  return {
    time: p0.time + (p1.time - p0.time) * factor,
    dist: targetDist,
    speed: +(p0.speed + (p1.speed - p0.speed) * factor).toFixed(1),
    throttle: Math.round(p0.throttle + (p1.throttle - p0.throttle) * factor),
    brake: Math.round(p0.brake + (p1.brake - p0.brake) * factor),
    steer: +(p0.steer + (p1.steer - p0.steer) * factor).toFixed(1),
    gear: Math.round(p0.gear + (p1.gear - p0.gear) * factor),
    rpm: Math.round(p0.rpm + (p1.rpm - p0.rpm) * factor),
    latG: +(p0.latG + (p1.latG - p0.latG) * factor).toFixed(2),
    longG: +(p0.longG + (p1.longG - p0.longG) * factor).toFixed(2),
    tempFL: p0.tempFL,
    tempFR: p0.tempFR,
    tempRL: p0.tempRL,
    tempRR: p0.tempRR,
    pressFL: p0.pressFL,
    pressFR: p0.pressFR,
    pressRL: p0.pressRL,
    pressRR: p0.pressRR,
  };
}

/**
 * Linearly interpolate time delta from deltaPoints array at target distance
 */
function interpolateDeltaAtDist(deltaPoints: DeltaPoint[], targetDist: number): number {
  if (deltaPoints.length === 0) return 0;
  if (targetDist <= deltaPoints[0].dist) return deltaPoints[0].timeDelta;
  if (targetDist >= deltaPoints[deltaPoints.length - 1].dist) {
    return deltaPoints[deltaPoints.length - 1].timeDelta;
  }

  let low = 0;
  let high = deltaPoints.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (deltaPoints[mid].dist === targetDist) return deltaPoints[mid].timeDelta;
    if (deltaPoints[mid].dist < targetDist) low = mid + 1;
    else high = mid - 1;
  }

  const p0 = deltaPoints[Math.max(0, high)];
  const p1 = deltaPoints[Math.min(deltaPoints.length - 1, low)];
  const range = p1.dist - p0.dist;
  if (range <= 0.0001) return p0.timeDelta;

  const factor = (targetDist - p0.dist) / range;
  return +(p0.timeDelta + (p1.timeDelta - p0.timeDelta) * factor).toFixed(3);
}

import { REAL_CIRCUITS, RealCircuitDefinition } from "./circuit-geometries";

/**
 * Identify circuit by track name, filenames, or total distance
 */
function detectCircuit(
  driver: ParsedTelemetryFile,
  ref: ParsedTelemetryFile,
  trackHint?: string
): RealCircuitDefinition | null {
  const combined = `${trackHint || ""} ${driver.filename || ""} ${ref.filename || ""}`.toLowerCase();
  if (combined.includes("spa")) return REAL_CIRCUITS.spa;
  if (combined.includes("monza")) return REAL_CIRCUITS.monza;
  if (combined.includes("silverstone")) return REAL_CIRCUITS.silverstone;

  const maxDist = driver.points[driver.points.length - 1]?.dist || 0;
  if (maxDist >= 6700 && maxDist <= 7300) return REAL_CIRCUITS.spa;
  if (maxDist >= 5650 && maxDist <= 5850) return REAL_CIRCUITS.monza;
  if (maxDist >= 5851 && maxDist <= 6000) return REAL_CIRCUITS.silverstone;

  return null;
}

/**
 * Compare Driver Lap with Reference Lap (Ghost Lap Overlay)
 */
export function computeLapComparison(
  driver: ParsedTelemetryFile,
  ref: ParsedTelemetryFile,
  trackHint?: string
): LapComparisonSummary {
  const deltaPoints: DeltaPoint[] = [];
  const driverPts = driver.points;
  const refPts = ref.points;

  // Build synchronized delta points along driver's distance axis
  for (let i = 0; i < driverPts.length; i++) {
    const dPt = driverPts[i];
    const rPt = interpolateAtDist(refPts, dPt.dist);

    // Time Delta: positive means driver took longer (time lost)
    const timeDelta = +(dPt.time - rPt.time).toFixed(3);
    const speedDelta = +(dPt.speed - rPt.speed).toFixed(1);

    deltaPoints.push({
      dist: dPt.dist,
      timeDelta,
      speedDelta,
      driverSpeed: dPt.speed,
      refSpeed: rPt.speed,
      driverThrottle: dPt.throttle,
      refThrottle: rPt.throttle,
      driverBrake: dPt.brake,
      refBrake: rPt.brake,
    });
  }

  // Calculate net total time delta
  const finalDriverTime = driverPts[driverPts.length - 1]?.time || 0;
  const finalRefTime = refPts[refPts.length - 1]?.time || 0;
  const totalTimeDeltaSeconds = +(finalDriverTime - finalRefTime).toFixed(3);
  const topSpeedDeltaKmh = +(driver.topSpeed - ref.topSpeed).toFixed(1);

  // Identify Corner Candidates:
  // 1. If authentic circuit matched, extract apexes for all authentic named corners.
  // 2. Otherwise run dynamic adaptive apex detection across the full lap distance.
  const cornerComparisons: CornerDeltaComparison[] = [];
  const circuit = detectCircuit(driver, ref, trackHint);

  interface CornerCandidate {
    name: string;
    shortName: string;
    apexIdx: number;
  }
  const candidates: CornerCandidate[] = [];

  if (circuit) {
    const totalDriverDist = driverPts[driverPts.length - 1]?.dist || circuit.officialDistance;
    circuit.corners.forEach((target, cIdx) => {
      const prevCorner = circuit.corners[cIdx - 1];
      const nextCorner = circuit.corners[cIdx + 1];
      const targetDist = (target.dist / circuit.officialDistance) * totalDriverDist;

      const prevDist = prevCorner ? (prevCorner.dist / circuit.officialDistance) * totalDriverDist : 0;
      const nextDist = nextCorner ? (nextCorner.dist / circuit.officialDistance) * totalDriverDist : totalDriverDist;

      // Bounded search window: cannot overlap into adjacent corners
      const distToPrev = targetDist - prevDist;
      const distToNext = nextDist - targetDist;
      const maxHalfDist = Math.min(distToPrev, distToNext) * 0.48;
      const searchRadius = Math.max(40, Math.min(160, maxHalfDist));

      let minSpeed = Infinity;
      let bestIdx = -1;
      let closestIdx = -1;
      let closestDiff = Infinity;

      for (let i = 0; i < driverPts.length; i++) {
        const pt = driverPts[i];
        const diff = Math.abs(pt.dist - targetDist);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = i;
        }
        if (diff <= searchRadius) {
          const currentBestDiff = bestIdx !== -1 ? Math.abs(driverPts[bestIdx].dist - targetDist) : Infinity;
          if (pt.speed < minSpeed || (pt.speed === minSpeed && diff < currentBestDiff)) {
            minSpeed = pt.speed;
            bestIdx = i;
          }
        }
      }

      const finalIdx = bestIdx !== -1 ? bestIdx : closestIdx;
      if (finalIdx !== -1) {
        candidates.push({ name: target.name, shortName: target.shortName, apexIdx: finalIdx });
      }
    });
  } else {
    // Dynamic Adaptive Apex Detection for ANY circuit
    let inCorner = false;
    let minIdx = 0;

    for (let i = 1; i < driverPts.length - 1; i++) {
      const isDecel =
        driverPts[i].brake > 15 ||
        Math.abs(driverPts[i].latG) > 0.75 ||
        driverPts[i].speed < driverPts[i - 1].speed;

      if (isDecel && !inCorner) {
        inCorner = true;
        minIdx = i;
      } else if (inCorner) {
        if (driverPts[i].speed <= driverPts[minIdx].speed) {
          minIdx = i;
        }
        const isExit =
          (driverPts[i].throttle > 40 &&
            driverPts[i].brake < 5 &&
            driverPts[i].speed > driverPts[minIdx].speed + 8) ||
          i === driverPts.length - 2;

        if (isExit) {
          inCorner = false;
          const apexDist = driverPts[minIdx].dist;
          const prevCandidate = candidates[candidates.length - 1];
          const prevDist = prevCandidate ? driverPts[prevCandidate.apexIdx].dist : -999;
          if (apexDist - prevDist > 140) {
            const cornerNum = candidates.length + 1;
            candidates.push({
              name: `Turn ${cornerNum}`,
              shortName: `T${cornerNum}`,
              apexIdx: minIdx,
            });
          }
        }
      }
    }
  }

  // Calculate high-resolution metrics for each corner
  candidates.forEach((cand) => {
    const minDriverIdx = cand.apexIdx;
    const apexDist = driverPts[minDriverIdx].dist;
    const driverApexSpd = driverPts[minDriverIdx].speed;
    const rApexPt = interpolateAtDist(refPts, apexDist);
    const refApexSpd = rApexPt.speed;
    const spdDelta = +(driverApexSpd - refApexSpd).toFixed(1);

    // Braking point in leadup (within 350m before apex)
    let dBrakeDist = apexDist;
    const leadupStart = Math.max(0, apexDist - 350);
    for (let j = 0; j < driverPts.length; j++) {
      if (driverPts[j].dist >= leadupStart && driverPts[j].dist <= apexDist) {
        if (driverPts[j].brake > 15 || (driverApexSpd > 180 && driverPts[j].throttle < 40)) {
          dBrakeDist = driverPts[j].dist;
          break;
        }
      }
    }

    let rBrakeDist = apexDist;
    for (let j = 0; j < refPts.length; j++) {
      if (refPts[j].dist >= leadupStart && refPts[j].dist <= apexDist) {
        if (refPts[j].brake > 15 || (refApexSpd > 180 && refPts[j].throttle < 40)) {
          rBrakeDist = refPts[j].dist;
          break;
        }
      }
    }

    const brakingPointDeltaMeters = Math.round(dBrakeDist - rBrakeDist);

    // Throttle commit exiting apex (within 300m after apex)
    let dThrottleDist = apexDist;
    const exitEnd = Math.min(driverPts[driverPts.length - 1].dist, apexDist + 300);
    for (let j = minDriverIdx; j < driverPts.length; j++) {
      if (driverPts[j].dist >= apexDist && driverPts[j].dist <= exitEnd) {
        if (driverPts[j].throttle > 60) {
          dThrottleDist = driverPts[j].dist;
          break;
        }
      }
    }

    let rThrottleDist = apexDist;
    for (let j = 0; j < refPts.length; j++) {
      if (refPts[j].dist >= apexDist && refPts[j].dist <= exitEnd) {
        if (refPts[j].throttle > 60) {
          rThrottleDist = refPts[j].dist;
          break;
        }
      }
    }

    const throttleCommitDeltaMeters = Math.round(rThrottleDist - dThrottleDist);

    // Micro-sector time delta across this corner (from entry to exit)
    const sectorEntryDist = Math.max(0, Math.min(dBrakeDist, apexDist - 120));
    const sectorExitDist = Math.min(
      driverPts[driverPts.length - 1].dist,
      Math.max(dThrottleDist, apexDist + 140)
    );
    const dtEntry = interpolateDeltaAtDist(deltaPoints, sectorEntryDist);
    const dtExit = interpolateDeltaAtDist(deltaPoints, sectorExitDist);
    const cornerTimeDelta = +(dtExit - dtEntry).toFixed(3);

    let verdict = "";
    if (spdDelta <= -5) {
      verdict = `Carried ${Math.abs(spdDelta)} km/h less apex speed. Front-end push or over-slowing into apex.`;
    } else if (spdDelta >= 4) {
      verdict = `Carried +${spdDelta} km/h more apex speed. High entry commitment.`;
    } else if (brakingPointDeltaMeters < -10) {
      verdict = `Braked ${Math.abs(brakingPointDeltaMeters)}m too early into braking zone.`;
    } else if (brakingPointDeltaMeters > 10) {
      verdict = `Braked ${brakingPointDeltaMeters}m deeper; check for apex miss or locking.`;
    } else if (throttleCommitDeltaMeters < -8) {
      verdict = `Delayed throttle commitment by ${Math.abs(throttleCommitDeltaMeters)}m on exit drive.`;
    } else if (throttleCommitDeltaMeters > 8) {
      verdict = `Committed to full throttle ${throttleCommitDeltaMeters}m earlier on corner exit.`;
    } else if (cornerTimeDelta > 0.12) {
      verdict = `Lost +${cornerTimeDelta}s on exit drive. Stiffen front or soften rear anti-roll bar.`;
    } else if (cornerTimeDelta < -0.06) {
      verdict = `Gained ${Math.abs(cornerTimeDelta)}s through stronger exit momentum.`;
    } else {
      verdict = `Clean execution; matched benchmark within ±${Math.abs(cornerTimeDelta)}s.`;
    }

    cornerComparisons.push({
      corner: cand.name,
      shortName: cand.shortName,
      dist: apexDist,
      driverMinSpeed: driverApexSpd,
      refMinSpeed: refApexSpd,
      speedDelta: spdDelta,
      timeDelta: cornerTimeDelta,
      brakingPointDeltaMeters,
      throttleCommitDeltaMeters,
      verdict,
    });
  });

  return {
    driverLapTime: driver.lapTime,
    refLapTime: ref.lapTime,
    totalTimeDeltaSeconds,
    topSpeedDeltaKmh,
    cornerComparisons,
    deltaPoints,
  };
}
