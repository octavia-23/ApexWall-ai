import {
  TelemetryPoint,
  BrakingZoneProfile,
  TrailBrakingAnalysis,
} from "@/types/telemetry";
import { getAuthenticTrackGeometry } from "./circuit-geometries";

export function computeTrailBrakingAnalysis(
  points: TelemetryPoint[],
  trackName: string = "Circuit de Spa-Francorchamps"
): TrailBrakingAnalysis {
  if (!points || points.length < 30) {
    return {
      overallTrailScore: 78,
      brakingZones: [],
      averagePeakDecelG: 1.8,
      idealReleasePct: 75,
      recommendedBrakeBiasDeltaPct: 0,
      recommendedBrakeBiasDirection: "optimal",
      biasRecommendationRationale: "Telemetry sample too small to profile individual braking zones.",
      techniqueSummary: "Standard baseline trail braking profiling.",
    };
  }

  const geometry = getAuthenticTrackGeometry(trackName);

  // 1. Identify discrete braking events
  interface RawBrakingZone {
    startIdx: number;
    peakIdx: number;
    endIdx: number;
  }

  const rawZones: RawBrakingZone[] = [];
  let inBraking = false;
  let zoneStart = 0;
  let peakIdx = 0;
  let maxBrake = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const brake = pt.brake || 0;

    if (!inBraking) {
      if (brake > 15) {
        inBraking = true;
        zoneStart = i;
        peakIdx = i;
        maxBrake = brake;
      }
    } else {
      if (brake > maxBrake) {
        maxBrake = brake;
        peakIdx = i;
      }
      // Zone ends when brake drops below 5% or end of trace
      if (brake < 5 || i === points.length - 1) {
        const entrySpeed = points[zoneStart]?.speed || 0;
        const exitSpeed = points[i]?.speed || 0;
        const speedDrop = entrySpeed - exitSpeed;

        // Valid significant braking event: speed dropped by at least 20 km/h and peak brake > 40%
        if (speedDrop >= 20 && maxBrake >= 40 && i - zoneStart >= 6) {
          rawZones.push({
            startIdx: zoneStart,
            peakIdx,
            endIdx: i,
          });
        }
        inBraking = false;
        maxBrake = 0;
      }
    }
  }

  // 2. Profile each braking zone
  const profiles: BrakingZoneProfile[] = [];
  let totalTrailScore = 0;
  let idealCount = 0;
  let totalPeakDecel = 0;
  let frontLockupIncidents = 0;
  let rearInstabilityIncidents = 0;

  rawZones.forEach((rz, idx) => {
    const pStart = points[rz.startIdx];
    const pPeak = points[rz.peakIdx];
    const pEnd = points[rz.endIdx];

    const entrySpeed = Math.round(pStart.speed || 0);
    const minSpeed = Math.round(pEnd.speed || 0);
    const speedDrop = entrySpeed - minSpeed;
    const startDist = Math.round(pStart.dist);
    const endDist = Math.round(pEnd.dist);
    const lengthMeters = Math.max(10, endDist - startDist);

    // Peak deceleration (Gx)
    let peakDecel = 1.6;
    for (let i = rz.startIdx; i <= rz.endIdx; i++) {
      const decel = Math.abs(points[i].longG || 0);
      if (decel > peakDecel) peakDecel = decel;
    }

    // Initial Hit Rate (% per second)
    const riseTime = Math.max(0.04, (pPeak.time || 0) - (pStart.time || 0));
    const hitRate = Math.round(((pPeak.brake || 90) - (pStart.brake || 0)) / riseTime);

    // Release curve analysis: sample points from peak to end
    const releasePts: number[] = [];
    let maxSteerWhileTrailing = 0;
    let abruptDropDetected = false;

    for (let i = rz.peakIdx; i <= rz.endIdx; i++) {
      const pt = points[i];
      releasePts.push(pt.brake || 0);
      if (pt.brake != null && pt.brake > 12) {
        const steer = Math.abs(pt.steer || 0);
        if (steer > maxSteerWhileTrailing) maxSteerWhileTrailing = steer;
      }
      if (i > rz.peakIdx) {
        const prevBrake = points[i - 1].brake || 0;
        const currBrake = pt.brake || 0;
        if (prevBrake - currBrake > 45) {
          abruptDropDetected = true;
        }
      }
    }

    // Release Shape Classification
    let releaseShape: "ideal_exponential" | "progressive_linear" | "stepped" | "abrupt_chop" = "progressive_linear";
    let zoneScore = 75;

    if (abruptDropDetected) {
      releaseShape = "abrupt_chop";
      zoneScore = 52;
    } else if (releasePts.length >= 6) {
      // Check exponential convex decay vs linear
      const midVal = releasePts[Math.floor(releasePts.length / 2)];
      const peakVal = releasePts[0] || 90;
      const linearMid = peakVal / 2;

      if (midVal < linearMid - 6 && maxSteerWhileTrailing > 15) {
        // Brake bleeds off faster initially while steering blends in: Ideal exponential!
        releaseShape = "ideal_exponential";
        zoneScore = 92;
        idealCount++;
      } else if (Math.abs(midVal - linearMid) <= 10) {
        releaseShape = "progressive_linear";
        zoneScore = 80;
      } else {
        releaseShape = "stepped";
        zoneScore = 65;
      }
    }

    // Bonus / penalty for steering overlap
    if (maxSteerWhileTrailing > 18 && maxSteerWhileTrailing < 65) {
      zoneScore = Math.min(98, zoneScore + 6);
    } else if (maxSteerWhileTrailing <= 8) {
      // Driver released 100% of brake before steering: zero trail-braking!
      zoneScore = Math.max(45, zoneScore - 15);
    }

    // Check lockup and instability
    const frontLockup = peakDecel > 2.4 || (entrySpeed > 180 && releaseShape === "abrupt_chop");
    const rearInstability = maxSteerWhileTrailing > 40 && (pEnd.latG || 0) > 1.8 && releaseShape === "stepped";

    if (frontLockup) frontLockupIncidents++;
    if (rearInstability) rearInstabilityIncidents++;

    // Nearest corner name
    let cornerName = `Zone ${idx + 1}`;
    if (geometry && geometry.corners) {
      let nearestDist = Infinity;
      geometry.corners.forEach((c) => {
        const d = Math.abs(c.dist - endDist);
        if (d < nearestDist && d < 220) {
          nearestDist = d;
          cornerName = c.name;
        }
      });
    }

    let verdict = "Smooth release; stable platform into apex.";
    if (releaseShape === "ideal_exponential") {
      verdict = "Pro-grade exponential trail: optimum pitch control & apex rotation.";
    } else if (releaseShape === "abrupt_chop") {
      verdict = "Abrupt pedal release: front pitch snaps up, causing turn-in understeer.";
    } else if (releaseShape === "stepped") {
      verdict = "Hesitant step-off: chassis oscillates between braking and rolling.";
    } else if (maxSteerWhileTrailing < 10) {
      verdict = "Minimal steering overlap: braking completed in straight line, costing rotation.";
    }

    totalTrailScore += zoneScore;
    totalPeakDecel += peakDecel;

    profiles.push({
      id: `BZ-${idx + 1}`,
      cornerName,
      entrySpeedKmh: entrySpeed,
      minSpeedKmh: minSpeed,
      speedDropKmh: Math.max(0, speedDrop),
      startDist,
      endDist,
      lengthMeters,
      peakDecelG: Number(peakDecel.toFixed(2)),
      initialHitRatePctPerSec: hitRate,
      releaseShape,
      trailBrakingScore: zoneScore,
      steeringOverlapDeg: Math.round(maxSteerWhileTrailing),
      frontLockupRisk: frontLockup,
      rearInstabilityRisk: rearInstability,
      verdict,
    });
  });

  const count = Math.max(1, profiles.length);
  const overallTrailScore = Math.round(totalTrailScore / count);
  const averagePeakDecelG = Number((totalPeakDecel / count).toFixed(2));
  const idealReleasePct = Math.round((idealCount / count) * 100);

  // Mechanical Brake Bias Recommendation
  let recommendedBrakeBiasDeltaPct = 0;
  let recommendedBrakeBiasDirection: "forward" | "rearward" | "optimal" = "optimal";
  let biasRecommendationRationale = "Current mechanical brake bias is well-harmonized with braking technique.";

  if (frontLockupIncidents >= 2) {
    recommendedBrakeBiasDeltaPct = -1.0;
    recommendedBrakeBiasDirection = "rearward";
    biasRecommendationRationale =
      "Multiple front tyre scrubbing/micro-lock events observed under heavy initial deceleration. Move brake bias -1.0% rearward to utilize the rear tyre contact patches and shorten stopping distances.";
  } else if (rearInstabilityIncidents >= 2) {
    recommendedBrakeBiasDeltaPct = 0.8;
    recommendedBrakeBiasDirection = "forward";
    biasRecommendationRationale =
      "Rear axle instability detected during combined trail-braking turn-in. Shift brake bias +0.8% forward to calm rear yaw rate and stabilize corner entry.";
  } else if (overallTrailScore < 70) {
    recommendedBrakeBiasDeltaPct = -0.6;
    recommendedBrakeBiasDirection = "rearward";
    biasRecommendationRationale =
      "Shift bias -0.6% rearward to help rotate the car naturally into apexes while practicing smoother brake release.";
  }

  const techniqueSummary =
    overallTrailScore >= 85
      ? `Elite trail braking consistency (${overallTrailScore}/100). ${idealReleasePct}% of braking zones feature optimal exponential pressure decay, allowing early steering commit and sharp apex rolling speed.`
      : `Moderate trail braking score (${overallTrailScore}/100). Focus on holding a light trailing brake (8-15%) all the way to the apex clipping point instead of stepping off completely before turn-in.`;

  return {
    overallTrailScore,
    brakingZones: profiles,
    averagePeakDecelG,
    idealReleasePct,
    recommendedBrakeBiasDeltaPct,
    recommendedBrakeBiasDirection,
    biasRecommendationRationale,
    techniqueSummary,
  };
}
