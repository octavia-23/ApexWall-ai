import { describe, it, expect } from "vitest";
import { computeGGFrictionCircle } from "@/lib/telemetry-friction-circle";
import { ParsedTelemetryFile, TelemetryPoint } from "@/types/telemetry";

function createMockTelemetryFile(
  points: Partial<TelemetryPoint>[],
  overrides?: Partial<ParsedTelemetryFile>
): ParsedTelemetryFile {
  const fullPoints: TelemetryPoint[] = points.map((p, idx) => ({
    time: p.time ?? idx * 0.05,
    dist: p.dist ?? idx * 2,
    speed: p.speed ?? 150,
    throttle: p.throttle ?? 0,
    brake: p.brake ?? 0,
    gear: p.gear ?? 4,
    steer: p.steer ?? 0,
    rpm: p.rpm ?? 6000,
    latG: p.latG !== undefined ? p.latG : null,
    longG: p.longG !== undefined ? p.longG : null,
    tempFL: p.tempFL ?? null,
    tempFR: p.tempFR ?? null,
    tempRL: p.tempRL ?? null,
    tempRR: p.tempRR ?? null,
    pressFL: p.pressFL ?? null,
    pressFR: p.pressFR ?? null,
    pressRL: p.pressRL ?? null,
    pressRR: p.pressRR ?? null,
    understeerAngle: p.understeerAngle ?? null,
  }));

  const hasLatG = fullPoints.some((p) => p.latG != null);
  const hasLongG = fullPoints.some((p) => p.longG != null);

  return {
    filename: "mock-telemetry.csv",
    rawCount: fullPoints.length,
    lapTime: "1:30.000",
    topSpeed: 200,
    minSpeed: 60,
    maxLatG: 2.0,
    maxDecelG: -2.0,
    minCornerSpeeds: [],
    trailBrakingScore: 80,
    throttleSmoothness: 80,
    steeringScrub: 80,
    tyreStats: {
      FL: { temp: "80°C", pressure: "27.0 psi" },
      FR: { temp: "80°C", pressure: "27.0 psi" },
      RL: { temp: "80°C", pressure: "27.0 psi" },
      RR: { temp: "80°C", pressure: "27.0 psi" },
    },
    detectedAnomalies: [],
    dataQuality: {
      totalRows: fullPoints.length,
      channels: {
        latG: {
          channel: "latG",
          totalSamples: fullPoints.length,
          validSamples: hasLatG ? fullPoints.length : 0,
          missingSamples: hasLatG ? 0 : fullPoints.length,
          coveragePct: hasLatG ? 100 : 0,
          status: hasLatG ? "available" : "missing",
        },
        longG: {
          channel: "longG",
          totalSamples: fullPoints.length,
          validSamples: hasLongG ? fullPoints.length : 0,
          missingSamples: hasLongG ? 0 : fullPoints.length,
          coveragePct: hasLongG ? 100 : 0,
          status: hasLongG ? "available" : "missing",
        },
      } as any,
      overallQuality: "good",
      warnings: [],
    },
    phaseBalance: {} as any,
    driverVsCar: { driverTechniquePoints: [], mechanicalSetupPoints: [] },
    points: fullPoints,
    channels: ["speed", "latG", "longG"],
    ...overrides,
  };
}

