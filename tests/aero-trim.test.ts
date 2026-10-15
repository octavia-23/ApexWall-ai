import { describe, it, expect } from "vitest";
import { computeAeroTrim } from "../src/lib/aero-trim-calculator";

describe("Aerodynamic Rake & Wing Trim Calculator", () => {
  it("computes accurate aerodynamic rake height and pitch angle", () => {
    const res = computeAeroTrim({
      frontRideHeightMm: 50,
      rearRideHeightMm: 74,
      rearWingAngleDeg: 8,
      speedKmh: 250,
    });

    expect(res.rakeHeightMm).toBe(24);
    expect(res.rakeAngleDeg).toBeGreaterThan(0.4);
    expect(res.rakeAngleDeg).toBeLessThan(0.6);
  });

  it("calculates realistic downforce and drag at 150 and 250 km/h", () => {
    const res = computeAeroTrim({
      frontRideHeightMm: 52,
      rearRideHeightMm: 72,
      rearWingAngleDeg: 8,
      speedKmh: 250,
    });

    // GT3 cars produce ~300-600 kgf at 150 km/h and ~800-1600 kgf at 250 km/h
    expect(res.totalDownforceKg150).toBeGreaterThan(250);
    expect(res.totalDownforceKg150).toBeLessThan(800);
    expect(res.totalDownforceKg250).toBeGreaterThan(800);
    expect(res.totalDownforceKg250).toBeLessThan(2200);

    // Aerodynamic efficiency L/D ratio for GT3 is typically between 2.0:1 and 4.5:1
    expect(res.liftToDragRatio).toBeGreaterThan(2.0);
    expect(res.liftToDragRatio).toBeLessThan(5.0);
  });

  it("calculates front/rear aero balance % correctly", () => {
    const res = computeAeroTrim({
      frontRideHeightMm: 52,
      rearRideHeightMm: 72,
      rearWingAngleDeg: 8,
      speedKmh: 250,
    });

    expect(res.frontAeroBalancePct + res.rearAeroBalancePct).toBeCloseTo(100, 1);
    expect(res.frontAeroBalancePct).toBeGreaterThan(35);
    expect(res.frontAeroBalancePct).toBeLessThan(55);
  });

  it("detects dynamic ride heights and critical front splitter stall warnings", () => {
    const safeRes = computeAeroTrim({
      frontRideHeightMm: 58,
      rearRideHeightMm: 75,
      rearWingAngleDeg: 8,
      speedKmh: 250,
    });
    expect(safeRes.dynamicFrontRideHeight250Mm).toBeGreaterThan(10);

    const bottomingRes = computeAeroTrim({
      frontRideHeightMm: 38,
      rearRideHeightMm: 65,
      rearWingAngleDeg: 14,
      speedKmh: 270,
    });
    expect(bottomingRes.dynamicFrontRideHeight250Mm).toBeLessThan(12);
    expect(bottomingRes.engineerAdvice).toContain("CRITICAL");
  });

  it("computes projected top speed variations with rear wing angle changes", () => {
    const lowWing = computeAeroTrim({
      frontRideHeightMm: 52,
      rearRideHeightMm: 70,
      rearWingAngleDeg: 2,
      speedKmh: 250,
    });

    const highWing = computeAeroTrim({
      frontRideHeightMm: 52,
      rearRideHeightMm: 70,
      rearWingAngleDeg: 14,
      speedKmh: 250,
    });

    expect(lowWing.projectedTopSpeedKmh).toBeGreaterThan(highWing.projectedTopSpeedKmh);
    expect(lowWing.totalDragKg250).toBeLessThan(highWing.totalDragKg250);
  });
});
