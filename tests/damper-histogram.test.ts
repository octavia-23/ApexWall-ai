import { describe, it, expect } from "vitest";
import {
  computeDamperHistograms,
  hasAuthenticSuspensionData,
} from "../src/lib/damper-histogram-calculator";
import { TelemetryPoint } from "../src/types/telemetry";

describe("MoTeC Damper Velocity Histogram Engine", () => {
  it("detects authentic vs synthesized suspension data accurately", () => {
    const rawPointsWithoutSusp: TelemetryPoint[] = Array.from({ length: 50 }, (_, i) => ({
      time: i * 0.02,
      dist: i * 10,
      speed: 150,
      throttle: 80,
      brake: 0,
      steer: 2,
      gear: 4,
      rpm: 6500,
      latG: 0.5,
      longG: 0.1,
      tempFL: 85,
      tempFR: 85,
      tempRL: 82,
      tempRR: 82,
      pressFL: 27.5,
      pressFR: 27.5,
      pressRL: 27.0,
      pressRR: 27.0,
    }));

    expect(hasAuthenticSuspensionData(rawPointsWithoutSusp)).toBe(false);

    const rawPointsWithSusp: TelemetryPoint[] = rawPointsWithoutSusp.map((p, i) => ({
      ...p,
      suspFL: 50 + Math.sin(i * 0.2) * 10,
      suspFR: 50 - Math.sin(i * 0.2) * 10,
      suspRL: 60 + Math.cos(i * 0.2) * 8,
      suspRR: 60 - Math.cos(i * 0.2) * 8,
    }));

    expect(hasAuthenticSuspensionData(rawPointsWithSusp)).toBe(true);
  });

  it("enforces the mathematical invariant: sum of bin percentages equals 100.00% across all 4 corners", () => {
    // Generate synthetic lap with braking, cornering, acceleration
    const points: TelemetryPoint[] = Array.from({ length: 200 }, (_, i) => {
      const t = i * 0.05;
      const speed = 100 + Math.sin(t * 0.5) * 60;
      const longG = Math.cos(t * 0.5) * 1.5;
      const latG = Math.sin(t * 0.8) * 2.0;
      return {
        time: t,
        dist: i * 15,
        speed,
        throttle: longG > 0 ? 80 : 0,
        brake: longG < 0 ? 90 : 0,
        steer: latG * 15,
        gear: 3,
        rpm: 6000,
        latG,
        longG,
        tempFL: 85,
        tempFR: 85,
        tempRL: 85,
        tempRR: 85,
        pressFL: 27.5,
        pressFR: 27.5,
        pressRL: 27.5,
        pressRR: 27.5,
      };
    });

    const analysis = computeDamperHistograms(points);

    expect(analysis.isSynthesized).toBe(true);
    expect(analysis.velocityRange).toEqual([-300, 300]);
    expect(analysis.binWidth).toBe(25);

    const corners = ["FL", "FR", "RL", "RR"] as const;
    for (const c of corners) {
      const stats = analysis.corners[c];
      expect(stats.sampleCount).toBe(200);
      expect(stats.bins.length).toBe(24);

      // Check sum of bin percentages is 100.00% (within floating point precision)
      const sumPct = stats.bins.reduce((acc, b) => acc + b.percentage, 0);
      expect(Math.abs(sumPct - 100.0)).toBeLessThanOrEqual(0.05);

      // Total count across bins equals sample count
      const totalCount = stats.bins.reduce((acc, b) => acc + b.count, 0);
      expect(totalCount).toBe(200);

      // Check that regime classification is properly populated
      expect(stats.bins.some((b) => b.regime === "high_bump")).toBe(true);
      expect(stats.bins.some((b) => b.regime === "low_bump")).toBe(true);
      expect(stats.bins.some((b) => b.regime === "low_rebound")).toBe(true);
      expect(stats.bins.some((b) => b.regime === "high_rebound")).toBe(true);
    }
  });

  it("computes authentic damper velocities from direct damperVel channels correctly", () => {
    // Generate direct damper velocity values (e.g. from MoTeC i2)
    const points: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.02,
      dist: i * 10,
      speed: 160,
      throttle: 70,
      brake: 0,
      steer: 0,
      gear: 4,
      rpm: 7000,
      latG: 0,
      longG: 0,
      tempFL: 80,
      tempFR: 80,
      tempRL: 80,
      tempRR: 80,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
      damperVelFL: (i % 2 === 0 ? -30 : 30), // alternating low bump and low rebound
      damperVelFR: (i % 2 === 0 ? -30 : 30),
      damperVelRL: (i % 2 === 0 ? -40 : 40),
      damperVelRR: (i % 2 === 0 ? -40 : 40),
    }));

    const analysis = computeDamperHistograms(points);

    expect(analysis.isSynthesized).toBe(false);
    expect(analysis.corners.FL.bumpPct).toBe(50);
    expect(analysis.corners.FL.reboundPct).toBe(50);
    expect(analysis.corners.FL.lowSpeedTotalPct).toBe(100);
    expect(analysis.corners.FL.highSpeedTotalPct).toBe(0);
    expect(analysis.corners.FL.bumpReboundRatio).toBe(1);
    expect(analysis.corners.FL.isPackingDown).toBe(false);
  });

  it("correctly identifies packing down anomaly when rebound duration dominates", () => {
    // A damper that spends 75% of the time in rebound and 25% in bump (e.g., packing down)
    const points: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.02,
      dist: i * 10,
      speed: 120,
      throttle: 50,
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 5500,
      latG: 0,
      longG: 0,
      tempFL: 80,
      tempFR: 80,
      tempRL: 80,
      tempRR: 80,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
      // 3 rebound samples (+20 mm/s) for every 1 bump sample (-60 mm/s)
      damperVelFL: i % 4 === 0 ? -60 : 20,
      damperVelFR: i % 4 === 0 ? -60 : 20,
      damperVelRL: i % 2 === 0 ? -30 : 30,
      damperVelRR: i % 2 === 0 ? -30 : 30,
    }));

    const analysis = computeDamperHistograms(points);

    expect(analysis.corners.FL.reboundPct).toBeGreaterThanOrEqual(70);
    expect(analysis.corners.FL.isPackingDown).toBe(true);
    expect(analysis.corners.FL.anomalyFlags.some((f) => f.includes("Packing Down"))).toBe(true);
    expect(analysis.engineerRecommendations.some((r) => r.includes("Front Rebound Relaxation"))).toBe(true);
  });

  it("gracefully handles empty or single-point edge cases without crashing", () => {
    const emptyAnalysis = computeDamperHistograms([]);
    expect(emptyAnalysis.corners.FL.sampleCount).toBe(0);
    expect(emptyAnalysis.corners.FL.bins.length).toBe(24);

    const singlePointAnalysis = computeDamperHistograms([
      {
        time: 0,
        dist: 0,
        speed: 0,
        throttle: 0,
        brake: 0,
        steer: 0,
        gear: 0,
        rpm: 0,
        latG: 0,
        longG: 0,
        tempFL: null,
        tempFR: null,
        tempRL: null,
        tempRR: null,
        pressFL: null,
        pressFR: null,
        pressRL: null,
        pressRR: null,
      },
    ]);
    expect(singlePointAnalysis.corners.FL.sampleCount).toBe(1);
    expect(singlePointAnalysis.corners.FL.bins.length).toBe(24);
  });

  it("verifies chassis jerk vector kinematic excitation invariant on synthesized suspension", () => {
    // Generate smooth gentle acceleration trace (low jerk)
    const smoothPoints: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.05,
      dist: i * 10,
      speed: 100 + i * 0.5,
      throttle: 50,
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 5000,
      latG: 0.1,
      longG: 0.2, // constant gentle acceleration (zero jerk)
      tempFL: 80,
      tempFR: 80,
      tempRL: 80,
      tempRR: 80,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
    }));

    // Generate high jerk trace (rapid curb strikes / alternating G transients)
    const highJerkPoints: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.05,
      dist: i * 10,
      speed: 100,
      throttle: 50,
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 5000,
      latG: (i % 2 === 0 ? 1.5 : -1.5), // extreme lateral jerk (+/- 60 G/s)
      longG: (i % 2 === 0 ? 1.0 : -1.0), // extreme longitudinal jerk
      tempFL: 80,
      tempFR: 80,
      tempRL: 80,
      tempRR: 80,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
    }));

    const smoothAnalysis = computeDamperHistograms(smoothPoints);
    const jerkAnalysis = computeDamperHistograms(highJerkPoints);

    // High jerk trace MUST activate high-speed damper velocity regime (> 100 mm/s)
    expect(jerkAnalysis.corners.FL.highSpeedTotalPct).toBeGreaterThan(
      smoothAnalysis.corners.FL.highSpeedTotalPct
    );
  });
});