describe("src/lib/telemetry-friction-circle characterization tests", () => {
  it("characterizes constant-radius cornering at 2.0G", () => {
    // 50 points of steady state right-hand cornering at 2.0 latG, 0.0 longG
    const points: Partial<TelemetryPoint>[] = Array.from({ length: 50 }, () => ({
      latG: 2.0,
      longG: 0.0,
      speed: 140,
      brake: 0,
      throttle: 40,
      steer: 35,
    }));

    const file = createMockTelemetryFile(points);
    const result = computeGGFrictionCircle(file);

    expect(result.peakLatG).toBe(2);
    expect(result.peakDecelG).toBe(0);
    expect(result.peakCombinedG).toBe(2);
    expect(result.scaleMaxG).toBe(2.5); // <= 3.0G -> 2.5
    expect(result.gripUtilizationPct).toBe(100);
    expect(result.envelopeHull.length).toBe(36);

    // Bin 0 corresponds to angle ~ 0.087 rad (close to positive latG axis)
    // Points at (2.0, 0.0) have angle = 0 rad, falling in bin 0
    const bin0 = result.envelopeHull[0];
    expect(bin0.latG).toBeCloseTo(1.99, 1);
    expect(bin0.longG).toBeCloseTo(0.17, 1);

    // Because longG is 0.0 (neither < -0.3 nor > 0.2), all quadrant arrays are empty
    // so avgGrip returns fallback 70
    expect(result.quadrantStats).toEqual({
      trailBrakingLeftGripPct: 70,
      trailBrakingRightGripPct: 70,
      powerDownLeftGripPct: 70,
      powerDownRightGripPct: 70,
    });
  });

  it("characterizes straight-line braking at -3.0G", () => {
    // 40 points of heavy straight-line deceleration at -3.0G
    const points: Partial<TelemetryPoint>[] = Array.from({ length: 40 }, () => ({
      latG: 0.0,
      longG: -3.0,
      speed: 180,
      brake: 100,
      throttle: 0,
      steer: 0,
    }));

    const file = createMockTelemetryFile(points);
    const result = computeGGFrictionCircle(file);

    expect(result.peakLatG).toBe(0);
    expect(result.peakDecelG).toBe(-3);
    expect(result.peakCombinedG).toBe(3);
    expect(result.scaleMaxG).toBe(2.5); // peakCombinedG is not > 3.0 -> 2.5
    expect(result.gripUtilizationPct).toBe(100);
    expect(result.envelopeHull.length).toBe(36);

    // Angle of (lat: 0, long: -3) in atan2(long, lat) is -PI/2 -> +3PI/2 = 4.71 rad
    // Falling into bin index 27 (27 / 36 * 2PI = 4.712)
    const bin27 = result.envelopeHull[27];
    expect(bin27.longG).toBeCloseTo(-3.0, 1);

    // latG is 0.0 (neither < -0.2 nor > 0.2), so quadrant arrays are empty -> fallback 70
    expect(result.quadrantStats).toEqual({
      trailBrakingLeftGripPct: 70,
      trailBrakingRightGripPct: 70,
      powerDownLeftGripPct: 70,
      powerDownRightGripPct: 70,
    });
  });

  it("characterizes mixed dynamic braking, cornering, and power-down", () => {
    const points: Partial<TelemetryPoint>[] = [
      // 20 points trail-braking right: latG = 1.6, longG = -1.2, brake = 60
      ...Array.from({ length: 20 }, () => ({
        latG: 1.6,
        longG: -1.2,
        speed: 110,
        brake: 60,
        throttle: 0,
      })),
      // 20 points trail-braking left: latG = -1.5, longG = -1.0, brake = 40
      ...Array.from({ length: 20 }, () => ({
        latG: -1.5,
        longG: -1.0,
        speed: 100,
        brake: 40,
        throttle: 0,
      })),
      // 20 points power-down right: latG = 1.2, longG = 0.8, throttle = 80
      ...Array.from({ length: 20 }, () => ({
        latG: 1.2,
        longG: 0.8,
        speed: 130,
        brake: 0,
        throttle: 80,
      })),
      // 20 points power-down left: latG = -1.4, longG = 0.9, throttle = 85
      ...Array.from({ length: 20 }, () => ({
        latG: -1.4,
        longG: 0.9,
        speed: 135,
        brake: 0,
        throttle: 85,
      })),
    ];

    const file = createMockTelemetryFile(points);
    const result = computeGGFrictionCircle(file);

    expect(result.peakLatG).toBe(1.6);
    expect(result.peakDecelG).toBe(-1.2);
    expect(result.peakCombinedG).toBe(2);
    expect(result.scaleMaxG).toBe(2.5);
    expect(result.gripUtilizationPct).toBe(75);
    expect(result.envelopeHull.length).toBe(36);

    // Assert quadrant percentages are pinned exactly
    expect(result.quadrantStats).toEqual({
      trailBrakingLeftGripPct: 90,
      trailBrakingRightGripPct: 100,
      powerDownLeftGripPct: 83,
      powerDownRightGripPct: 72,
    });

    // Trail braking transition efficiency should be pinned
    expect(result.trailBrakingTransitionEfficiency).toBe(100);
  });

  it("pins the exact current fallback values (75, 72, 70, 88)", () => {
    // A dataset with ONLY resting / cruising non-dynamic points (speed 100, brake 0, latG 0.1, longG 0.0)
    // dynamicCount === 0 -> gripUtilizationPct fallback = 75
    // combinedSampleCount === 0 -> trailBrakingTransitionEfficiency fallback = 72
    // arr.length === 0 in quadrants -> quadrantStats fallback = 70
    const idlePoints: Partial<TelemetryPoint>[] = Array.from({ length: 10 }, () => ({
      latG: 0.1,
      longG: 0.0,
      speed: 100,
      brake: 0,
      throttle: 20,
    }));

    const file = createMockTelemetryFile(idlePoints);

    // Also supply reference telemetry that has points but NO dynamic points (brake <= 10, abs(latG) <= 0.5)
    // refDyn === 0 -> refGripUtilizationPct fallback = 88
    const idleRef = createMockTelemetryFile(idlePoints, { filename: "mock-ref.csv" });

    const result = computeGGFrictionCircle(file, idleRef);

    expect(result.gripUtilizationPct).toBe(75);
    expect(result.trailBrakingTransitionEfficiency).toBe(72);
    expect(result.quadrantStats.trailBrakingLeftGripPct).toBe(70);
    expect(result.quadrantStats.trailBrakingRightGripPct).toBe(70);
    expect(result.quadrantStats.powerDownLeftGripPct).toBe(70);
    expect(result.quadrantStats.powerDownRightGripPct).toBe(70);

    // Verdict with refGripUtilizationPct = 88 and gripUtilizationPct = 75: diff = 13 (> 8)
    expect(result.gripDeficitVerdict).toContain("Grip Envelope Deficit: 13% below benchmark");
  });

  it("pins the null-channel unavailable path when latG or longG channels are missing", () => {
    // Case 1: validGCount === 0 (all points have latG/longG = null)
    const nullPoints: Partial<TelemetryPoint>[] = [
      { latG: null, longG: null, speed: 100 },
      { latG: null, longG: null, speed: 110 },
    ];
    const missingFile = createMockTelemetryFile(nullPoints, {
      dataQuality: {
        totalRows: 2,
        channels: {
          latG: {
            channel: "latG",
            totalSamples: 2,
            validSamples: 0,
            missingSamples: 2,
            coveragePct: 0,
            status: "missing",
          },
          longG: {
            channel: "longG",
            totalSamples: 2,
            validSamples: 0,
            missingSamples: 2,
            coveragePct: 0,
            status: "missing",
          },
        } as any,
        overallQuality: "insufficient",
        warnings: ["Missing accelerometer data"],
      },
    });

    const result = computeGGFrictionCircle(missingFile);

    expect(result.scaleMaxG).toBe(2.5);
    expect(result.peakCombinedG).toBeNull();
    expect(result.peakLatG).toBeNull();
    expect(result.peakDecelG).toBeNull();
    expect(result.gripUtilizationPct).toBeNull();
    expect(result.trailBrakingTransitionEfficiency).toBeNull();
    expect(result.quadrantStats).toEqual({
      trailBrakingLeftGripPct: 0,
      trailBrakingRightGripPct: 0,
      powerDownLeftGripPct: 0,
      powerDownRightGripPct: 0,
    });
    expect(result.envelopeHull).toEqual([]);
    expect(result.gripDeficitVerdict).toBe(
      "G-G Friction Circle unavailable: Lateral (latG) and longitudinal (longG) accelerometer channels are missing."
    );
  });
});
