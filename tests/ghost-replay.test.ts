import { describe, it, expect } from "vitest";
import {
  calculateVehicleHeading,
  formatLapTimestamp,
  findSampleIndexAtTime,
  interpolateTrackPointAtDist,
  calculateGhostPosition,
} from "../src/lib/ghost-replay-engine";
import { TrackMapPoint } from "../src/types/telemetry";

describe("Ghost Replay Engine Physics & Calculations", () => {
  it("formats lap timestamps correctly in motorsport format", () => {
    expect(formatLapTimestamp(0)).toBe("0:00.000");
    expect(formatLapTimestamp(10.05)).toBe("0:10.050");
    expect(formatLapTimestamp(65.123)).toBe("1:05.123");
    expect(formatLapTimestamp(104.567)).toBe("1:44.567");
    expect(formatLapTimestamp(-5)).toBe("0:00.000");
  });

  it("calculates vehicle heading angles along track trajectory", () => {
    const straightPoints = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
    ];
    // Facing east (positive X) -> heading = 0 radians
    const heading = calculateVehicleHeading(straightPoints, 1);
    expect(heading).toBeCloseTo(0, 2);

    const northPoints = [
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 0, y: 200 },
    ];
    // Facing south (positive Y in canvas) -> heading = PI/2
    const headingNorth = calculateVehicleHeading(northPoints, 1);
    expect(headingNorth).toBeCloseTo(Math.PI / 2, 2);
  });

  it("finds sample index for target time using binary search", () => {
    const points: TrackMapPoint[] = [
      { dist: 0, time: 0, x: 0, y: 0, speed: 100, throttle: 100, brake: 0, latG: 0 },
      { dist: 100, time: 2.0, x: 10, y: 0, speed: 120, throttle: 100, brake: 0, latG: 0 },
      { dist: 200, time: 4.0, x: 20, y: 0, speed: 140, throttle: 100, brake: 0, latG: 0 },
      { dist: 300, time: 6.0, x: 30, y: 0, speed: 160, throttle: 100, brake: 0, latG: 0 },
    ];

    expect(findSampleIndexAtTime(points, 0)).toBe(0);
    expect(findSampleIndexAtTime(points, 2.0)).toBe(1);
    expect(findSampleIndexAtTime(points, 4.1)).toBe(2);
    expect(findSampleIndexAtTime(points, 5.9)).toBe(3);
    expect(findSampleIndexAtTime(points, 10.0)).toBe(3);
  });

  it("interpolates coordinate and speed at intermediate track distances", () => {
    const points: TrackMapPoint[] = [
      { dist: 0, time: 0, x: 0, y: 0, speed: 100, throttle: 100, brake: 0, latG: 0 },
      { dist: 100, time: 2.0, x: 100, y: 0, speed: 200, throttle: 100, brake: 0, latG: 0 },
      { dist: 200, time: 4.0, x: 200, y: 0, speed: 300, throttle: 100, brake: 0, latG: 0 },
    ];

    const mid = interpolateTrackPointAtDist(points, 50);
    expect(mid.x).toBeCloseTo(50, 1);
    expect(mid.y).toBeCloseTo(0, 1);
    expect(mid.speed).toBeCloseTo(150, 1);
  });

  it("calculates ghost position when benchmark time delta is positive (driver behind ghost)", () => {
    const points: TrackMapPoint[] = [
      { dist: 0, time: 0, x: 0, y: 0, speed: 100, throttle: 100, brake: 0, latG: 0, timeDelta: 0, refSpeed: 100 },
      { dist: 100, time: 2.0, x: 100, y: 0, speed: 150, throttle: 100, brake: 0, latG: 0, timeDelta: 0.5, refSpeed: 180 },
      { dist: 200, time: 4.0, x: 200, y: 0, speed: 200, throttle: 100, brake: 0, latG: 0, timeDelta: 0.8, refSpeed: 210 },
      { dist: 300, time: 6.0, x: 300, y: 0, speed: 250, throttle: 100, brake: 0, latG: 0, timeDelta: 1.0, refSpeed: 250 },
    ];

    const ghost = calculateGhostPosition(points, 1);
    expect(ghost).not.toBeNull();
    // Driver is at 100m, timeDelta is +0.5s at 180 km/h (50 m/s) -> ghost is ahead by ~25m!
    expect(ghost!.dist).toBeGreaterThan(100);
    expect(ghost!.distDelta).toBeGreaterThan(0);
    expect(ghost!.isSynthetic).toBe(false);
  });

  it("calculates ghost position when benchmark time delta is negative (driver ahead of ghost)", () => {
    const points: TrackMapPoint[] = [
      { dist: 0, time: 0, x: 0, y: 0, speed: 100, throttle: 100, brake: 0, latG: 0, timeDelta: 0, refSpeed: 100 },
      { dist: 100, time: 2.0, x: 100, y: 0, speed: 150, throttle: 100, brake: 0, latG: 0, timeDelta: -0.3, refSpeed: 140 },
      { dist: 200, time: 4.0, x: 200, y: 0, speed: 200, throttle: 100, brake: 0, latG: 0, timeDelta: -0.5, refSpeed: 180 },
    ];

    const ghost = calculateGhostPosition(points, 2);
    expect(ghost).not.toBeNull();
    // Driver is at 200m, timeDelta is -0.5s -> ghost is behind driver
    expect(ghost!.dist).toBeLessThan(200);
    expect(ghost!.distDelta).toBeLessThan(0);
  });

  it("handles null/empty gracefully", () => {
    expect(calculateGhostPosition([], 0)).toBeNull();
    expect(calculateGhostPosition([{ dist: 0, x: 0, y: 0, speed: 0, throttle: 0, brake: 0, latG: 0 }], -1)).toBeNull();
  });
});
