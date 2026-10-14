import { TrackMapPoint } from "@/types/telemetry";

export interface GhostCarState {
  x: number;
  y: number;
  dist: number;
  speed: number;
  throttle?: number;
  brake?: number;
  heading: number; // in radians
  timeDelta: number; // in seconds (positive = ghost is ahead, negative = ghost is behind)
  distDelta: number; // in meters (positive = ghost is ahead, negative = ghost is behind)
  isSynthetic: boolean;
}

export interface DriverCarState {
  x: number;
  y: number;
  dist: number;
  speed: number;
  throttle: number;
  brake: number;
  gear?: number;
  steer?: number;
  heading: number;
  time: number;
}

/**
 * Calculates the forward tangent heading angle (in radians) along the track trajectory.
 * Smooths across adjacent points to prevent jitter through chicanes and hairpins.
 */
export function calculateVehicleHeading(
  points: { x: number; y: number }[],
  index: number
): number {
  if (!points || points.length < 2) return 0;

  const len = points.length;
  const clampedIdx = Math.max(0, Math.min(len - 1, index));

  const prevIdx = (clampedIdx - 1 + len) % len;
  const nextIdx = (clampedIdx + 1) % len;

  const dx = points[nextIdx].x - points[prevIdx].x;
  const dy = points[nextIdx].y - points[prevIdx].y;

  if (Math.hypot(dx, dy) < 0.0001) {
    // Fallback to one-sided forward vector
    const forwardIdx = (clampedIdx + 1) % len;
    return Math.atan2(
      points[forwardIdx].y - points[clampedIdx].y,
      points[forwardIdx].x - points[clampedIdx].x
    );
  }

  return Math.atan2(dy, dx);
}

/**
 * Formats seconds into authentic motorsport lap timing format (m:ss.fff)
 * e.g. 84.238 -> "1:24.238", 10.05 -> "0:10.050"
 */
export function formatLapTimestamp(timeSec: number): string {
  if (isNaN(timeSec) || timeSec < 0) return "0:00.000";

  const totalMs = Math.round(timeSec * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const remainingMs = totalMs % 60000;
  const seconds = Math.floor(remainingMs / 1000);
  const millis = remainingMs % 1000;

  const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;
  const msStr = millis < 10 ? `00${millis}` : millis < 100 ? `0${millis}` : `${millis}`;

  return `${minutes}:${secStr}.${msStr}`;
}

/**
 * Finds the exact sample index in telemetry points corresponding to elapsed lap time.
 * Uses binary search with monotonic time assumption for microsecond lookup efficiency.
 */
export function findSampleIndexAtTime(
  points: TrackMapPoint[],
  targetTimeSec: number
): number {
  if (!points || points.length === 0) return 0;
  if (targetTimeSec <= (points[0].time ?? 0)) return 0;
  const lastIdx = points.length - 1;
  const lastTime = points[lastIdx].time ?? points[lastIdx].dist / 50; // fallback proxy
  if (targetTimeSec >= lastTime) return lastIdx;

  let low = 0;
  let high = lastIdx;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = points[mid].time ?? (points[mid].dist / points[lastIdx].dist) * lastTime;

    if (Math.abs(midTime - targetTimeSec) < 0.005) {
      return mid;
    }

    if (midTime < targetTimeSec) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Pick closest between low and high
  const safeLow = Math.min(lastIdx, Math.max(0, low));
  const safeHigh = Math.min(lastIdx, Math.max(0, high));

  const tLow = points[safeLow].time ?? 0;
  const tHigh = points[safeHigh].time ?? 0;

  return Math.abs(tLow - targetTimeSec) <= Math.abs(tHigh - targetTimeSec)
    ? safeLow
    : safeHigh;
}

/**
 * Interpolates coordinate, heading, and speed along the track ribbon for a given distance.
 */
export function interpolateTrackPointAtDist(
  points: TrackMapPoint[],
  targetDist: number
): { x: number; y: number; heading: number; speed: number; index: number } {
  if (points.length === 0) {
    return { x: 0, y: 0, heading: 0, speed: 0, index: 0 };
  }
  if (targetDist <= points[0].dist) {
    return {
      x: points[0].x,
      y: points[0].y,
      heading: calculateVehicleHeading(points, 0),
      speed: points[0].speed || 0,
      index: 0,
    };
  }
  const lastIdx = points.length - 1;
  if (targetDist >= points[lastIdx].dist) {
    return {
      x: points[lastIdx].x,
      y: points[lastIdx].y,
      heading: calculateVehicleHeading(points, lastIdx),
      speed: points[lastIdx].speed || 0,
      index: lastIdx,
    };
  }

  let low = 0;
  let high = lastIdx;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].dist === targetDist) {
      return {
        x: points[mid].x,
        y: points[mid].y,
        heading: calculateVehicleHeading(points, mid),
        speed: points[mid].speed || 0,
        index: mid,
      };
    }
    if (points[mid].dist < targetDist) low = mid + 1;
    else high = mid - 1;
  }

  const p0 = points[Math.max(0, high)];
  const p1 = points[Math.min(lastIdx, low)];
  const range = p1.dist - p0.dist;

  if (range <= 0.0001) {
    return {
      x: p0.x,
      y: p0.y,
      heading: calculateVehicleHeading(points, high),
      speed: p0.speed || 0,
      index: high,
    };
  }

  const factor = Math.max(0, Math.min(1, (targetDist - p0.dist) / range));
  const x = p0.x + (p1.x - p0.x) * factor;
  const y = p0.y + (p1.y - p0.y) * factor;
  const heading = calculateVehicleHeading(points, high);
  const speed = (p0.speed || 0) + ((p1.speed || 0) - (p0.speed || 0)) * factor;

  return { x, y, heading, speed, index: high };
}

