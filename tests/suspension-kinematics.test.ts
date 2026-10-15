import { describe, it, expect } from "vitest";
import { computeSuspensionKinematics } from "../src/lib/suspension-kinematics-calculator";

describe("Suspension Roll Center & Camber Gain Kinematics Engine", () => {
  it("computes authentic Instant Center and Roll Center coordinates for GT3 double-wishbone", () => {
    const res = computeSuspensionKinematics({
      carArchetype: "gt3",
      lateralAccG: 1.5,
    });

    expect(res.front.staticRollCenterHeightMm).toBeGreaterThan(25);
    expect(res.front.staticRollCenterHeightMm).toBeLessThan(120);
    expect(res.rear.staticRollCenterHeightMm).toBeGreaterThan(res.front.staticRollCenterHeightMm); // Rear RC higher than Front RC

    expect(res.front.instantCenter.y).toBeLessThan(res.front.hardpoints.wheelCenter.y); // IC located inboard of wheel center for negative camber recovery
    expect(res.front.virtualSwingArmLengthMm).toBeGreaterThan(800);
    expect(res.front.virtualSwingArmLengthMm).toBeLessThan(4000);
  });

  it("verifies negative camber gain derivative invariant on bump travel", () => {
    const res = computeSuspensionKinematics({ carArchetype: "gt3" });

    // In double-wishbone racing suspensions, upward wheel bump displacement
    // MUST physically induce negative camber gain (dgamma/dz < 0)
    expect(res.front.camberGainDegPerMm).toBeLessThan(0);
    expect(res.rear.camberGainDegPerMm).toBeLessThan(0);
    expect(res.front.camberGainDegPerMm).toBeGreaterThan(-0.15); // Realistic GT3 bounds
  });

  it("verifies roll stiffness distribution and roll axis inclination invariants", () => {
    const res = computeSuspensionKinematics({
      carArchetype: "gt3",
      lateralAccG: 1.8,
      customRollStiffnessFrontNmDeg: 2000,
      customRollStiffnessRearNmDeg: 1500,
    });

    // Front + Rear roll distribution must equal 100%
    const frontPct = res.frontRollStiffnessDistributionPct;
    expect(frontPct).toBeCloseTo((2000 / 3500) * 100, 1);
    expect(res.rollStiffnessTotalNmPerDeg).toBe(3500);

    // Roll angle must be positive under positive lateral acceleration
    expect(res.rollAngleDeg).toBeGreaterThan(0);
    expect(res.rollAngleDeg).toBeLessThan(3.5);

    // Roll axis inclination must slope upward from front to rear in standard GT3 geometry
    expect(res.rollAxisInclinationAngleDeg).toBeGreaterThan(0);
  });

  it("verifies pure heave (zero roll) symmetry invariant", () => {
    const res = computeSuspensionKinematics({
      carArchetype: "gt3",
      lateralAccG: 0.0, // Zero lateral G = zero roll
      heaveMm: 15.0, // 15mm bump under aero downforce
    });

    expect(res.rollAngleDeg).toBe(0);
    // Under zero roll, outside and inside dynamic camber must be identical
    expect(res.front.dynamicCamberOutsideDeg).toBe(res.front.dynamicCamberInsideDeg);
    expect(res.rear.dynamicCamberOutsideDeg).toBe(res.rear.dynamicCamberInsideDeg);
  });

  it("verifies jacking force ratio and roll center migration under high lateral load", () => {
    const resGentle = computeSuspensionKinematics({ lateralAccG: 0.5 });
    const resHard = computeSuspensionKinematics({ lateralAccG: 2.2 });

    expect(resHard.front.rollAngleDeg).toBeGreaterThan(resGentle.front.rollAngleDeg);
    expect(resHard.front.jackingForceRatio).toBeGreaterThan(0);
    expect(resHard.front.contactPatchGripEfficiencyPct).toBeGreaterThanOrEqual(70);
    expect(resHard.front.contactPatchGripEfficiencyPct).toBeLessThanOrEqual(100);
  });
});
