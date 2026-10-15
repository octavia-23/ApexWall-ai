import { describe, it, expect } from "vitest";
import { computeCornerLedger } from "../src/lib/corner-ledger-calculator";
import { TelemetryPoint, LapComparisonSummary } from "../src/types/telemetry";

describe("Corner Performance Ledger Calculator", () => {
  const mockSpaPoints: TelemetryPoint[] = Array.from({ length: 450 }, (_, i) => {
    const dist = i * 16; // ~7200m lap
    // Spa Turn 1 La Source apex is at dist ~580m
    const isBrakingT1 = dist >= 450 && dist <= 580;
    const isExitT1 = dist > 580 && dist <= 750;
    const speed = isBrakingT1
      ? Math.max(65, 260 - (dist - 450) * 1.5)
      : isExitT1
      ? Math.min(240, 65 + (dist - 580) * 1.1)
      : 220 + 30 * Math.sin(dist / 500);

    const brake = isBrakingT1 ? Math.min(100, (dist - 450) * 1.5) : 0;
    const throttle = isBrakingT1 ? 0 : isExitT1 ? Math.min(100, (dist - 580) * 0.8) : 100;
    const latG = (dist >= 550 && dist <= 620) ? 1.85 : 0.2;
    const longG = isBrakingT1 ? -1.9 : isExitT1 ? 0.6 : 0;

    return {
      time: i * 0.35,
      dist,
      speed,
      throttle,
      brake,
      steer: (dist >= 550 && dist <= 620) ? 35 : 0,
      gear: speed < 80 ? 1 : speed < 140 ? 2 : speed < 190 ? 3 : 4,
      rpm: 7200,
      latG,
      longG,
      tempFL: 85,
      tempFR: 88,
      tempRL: 84,
      tempRR: 84,
      pressFL: 27.2,
      pressFR: 27.4,
      pressRL: 26.8,
      pressRR: 26.9,
    };
  });

  it("handles empty telemetry points gracefully", () => {
    const result = computeCornerLedger([]);
    expect(result.corners).toHaveLength(0);
    expect(result.totalTimeLostInCornersSeconds).toBe(0);
    expect(result.biggestLossCorner).toBe("None");
  });

  it("extracts corners and profiles phase-by-phase telemetry", () => {
    const result = computeCornerLedger(mockSpaPoints, null, "Circuit de Spa-Francorchamps");

    expect(result.corners.length).toBeGreaterThan(0);
    const t1 = result.corners[0];
    expect(t1.name).toBeDefined();
    expect(t1.dist).toBeGreaterThan(0);
    expect(t1.entryPeakDecelG).toBeGreaterThan(0);
    expect(t1.driverApexSpeedKmh).toBeGreaterThan(30);
    expect(t1.exitSpeedKmh).toBeGreaterThan(t1.driverApexSpeedKmh);
  });

  it("incorporates pro benchmark deltas when available", () => {
    const mockLapComparison: LapComparisonSummary = {
      driverLapTime: "2:18.500",
      refLapTime: "2:16.800",
      totalTimeDeltaSeconds: 1.7,
      topSpeedDeltaKmh: -3.2,
      cornerComparisons: [
        {
          corner: "Turn 1 (La Source Hairpin)",
          shortName: "T1",
          dist: 580,
          driverMinSpeed: 68,
          refMinSpeed: 74,
          speedDelta: -6,
          timeDelta: 0.35,
          brakingPointDeltaMeters: -20,
          throttleCommitDeltaMeters: 20,
          verdict: "Overslowed Apex",
        },
      ],
      deltaPoints: [],
    };

    const result = computeCornerLedger(mockSpaPoints, mockLapComparison, "Circuit de Spa-Francorchamps");
    const t1 = result.corners[0];

    expect(t1.apexSpeedDeltaKmh).toBeCloseTo(-6, 1);
    expect(t1.brakeDeltaMeters).toBeDefined();
    expect(t1.throttleCommitDeltaMeters).toBeDefined();
    expect(t1.totalCornerTimeDeltaSeconds).toBeGreaterThan(0);
    expect(t1.verdictBadge).toContain("Apex");
  });

  it("calculates overall cornering efficiency and braking consistency scores", () => {
    const result = computeCornerLedger(mockSpaPoints, null, "Circuit de Spa-Francorchamps");

    expect(result.brakingConsistencyScore).toBeGreaterThanOrEqual(0);
    expect(result.brakingConsistencyScore).toBeLessThanOrEqual(100);
    expect(result.overallCorneringEfficiencyPct).toBeGreaterThanOrEqual(0);
    expect(result.overallCorneringEfficiencyPct).toBeLessThanOrEqual(100);
  });
});