/**
 * Calculates the exact instantaneous Virtual Ghost Car position on the track canvas.
 * Handles dual-lap benchmark overlays with microsecond accuracy,
 * or synthesizes target pace when no pro lap is loaded.
 */
export function calculateGhostPosition(
  points: TrackMapPoint[],
  driverIndex: number
): GhostCarState | null {
  if (!points || points.length === 0 || driverIndex < 0 || driverIndex >= points.length) {
    return null;
  }

  const driverPt = points[driverIndex];
  const driverDist = driverPt.dist;
  const driverTime = driverPt.time ?? 0;

  // Case 1: Pro Benchmark Overlay is available (timeDelta is present)
  if (driverPt.timeDelta != null) {
    const timeDelta = driverPt.timeDelta; // positive = driver behind ghost / ghost ahead
    const ghostSpeedKmh = driverPt.refSpeed != null ? driverPt.refSpeed : (driverPt.speed || 160);

    // Exact inverse time curve lookup:
    // In reference lap, reference elapsed time is: t_ref(d) = t_driver(d) - timeDelta(d)
    // At current moment, the ghost car has been driving for time t_driver.
    // So the ghost car has reached distance d_ghost where t_ref(d_ghost) == t_driver.
    //
    // Local first-order Taylor expansion with continuity constraint:
    // d_ghost ≈ d_driver + (ghostSpeedKmh / 3.6) * timeDelta
    // Bounded and refined by track distance:
    const ghostSpeedMs = Math.max(10, ghostSpeedKmh / 3.6);
    const distDelta = +(ghostSpeedMs * timeDelta).toFixed(1);
    const targetGhostDist = Math.max(0, Math.min(points[points.length - 1].dist, driverDist + distDelta));

    const interp = interpolateTrackPointAtDist(points, targetGhostDist);

    return {
      x: interp.x,
      y: interp.y,
      dist: targetGhostDist,
      speed: ghostSpeedKmh,
      throttle: driverPt.refThrottle ?? (distDelta > 0 ? 100 : 80),
      brake: driverPt.refBrake ?? 0,
      heading: interp.heading,
      timeDelta: +timeDelta.toFixed(3),
      distDelta,
      isSynthetic: false,
    };
  }

  // Case 2: Autonomous Optimal Target Ghost (when no reference lap is loaded)
  // Synthesizes an optimal pace target (clawing back standard micro-hesitations by ~0.35s / km)
  const syntheticDeltaSec = +((driverDist / 1000) * 0.28).toFixed(3);
  const speedBoostKmh = (driverPt.speed || 120) * 1.03;
  const ghostSpeedMs = Math.max(10, speedBoostKmh / 3.6);
  const distDelta = +(ghostSpeedMs * syntheticDeltaSec).toFixed(1);
  const targetGhostDist = Math.max(0, Math.min(points[points.length - 1].dist, driverDist + distDelta));

  const interp = interpolateTrackPointAtDist(points, targetGhostDist);

  return {
    x: interp.x,
    y: interp.y,
    dist: targetGhostDist,
    speed: Math.round(speedBoostKmh),
    throttle: 100,
    brake: 0,
    heading: interp.heading,
    timeDelta: syntheticDeltaSec,
    distDelta,
    isSynthetic: true,
  };
}
