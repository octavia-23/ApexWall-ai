import {
  ParsedTelemetryFile,
  LapComparisonSummary,
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  CornerDeltaComparison,
} from "@/types/telemetry";

/**
 * Autonomous AI Track Reconstructor:
 * Reconstructs the true 2D circuit geometry, racing line, apexes, and braking zones
 * from physical vehicle dynamics (Speed, Lateral G, Steering, Time, Distance).
 * Works universally on ANY track given to the AI with zero hardcoded presets needed.
 */
function reconstructAutonomousTrajectory(telemetry: ParsedTelemetryFile): { x: number; y: number }[] {
  const pts = telemetry.points;
  if (!pts || pts.length < 2) return [{ x: 500, y: 500 }];

  let x = 0;
  let y = 0;
  let heading = 0;
  const rawTrajectory: { x: number; y: number; dist: number }[] = [{ x: 0, y: 0, dist: pts[0].dist }];

  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(0.005, Math.min(0.5, pts[i].time - pts[i - 1].time));
    const v = Math.max(3.0, pts[i].speed / 3.6); // speed in m/s
    const latG = pts[i].latG || 0;
    const steer = pts[i].steer || 0;

    let omega = 0;
    if (Math.abs(latG) > 0.05) {
      // Direct physical yaw rate from lateral acceleration: a_lat = v * omega => omega = a_lat / v
      omega = (latG * 9.80665) / v;
    } else if (Math.abs(steer) > 1.0) {
      // Kinematic bicycle model fallback from steering lock
      const wheelBase = 2.75;
      const steerRatio = 14.5;
      const steerRad = (steer * Math.PI) / 180.0 / steerRatio;
      omega = (v / wheelBase) * Math.sin(steerRad);
    }

    heading += omega * dt;
    x += v * Math.cos(heading) * dt;
    y += v * Math.sin(heading) * dt;
    rawTrajectory.push({ x, y, dist: pts[i].dist });
  }

  // Closed-loop drift correction: In a closed lap, start line meets finish line
  const totalDist = Math.max(1, pts[pts.length - 1].dist);
  const driftX = x;
  const driftY = y;

  return rawTrajectory.map((pt) => {
    const progress = Math.max(0, Math.min(1, pt.dist / totalDist));
    return {
      x: pt.x - progress * driftX,
      y: pt.y - progress * driftY,
    };
  });
}

/**
 * Generate high-definition Track Map Data synchronized with telemetry and lap comparison.
 * Works autonomously for ANY circuit provided.
 */
