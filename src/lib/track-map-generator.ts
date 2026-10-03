import {
  ParsedTelemetryFile,
  LapComparisonSummary,
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  CornerDeltaComparison,
} from "@/types/telemetry";
import {
  REAL_CIRCUITS,
  RealCircuitDefinition,
  getAuthenticTrackGeometry,
} from "./circuit-geometries";

/**
 * High-Precision Interpolation along Official FIA Surveyed Track Coordinates
 */
function interpolateRealCircuit(
  def: RealCircuitDefinition,
  targetDist: number,
  telemetryStartDist: number,
  telemetryEndDist: number
): { x: number; y: number } {
  const pts = def.points;
  if (!pts || pts.length === 0) return { x: 500, y: 500 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };

  const officialMax = def.officialDistance;
  const telemSpan = Math.max(1, telemetryEndDist - telemetryStartDist);

  let mappedDist: number;
  if (telemSpan >= officialMax * 0.85) {
    // Full lap: stretch to exact official distance
    mappedDist = Math.max(0, Math.min(officialMax, ((targetDist - telemetryStartDist) / telemSpan) * officialMax));
  } else {
    // Partial run or calibrated stint: use absolute track distance (modulo official distance)
    mappedDist = ((targetDist % officialMax) + officialMax) % officialMax;
  }

  // Binary search along pts
  let low = 0;
  let high = pts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (pts[mid].dist === mappedDist) return { x: pts[mid].x, y: pts[mid].y };
    if (pts[mid].dist < mappedDist) low = mid + 1;
    else high = mid - 1;
  }

  const i0 = Math.max(0, Math.min(pts.length - 1, high));
  const i1 = Math.min(pts.length - 1, Math.max(0, low));
  if (i0 === i1) return { x: pts[i0].x, y: pts[i0].y };

  const p0 = pts[i0];
  const p1 = pts[i1];
  const span = p1.dist - p0.dist;
  if (span <= 0.001) return { x: p0.x, y: p0.y };

  const t = Math.max(0, Math.min(1, (mappedDist - p0.dist) / span));
  return {
    x: +(p0.x + (p1.x - p0.x) * t).toFixed(1),
    y: +(p0.y + (p1.y - p0.y) * t).toFixed(1),
  };
}

/**
 * Universal Dead-Reckoning Trajectory for Custom / Mod circuits
 * Uses physical curvature integration with cubic smoothing and closed-loop endpoint relaxation.
 */
