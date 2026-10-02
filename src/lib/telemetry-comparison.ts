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

import { REAL_CIRCUITS, RealCircuitDefinition, getAuthenticTrackGeometry } from "./circuit-geometries";

/**
 * Identify circuit by track name, filenames, or total distance
 */
function detectCircuit(
  driver: ParsedTelemetryFile,
  ref?: ParsedTelemetryFile | null,
  trackHint?: string
): RealCircuitDefinition | null {
  const combined = `${trackHint || ""} ${driver.filename || ""} ${ref?.filename || ""}`.toLowerCase();
  const maxDist = driver.points[driver.points.length - 1]?.dist || 0;
  return getAuthenticTrackGeometry(combined, maxDist);
}

/**
 * Compare Driver Lap with Reference Lap (Ghost Lap Overlay),
 * OR synthesize autonomous physics-based corner-by-corner analysis if no reference lap is provided.
 */
export function computeLapComparison(
  driver: ParsedTelemetryFile,
  ref?: ParsedTelemetryFile | null,
  trackHint?: string
): LapComparisonSummary {
  const driverPts = driver.points;
  if (!driverPts || driverPts.length === 0) {
    return {
      driverLapTime: driver.lapTime || "0:00.000",
      refLapTime: ref?.lapTime || "Optimal Target",
      totalTimeDeltaSeconds: 0,
      topSpeedDeltaKmh: 0,
      cornerComparisons: [],
      deltaPoints: [],
    };
  }

  const circuit = detectCircuit(driver, ref, trackHint);

  interface CornerCandidate {
    name: string;
    shortName: string;
    apexIdx: number;
    targetRadius?: number;
  }
  const candidates: CornerCandidate[] = [];

  // Identify Corner Candidates:
  // 1. If authentic circuit matched, extract apexes for all authentic named corners.
  // 2. Otherwise run dynamic adaptive apex detection across the full lap distance.
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
        candidates.push({
          name: target.name,
          shortName: target.shortName,
          apexIdx: finalIdx,
          targetRadius: target.radius,
        });
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

  // --------------------------------------------------------------------------
  // BRANCH A: DUAL-LAP COMPARISON (Ghost Reference is Available)
  // --------------------------------------------------------------------------
  if (ref && ref.points && ref.points.length > 0) {
    const deltaPoints: DeltaPoint[] = [];
    const refPts = ref.points;

    // Build synchronized delta points along driver's distance axis
    for (let i = 0; i < driverPts.length; i++) {
      const dPt = driverPts[i];
      const rPt = interpolateAtDist(refPts, dPt.dist);

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

    const finalDriverTime = driverPts[driverPts.length - 1]?.time || 0;
    const finalRefTime = refPts[refPts.length - 1]?.time || 0;
    const totalTimeDeltaSeconds = +(finalDriverTime - finalRefTime).toFixed(3);
    const topSpeedDeltaKmh = +(driver.topSpeed - ref.topSpeed).toFixed(1);

    const cornerComparisons: CornerDeltaComparison[] = [];

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

  // --------------------------------------------------------------------------
  // BRANCH B: AUTONOMOUS SINGLE-LAP CORNER ANALYSIS (User Uploaded File)
  // Computes theoretical optimal target apex speed, braking threshold, throttle pickup,
  // and deep engineering verdict for every corner without requiring a second file.
  // --------------------------------------------------------------------------
  const cornerComparisons: CornerDeltaComparison[] = [];
  const deltaPoints: DeltaPoint[] = [];

  // Vehicle dynamic capacity across lap
  let maxLapLatG = 0;
  let maxLapDecelG = 0;
  for (const pt of driverPts) {
    if (Math.abs(pt.latG) > maxLapLatG) maxLapLatG = Math.abs(pt.latG);
    if (Math.abs(pt.longG) > maxLapDecelG) maxLapDecelG = Math.abs(pt.longG);
  }
  const gripCapacity = Math.max(1.6, maxLapLatG);

  let cumulativeTimeLoss = 0;

  candidates.forEach((cand, cIdx) => {
    const minDriverIdx = cand.apexIdx;
    const apexDist = driverPts[minDriverIdx].dist;
    const driverApexSpd = driverPts[minDriverIdx].speed;

    // Scan corner window
    const leadupStart = Math.max(0, apexDist - 350);
    const exitEnd = Math.min(driverPts[driverPts.length - 1].dist, apexDist + 300);

    let dBrakeDist = apexDist;
    let entrySpeed = driverApexSpd;
    for (let j = 0; j < driverPts.length; j++) {
      if (driverPts[j].dist >= leadupStart && driverPts[j].dist <= apexDist) {
        if (driverPts[j].brake > 15 || (driverApexSpd > 180 && driverPts[j].throttle < 40)) {
          dBrakeDist = driverPts[j].dist;
          entrySpeed = driverPts[j].speed;
          break;
        }
      }
    }

    let dThrottleDist = apexDist + 20;
    for (let j = minDriverIdx; j < driverPts.length; j++) {
      if (driverPts[j].dist >= apexDist && driverPts[j].dist <= exitEnd) {
        if (driverPts[j].throttle > 60) {
          dThrottleDist = driverPts[j].dist;
          break;
        }
      }
    }

    // Measure peak lateral G & understeer scrub through corner
    let cornerMaxLatG = 0;
    let maxUndersteer = 0;
    for (let j = 0; j < driverPts.length; j++) {
      if (driverPts[j].dist >= dBrakeDist && driverPts[j].dist <= dThrottleDist) {
        const lat = Math.abs(driverPts[j].latG);
        if (lat > cornerMaxLatG) cornerMaxLatG = lat;
        const u = driverPts[j].understeerAngle || 0;
        if (u > maxUndersteer) maxUndersteer = u;
      }
    }

    // Determine optimal apex speed:
    // If corner radius known: v_opt = sqrt(mu * g * R)
    // Else based on car's peak lateral G utilization vs corner apex
    let targetApexSpd = driverApexSpd;
    if (cand.targetRadius && cand.targetRadius > 0) {
      // Theoretical grip apex speed: v = sqrt(a_lat * R) * 3.6
      const theoretical = Math.sqrt(gripCapacity * 9.81 * cand.targetRadius) * 3.6;
      targetApexSpd = Math.round(Math.min(driverApexSpd + 12, Math.max(driverApexSpd + 1.5, theoretical)));
    } else {
      const gripRatio = cornerMaxLatG > 0 ? cornerMaxLatG / gripCapacity : 0.8;
      if (gripRatio < 0.82) {
        // Driver left grip on table / over-slowed
        targetApexSpd = Math.round(driverApexSpd + Math.min(9, Math.max(3, (0.95 - gripRatio) * 22)));
      } else if (maxUndersteer > 2.5) {
        // Front scrub cost
        targetApexSpd = Math.round(driverApexSpd + Math.min(6, maxUndersteer * 1.4));
      } else {
        // Good execution
        targetApexSpd = Math.round(driverApexSpd + 1.8);
      }
    }

    const spdDelta = +(driverApexSpd - targetApexSpd).toFixed(1);

    // Braking threshold calculation
    const decelRateG = Math.max(1.4, maxLapDecelG * 0.88);
    const theoreticalBrakeDistance = Math.max(
      35,
      Math.round(
        (Math.pow(entrySpeed / 3.6, 2) - Math.pow(targetApexSpd / 3.6, 2)) /
          (2 * decelRateG * 9.81)
      )
    );
    const actualBrakeDistance = Math.round(apexDist - dBrakeDist);
    let brakingPointDeltaMeters = 0;
    if (actualBrakeDistance > theoreticalBrakeDistance + 12) {
      // Braked early
      brakingPointDeltaMeters = -(actualBrakeDistance - theoreticalBrakeDistance);
    } else if (actualBrakeDistance < theoreticalBrakeDistance - 8 && actualBrakeDistance > 10) {
      // Braked late
      brakingPointDeltaMeters = theoreticalBrakeDistance - actualBrakeDistance;
    }

    // Throttle commit calculation (target commit: 6m after apex)
    const actualThrottleDistance = Math.round(dThrottleDist - apexDist);
    const optimalThrottleDist = 6;
    let throttleCommitDeltaMeters = 0;
    if (actualThrottleDistance > optimalThrottleDist + 8) {
      // Delayed throttle pickup
      throttleCommitDeltaMeters = -(actualThrottleDistance - optimalThrottleDist);
    } else if (actualThrottleDistance < optimalThrottleDist) {
      throttleCommitDeltaMeters = optimalThrottleDist - actualThrottleDistance;
    }

    // Micro-sector time loss
    const speedLossSec = Math.abs(Math.min(0, spdDelta)) * 0.018;
    const throttleLossSec = Math.abs(Math.min(0, throttleCommitDeltaMeters)) * 0.007;
    const brakeLossSec = Math.abs(Math.min(0, brakingPointDeltaMeters)) * 0.004;
    const cornerTimeDelta = +(Math.max(0.04, speedLossSec + throttleLossSec + brakeLossSec)).toFixed(3);
    cumulativeTimeLoss += cornerTimeDelta;

    // Deep Engineering Attribution & Verdict
    let verdict = "";
    if (maxUndersteer > 3.0 || spdDelta <= -6) {
      verdict = `Understeer scrub on entry caused ${Math.abs(spdDelta)} km/h apex deficit (+${cornerTimeDelta}s). Soften front anti-roll bar or reduce front bump damping to increase mechanical turn-in grip.`;
    } else if (brakingPointDeltaMeters < -14) {
      verdict = `Braked ${Math.abs(brakingPointDeltaMeters)}m early into braking zone, over-slowing to ${driverApexSpd} km/h (optimal: ${targetApexSpd} km/h). Apex entry momentum can be carried deeper.`;
    } else if (throttleCommitDeltaMeters < -10) {
      verdict = `Throttle commitment delayed by ${Math.abs(throttleCommitDeltaMeters)}m past apex (+${cornerTimeDelta}s). Rear hesitation on power down; consider softening rear anti-roll bar or lowering differential preload.`;
    } else if (brakingPointDeltaMeters > 10) {
      verdict = `Braked ${brakingPointDeltaMeters}m deeper than ideal; heavy trail-braking stabilized rotation but compromised exit drive (+${cornerTimeDelta}s). Move brake bias rearward 0.5% or brake 10m earlier.`;
    } else if (cornerMaxLatG >= gripCapacity * 0.88 && Math.abs(spdDelta) <= 3) {
      verdict = `High lateral commitment (${cornerMaxLatG.toFixed(2)}G). Superb apex clipping and prompt throttle application. Executed within ±${cornerTimeDelta}s of theoretical peak pace.`;
    } else {
      verdict = `Clean trajectory through apex (${driverApexSpd} km/h) with balanced weight transfer. Micro-adjust rear rebound to shave final +${cornerTimeDelta}s.`;
    }

    cornerComparisons.push({
      corner: cand.name,
      shortName: cand.shortName,
      dist: apexDist,
      driverMinSpeed: driverApexSpd,
      refMinSpeed: targetApexSpd,
      speedDelta: spdDelta,
      timeDelta: cornerTimeDelta,
      brakingPointDeltaMeters,
      throttleCommitDeltaMeters,
      verdict,
    });
  });

  // Synthesize smooth deltaPoints across lap for track map coloring and HUD
  const totalLapDist = driverPts[driverPts.length - 1]?.dist || 1;
  for (let i = 0; i < driverPts.length; i++) {
    const dPt = driverPts[i];
    const progress = dPt.dist / totalLapDist;
    const timeDelta = +(cumulativeTimeLoss * Math.pow(progress, 0.9)).toFixed(3);

    // Approximate ref speed based on nearby corners
    let targetSpeed = dPt.speed;
    const closestCorner = cornerComparisons.reduce((prev, curr) => {
      return Math.abs(curr.dist - dPt.dist) < Math.abs(prev.dist - dPt.dist) ? curr : prev;
    }, cornerComparisons[0] || { dist: 0, speedDelta: -2 });

    const distToCorner = Math.abs(dPt.dist - closestCorner.dist);
    if (distToCorner < 100) {
      const weight = 1 - distToCorner / 100;
      targetSpeed = Math.round(dPt.speed - closestCorner.speedDelta * weight);
    } else {
      targetSpeed = Math.min(driver.topSpeed + 2, Math.round(dPt.speed + 1));
    }

    deltaPoints.push({
      dist: dPt.dist,
      timeDelta,
      speedDelta: +(dPt.speed - targetSpeed).toFixed(1),
      driverSpeed: dPt.speed,
      refSpeed: targetSpeed,
      driverThrottle: dPt.throttle,
      refThrottle: Math.min(100, dPt.throttle + 5),
      driverBrake: dPt.brake,
      refBrake: dPt.brake,
    });
  }

  return {
    driverLapTime: driver.lapTime,
    refLapTime: "Optimal Target",
    totalTimeDeltaSeconds: +cumulativeTimeLoss.toFixed(3),
    topSpeedDeltaKmh: -2.5,
    cornerComparisons,
    deltaPoints,
  };
}