export function generateTrackMapData(
  telemetry: ParsedTelemetryFile,
  trackHint?: string,
  lapComparison?: LapComparisonSummary | null
): TrackMapData {
  const totalDistance = Math.max(100, telemetry.points[telemetry.points.length - 1]?.dist || 4000);
  const hint = `${trackHint || ""} ${telemetry.filename || ""}`.toLowerCase();

  // 1. Resolve Circuit Display Name
  let circuitName = "Autonomous Circuit Layout";
  if (hint.includes("redbull") || hint.includes("red bull") || hint.includes("spielberg") || hint.includes("rbr")) {
    circuitName = "Red Bull Ring (Spielberg GP)";
  } else if (hint.includes("spa")) {
    circuitName = "Circuit de Spa-Francorchamps";
  } else if (hint.includes("monza")) {
    circuitName = "Autodromo Nazionale Monza";
  } else if (hint.includes("silverstone")) {
    circuitName = "Silverstone Grand Prix Circuit";
  } else if (hint.includes("nurburg") || hint.includes("nordschleife")) {
    circuitName = "Nürburgring Nordschleife";
  } else if (hint.includes("suzuka")) {
    circuitName = "Suzuka International Racing Course";
  } else if (hint.includes("bathurst") || hint.includes("mount panorama")) {
    circuitName = "Mount Panorama Circuit (Bathurst)";
  } else if (trackHint && trackHint.trim().length > 3) {
    circuitName = trackHint.trim();
  }

  // 2. Synthesize Authentic 2D Trajectory via Physics Dead-Reckoning
  const rawPositions = reconstructAutonomousTrajectory(telemetry);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rawPositions.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  const maxRange = Math.max(rangeX, rangeY);

  const padding = 70;
  const usableSize = 1000 - padding * 2;
  const scale = usableSize / maxRange;

  const offsetX = padding + (usableSize - rangeX * scale) / 2;
  const offsetY = padding + (usableSize - rangeY * scale) / 2;

  const points: TrackMapPoint[] = telemetry.points.map((pt, idx) => {
    const rawPos = rawPositions[idx] || { x: 500, y: 500 };
    const normX = Math.round(offsetX + (rawPos.x - minX) * scale);
    const normY = Math.round(offsetY + (rawPos.y - minY) * scale);
    const deltaPt = lapComparison?.deltaPoints?.[idx];

    return {
      dist: pt.dist,
      x: normX,
      y: normY,
      speed: pt.speed,
      throttle: pt.throttle,
      brake: pt.brake,
      latG: pt.latG,
      timeDelta: deltaPt ? deltaPt.timeDelta : undefined,
      refSpeed: deltaPt ? deltaPt.refSpeed : undefined,
    };
  });

  // 3. Autonomous Dynamic Corner & Apex Detection from Physics
  const corners: TrackCorner[] = [];
  const minCornerGap = Math.max(120, totalDistance / 35.0);

  // Scan for local minimum speed troughs accompanied by lateral load
  for (let i = 2; i < telemetry.points.length - 2; i++) {
    const prev = telemetry.points[i - 1].speed;
    const curr = telemetry.points[i].speed;
    const next = telemetry.points[i + 1].speed;
    const latG = Math.abs(telemetry.points[i].latG);
    const steer = Math.abs(telemetry.points[i].steer);
    const dist = telemetry.points[i].dist;

    // Corner criteria: local speed trough + either lateral G or steering angle
    if (curr <= prev && curr <= next && (latG >= 0.45 || steer >= 10.0)) {
      if (corners.length === 0 || dist - corners[corners.length - 1].dist > minCornerGap) {
        const cNum = corners.length + 1;
        const pt = points[i];

        // Search backward for braking initiation point (brake > 25%)
        let brakeDist = dist;
        for (let b = i - 1; b >= Math.max(0, i - 40); b--) {
          if (telemetry.points[b].brake > 25) {
            brakeDist = telemetry.points[b].dist;
          } else if (brakeDist !== dist && telemetry.points[b].brake < 10) {
            break;
          }
        }

        // Search forward for full throttle commitment (throttle > 50%)
        let throttleDist = dist;
        for (let t = i + 1; t <= Math.min(telemetry.points.length - 1, i + 40); t++) {
          if (telemetry.points[t].throttle > 50) {
            throttleDist = telemetry.points[t].dist;
            break;
          }
        }

        const turnDirection = telemetry.points[i].latG > 0 || telemetry.points[i].steer > 0 ? "Right" : "Left";
        let character = "Medium-Speed Apex";
        if (curr < 90) character = "Heavy Braking Hairpin";
        else if (curr > 180) character = "High-Speed Sweeper";
        else if (curr < 130) character = "Technical Chicane";

        // Check if lap comparison has attribution for this corner
        const comp = lapComparison?.cornerComparisons?.find(
          (c) => Math.abs(c.dist - dist) < 180 || c.shortName === `T${cNum}`
        );

        corners.push({
          id: `corner-${corners.length}`,
          name: `Turn ${cNum} (${turnDirection} - ${character})`,
          shortName: `T${cNum}`,
          dist,
          x: pt.x,
          y: pt.y,
          driverSpeed: curr,
          refSpeed: comp?.refMinSpeed,
          speedDelta: comp?.speedDelta,
          timeDelta: comp?.timeDelta,
          brakingPointDeltaMeters: comp?.brakingPointDeltaMeters,
          throttleCommitDeltaMeters: comp?.throttleCommitDeltaMeters,
          verdict: comp?.verdict || `${character} at ${curr} km/h`,
        });
      }
    }
  }

  // Fallback: If telemetry is very short or uniform, supply apex from minCornerSpeeds
  if (corners.length === 0 && telemetry.minCornerSpeeds?.length > 0) {
    telemetry.minCornerSpeeds.slice(0, 8).forEach((cs, idx) => {
      let closestIdx = 0;
      let minDiff = Infinity;
      telemetry.points.forEach((p, pIdx) => {
        const diff = Math.abs(p.dist - cs.dist);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = pIdx;
        }
      });
      const pt = points[closestIdx] || points[0];
      corners.push({
        id: `corner-${idx}`,
        name: `Turn ${idx + 1}`,
        shortName: `T${idx + 1}`,
        dist: cs.dist,
        x: pt.x,
        y: pt.y,
        driverSpeed: cs.speed,
      });
    });
  }

  return {
    circuitName,
    totalDistance,
    points,
    corners,
    bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
  };
}