function reconstructAutonomousTrajectory(telemetry: ParsedTelemetryFile): { x: number; y: number }[] {
  const pts = telemetry.points;
  if (!pts || pts.length < 2) return [{ x: 500, y: 500 }];

  let x = 0;
  let y = 0;
  let heading = 0;
  const rawTrajectory: { x: number; y: number; dist: number }[] = [{ x: 0, y: 0, dist: pts[0].dist }];

  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(0.005, Math.min(0.2, pts[i].time - pts[i - 1].time));
    const v = pts[i].speed != null ? Math.max(4.0, pts[i].speed! / 3.6) : 20.0; // speed in m/s
    const latG = pts[i].latG ?? 0;
    const steer = pts[i].steer ?? 0;

    let omega = 0;
    if (Math.abs(latG) > 0.05) {
      omega = (latG * 9.80665) / v;
    } else if (Math.abs(steer) > 1.0) {
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

  // Closed-loop drift distribution
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
 * Generate True FIA Grade Track Map Data synchronized with telemetry.
 * Automatically recognizes official FIA circuits or supports user overrides.
 */
export function generateTrackMapData(
  telemetry: ParsedTelemetryFile,
  trackHint?: string,
  lapComparison?: LapComparisonSummary | null
): TrackMapData {
  const telemetryPoints = telemetry.points;
  const startDist = telemetryPoints[0]?.dist || 0;
  const endDist = telemetryPoints[telemetryPoints.length - 1]?.dist || 4000;

  // 1. Identify Authentic FIA Circuit
  const searchHint = `${trackHint || ""} ${telemetry.filename || ""}`;
  const realCircuit = getAuthenticTrackGeometry(searchHint, endDist);

  if (realCircuit) {
    // 2A. Authentic FIA Grade 1 Surveyed Circuit
    const points: TrackMapPoint[] = telemetryPoints.map((pt, idx) => {
      const coord = interpolateRealCircuit(realCircuit, pt.dist, startDist, endDist);
      const deltaPt = lapComparison?.deltaPoints?.[idx];

      return {
        dist: pt.dist,
        x: coord.x,
        y: coord.y,
        speed: pt.speed,
        throttle: pt.throttle,
        brake: pt.brake,
        latG: pt.latG,
        timeDelta: deltaPt ? deltaPt.timeDelta : undefined,
        refSpeed: deltaPt ? deltaPt.refSpeed : undefined,
      };
    });

    // Match corners and calculate driver apex speeds
    const corners: TrackCorner[] = realCircuit.corners.map((rc, cIdx) => {
      // Find telemetry point closest to this corner's distance
      let closestPt: TrackMapPoint | null = null;
      let minDiff = Infinity;
      let minSpeedInZone = Infinity;

      points.forEach((p) => {
        const diff = Math.abs(p.dist - rc.dist);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = p;
        }
        if (diff <= 220 && p.speed != null && p.speed < minSpeedInZone) {
          minSpeedInZone = p.speed;
        }
      });

      const comp: CornerDeltaComparison | undefined = lapComparison?.cornerComparisons?.find(
        (c) =>
          c.shortName === rc.shortName ||
          c.corner === rc.name ||
          c.corner.toLowerCase().includes(rc.shortName.toLowerCase()) ||
          Math.abs(c.dist - rc.dist) < 180
      );

      const hasTelemetryInCorner = minDiff < 300;
      const driverSpeed = hasTelemetryInCorner
        ? comp?.driverMinSpeed ?? (minSpeedInZone < Infinity ? minSpeedInZone : closestPt?.speed)
        : undefined;

      return {
        id: `corner-${cIdx}`,
        name: rc.name,
        shortName: rc.shortName,
        dist: rc.dist,
        x: rc.x,
        y: rc.y,
        driverSpeed,
        refSpeed: comp?.refMinSpeed,
        speedDelta: comp?.speedDelta,
        timeDelta: comp?.timeDelta,
        brakingPointDeltaMeters: comp?.brakingPointDeltaMeters,
        throttleCommitDeltaMeters: comp?.throttleCommitDeltaMeters,
        verdict:
          comp?.verdict ||
          (hasTelemetryInCorner && driverSpeed != null
            ? `Apex Speed: ${Math.round(driverSpeed)} km/h`
            : "FIA Reference Corner"),
      };
    });

    const xs = realCircuit.points.map((p) => p.x);
    const ys = realCircuit.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      circuitKey: realCircuit.id,
      circuitName: realCircuit.name,
      country: realCircuit.country,
      fiaGrade: realCircuit.fiaGrade,
      totalDistance: realCircuit.officialDistance,
      points,
      fullCircuitPoints: realCircuit.points.map((p) => ({ dist: p.dist, x: p.x, y: p.y })),
      corners,
      drsZones: realCircuit.drsZones,
      sectors: realCircuit.sectors,
      bounds: { minX, maxX, minY, maxY },
    };
  }

  // 2B. Universal Kinematic Dead-Reckoning Fallback for Custom Tracks
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

  const points: TrackMapPoint[] = telemetryPoints.map((pt, idx) => {
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

  // Dynamic Corner Detection
  const corners: TrackCorner[] = [];
  const minCornerGap = Math.max(120, (endDist - startDist) / 30.0);

  for (let i = 2; i < telemetryPoints.length - 2; i++) {
    const prev = telemetryPoints[i - 1].speed;
    const curr = telemetryPoints[i].speed;
    const next = telemetryPoints[i + 1].speed;
    const latG = telemetryPoints[i].latG != null ? Math.abs(telemetryPoints[i].latG!) : null;
    const steer = telemetryPoints[i].steer != null ? Math.abs(telemetryPoints[i].steer!) : null;
    const dist = telemetryPoints[i].dist;

    if (
      curr != null &&
      prev != null &&
      next != null &&
      curr <= prev &&
      curr <= next &&
      ((latG != null && latG >= 0.45) || (steer != null && steer >= 10.0))
    ) {
      if (corners.length === 0 || dist - corners[corners.length - 1].dist > minCornerGap) {
        const cNum = corners.length + 1;
        const pt = points[i];
        corners.push({
          id: `corner-${corners.length}`,
          name: `Turn ${cNum}`,
          shortName: `T${cNum}`,
          dist,
          x: pt.x,
          y: pt.y,
          driverSpeed: curr,
          verdict: `Minimum Apex Speed: ${Math.round(curr)} km/h`,
        });
      }
    }
  }

  return {
    circuitName: trackHint?.trim() || "Autonomous Circuit Layout",
    fiaGrade: "Custom Circuit",
    totalDistance: endDist,
    points,
    fullCircuitPoints: points.map((p) => ({ dist: p.dist, x: p.x, y: p.y })),
    corners,
    bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
  };
}
