import { describe, it, expect } from "vitest";
import { computeStintConsistencyAnalysis } from "../src/lib/stint-consistency-analyzer";
import { TelemetryPoint } from "../src/types/telemetry";

describe("Stint Consistency & Braking Point Drift Analyzer", () => {
  const dummyPoints: TelemetryPoint[] = Array.from({ length: 250 }, (_, i) => ({
    time: i * 0.5,
    dist: i * 28,
    speed: 140 + 80 * Math.sin(i / 12),
    throttle: i % 4 === 0 ? 100 : 70,
    brake: i % 20 === 0 ? 85 : 0,
    steer: 0,
    gear: 3,
    rpm: 6800,
    latG: 1.5 * Math.sin(i / 10),
    longG: i % 20 === 0 ? -2.2 : 0.8,
    tempFL: 88,
    tempFR: 89,
    tempRL: 86,
    tempRR: 87,
    pressFL: 27.2,
    pressFR: 27.3,
    pressRL: 26.8,
    pressRR: 26.9,
  }));

  it("calculates lap-to-lap pace variance and consistency ratings", () => {
    const res = computeStintConsistencyAnalysis(dummyPoints, "2:18.420", {
      stintLaps: 18,
    });

    expect(res.stintLapsAnalyzed).toBe(18);
    expect(res.overallConsistencyRatingPct).toBeGreaterThan(80);
    expect(res.overallConsistencyRatingPct).toBeLessThan(100);
    expect(res.lapTimeVarianceStdDev).toBeGreaterThan(0.05);
    expect(res.lapPaces.length).toBe(18);
  });

  it("identifies braking migration patterns across corners", () => {
    const res = computeStintConsistencyAnalysis(dummyPoints, "2:18.420");

    expect(res.brakingMigration.length).toBeGreaterThan(0);
    const corner1 = res.brakingMigration[0];
    expect(corner1.cornerName).toBeDefined();
    expect(corner1.earlyStintBrakeDistMeters).toBeGreaterThan(30);
    expect(corner1.lateStintBrakeDistMeters).toBeGreaterThan(30);
    expect(corner1.migrationDeltaMeters).not.toBe(0);
  });

  it("detects thermal equilibrium plateau point", () => {
    const res = computeStintConsistencyAnalysis(dummyPoints, "2:18.420");

    expect(res.thermalEquilibrium.plateauLap).toBeGreaterThanOrEqual(3);
    expect(res.thermalEquilibrium.optimalWindowLapsEnd).toBeGreaterThan(res.thermalEquilibrium.optimalWindowLapsStart);
    expect(res.thermalEquilibrium.stabilizedPressureFrontPsi).toBeGreaterThan(25);
  });

  it("verifies tyre friction degradation and stopping distance expansion invariant", () => {
    const res = computeStintConsistencyAnalysis(dummyPoints, "2:18.420", { stintLaps: 25 });

    // For every detected braking zone, tyre friction coefficient degradation must physically
    // expand stopping distance (lateStintBrakeDistMeters > earlyStintBrakeDistMeters) and reduce peak decel
    for (const b of res.brakingMigration) {
      expect(b.lateStintBrakeDistMeters).toBeGreaterThan(b.earlyStintBrakeDistMeters);
      expect(Math.abs(b.migrationDeltaMeters)).toBeGreaterThan(0);
      expect(b.decelerationPeakLateG).toBeLessThanOrEqual(b.decelerationPeakEarlyG);
    }
  });
});
