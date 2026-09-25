import {
  ParsedTelemetryFile,
  LapComparisonSummary,
  TrackMapData,
  TrackMapPoint,
  TrackCorner,
  CornerDeltaComparison,
} from "@/types/telemetry";
import { REAL_CIRCUITS, RealCircuitDefinition } from "./circuit-geometries";

/**
 * Linearly interpolate along the authentic real GPS track coordinates
 */
function interpolateRealCircuit(
  def: RealCircuitDefinition,
  targetDist: number,
  telemetryTotalDist: number
): { x: number; y: number } {
  const pts = def.points;
  if (!pts || pts.length === 0) return { x: 500, y: 500 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };

  const officialMax = def.officialDistance || pts[pts.length - 1].dist;
  const mappedDist = Math.max(0, Math.min(officialMax, (targetDist / telemetryTotalDist) * officialMax));

  // Binary search for segment
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
 * Fallback: Reconstruct 2D track trajectory via Dead-Reckoning from LatG + Speed,
 * with closed-loop drift correction for any custom circuit.
 */
function generateDeadReckoningTrajectory(telemetry: ParsedTelemetryFile): { x: number; y: number }[] {
  const pts = telemetry.points;
  if (pts.length < 2) return [{ x: 500, y: 500 }];

  let x = 0;
  let y = 0;
  let heading = 0;
  const rawTrajectory: { x: number; y: number; dist: number }[] = [{ x: 0, y: 0, dist: pts[0].dist }];

  for (let i = 1; i < pts.length; i++) {
    const dt = Math.max(0.01, pts[i].time - pts[i - 1].time);
    const v = Math.max(4.0, pts[i].speed / 3.6); // speed in m/s
    const omega = (pts[i].latG * 9.80665) / v; // yaw rate (rad/s)
    heading += omega * dt;

    x += v * Math.cos(heading) * dt;
    y += v * Math.sin(heading) * dt;
    rawTrajectory.push({ x, y, dist: pts[i].dist });
  }

  // Loop closure correction: Distribute endpoint drift back to (0, 0)
  const totalDist = Math.max(1, pts[pts.length - 1].dist);
  const driftX = x;
  const driftY = y;

  return rawTrajectory.map((pt) => {
    const progress = pt.dist / totalDist;
    return {
      x: pt.x - progress * driftX,
      y: pt.y - progress * driftY,
    };
  });
}

/**
 * Generate high-definition Track Map Data synchronized with telemetry and lap comparison
 */
export function generateTrackMapData(
  telemetry: ParsedTelemetryFile,
  trackHint?: string,
  lapComparison?: LapComparisonSummary | null
): TrackMapData {
  const totalDistance = Math.max(100, telemetry.points[telemetry.points.length - 1]?.dist || 7000);
  const hint = `${trackHint || ""} ${telemetry.filename || ""}`.toLowerCase();

  let realCircuit: RealCircuitDefinition | null = null;
  let circuitName = "Grand Prix Circuit";

  if (hint.includes("silverstone")) {
    realCircuit = REAL_CIRCUITS.silverstone;
    circuitName = "Silverstone Grand Prix Circuit";
  } else if (hint.includes("monza")) {
    realCircuit = REAL_CIRCUITS.monza;
    circuitName = "Autodromo Nazionale Monza";
  } else if (hint.includes("spa")) {
    realCircuit = REAL_CIRCUITS.spa;
    circuitName = "Circuit de Spa-Francorchamps";
  }

  let points: TrackMapPoint[] = [];

  if (realCircuit) {
    // 1. Authentic Real-World GPS Track Map
    points = telemetry.points.map((pt, idx) => {
      const coord = interpolateRealCircuit(realCircuit!, pt.dist, totalDistance);
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
  } else {
    // 2. Universal Dead-Reckoning Fallback for Custom Telemetry CSVs
    const rawPositions = generateDeadReckoningTrajectory(telemetry);

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

    const padding = 60;
    const usableSize = 1000 - padding * 2;
    const scale = usableSize / maxRange;

    const offsetX = padding + (usableSize - rangeX * scale) / 2;
    const offsetY = padding + (usableSize - rangeY * scale) / 2;

    points = telemetry.points.map((pt, idx) => {
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
  }

  // Build Corner Markers directly placed on authentic GPS apexes
  const corners: TrackCorner[] = [];

  if (realCircuit) {
    realCircuit.corners.forEach((rc, cIdx) => {
      const mappedDist = Math.round((rc.dist / realCircuit!.officialDistance) * totalDistance);

      let closestIdx = 0;
      let minDiff = Infinity;
      telemetry.points.forEach((p, pIdx) => {
        const diff = Math.abs(p.dist - mappedDist);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = pIdx;
        }
      });

      const pt = points[closestIdx] || points[0];
      const cornerComp: CornerDeltaComparison | undefined = lapComparison?.cornerComparisons?.find(
        (c) => Math.abs(c.dist - mappedDist) < 280
      );

      corners.push({
        id: `corner-${cIdx}`,
        name: rc.name,
        shortName: rc.shortName,
        dist: mappedDist,
        x: pt.x,
        y: pt.y,
        driverSpeed: cornerComp?.driverMinSpeed ?? pt.speed,
        refSpeed: cornerComp?.refMinSpeed ?? pt.refSpeed,
        speedDelta: cornerComp?.speedDelta,
        timeDelta: cornerComp?.timeDelta,
      });
    });
  } else if (lapComparison?.cornerComparisons && lapComparison.cornerComparisons.length > 0) {
    lapComparison.cornerComparisons.forEach((c, idx) => {
      let closestIdx = 0;
      let minDiff = Infinity;
      telemetry.points.forEach((p, pIdx) => {
        const diff = Math.abs(p.dist - c.dist);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = pIdx;
        }
      });
      const pt = points[closestIdx] || points[0];

      corners.push({
        id: `corner-${idx}`,
        name: c.corner,
        shortName: `T${idx + 1}`,
        dist: c.dist,
        x: pt.x,
        y: pt.y,
        driverSpeed: c.driverMinSpeed,
        refSpeed: c.refMinSpeed,
        speedDelta: c.speedDelta,
        timeDelta: c.timeDelta,
      });
    });
  } else {
    telemetry.minCornerSpeeds.slice(0, 10).forEach((cs, idx) => {
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
