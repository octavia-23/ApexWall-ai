import { describe, it, expect } from "vitest";
import { computeDynamicAeroMap } from "../src/lib/aero-map-calculator";
import { TelemetryPoint } from "../src/types/telemetry";

describe("Dynamic Ride Height & Aero Map Calculator", () => {
  it("enforces aerodynamic downforce scaling with the square of speed (v^2)", () => {
    // Generate low-speed lap points (100 km/h) vs high-speed lap points (200 km/h)
    const points100: TelemetryPoint[] = Array.from({ length: 50 }, (_, i) => ({
      time: i * 0.1,
      dist: i * 15,
      speed: 100,
      throttle: 50,
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 5000,
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
    }));

    const points200: TelemetryPoint[] = Array.from({ length: 50 }, (_, i) => ({
      ...points100[i],
      speed: 200,
    }));

    const aero100 = computeDynamicAeroMap(points100, { carArchetype: "gt3" });
    const aero200 = computeDynamicAeroMap(points200, { carArchetype: "gt3" });

    // Since downforce is proportional to v^2 plus dynamic ground effect gain from ride height drop
    expect(aero200.peakDownforceKg).toBeGreaterThanOrEqual(aero100.peakDownforceKg * 3.8);
    expect(aero200.peakDownforceKg).toBeLessThanOrEqual(aero100.peakDownforceKg * 5.2);
  });

  it("calculates pitch dive and dynamic rake change under heavy braking", () => {
    // Create straightaway into heavy braking zone
    const points: TelemetryPoint[] = [
      // Cruising at 240 km/h
      ...Array.from({ length: 20 }, (_, i) => ({
        time: i * 0.1,
        dist: i * 20,
        speed: 240,
        throttle: 100,
        brake: 0,
        steer: 0,
        gear: 5,
        rpm: 7200,
        latG: 0,
        longG: 0.1,
        tempFL: 85,
        tempFR: 85,
        tempRL: 85,
        tempRR: 85,
        pressFL: 27.5,
        pressFR: 27.5,
        pressRL: 27.5,
        pressRR: 27.5,
      })),
      // Heavy Braking (-1.8 G decel)
      ...Array.from({ length: 20 }, (_, i) => ({
        time: 2.0 + i * 0.1,
        dist: 400 + i * 15,
        speed: 240 - i * 8,
        throttle: 0,
        brake: 100,
        steer: 0,
        gear: 4,
        rpm: 6000,
        latG: 0,
        longG: -1.8,
        tempFL: 88,
        tempFR: 88,
        tempRL: 83,
        tempRR: 83,
        pressFL: 27.8,
        pressFR: 27.8,
        pressRL: 27.2,
        pressRR: 27.2,
      })),
    ];

    const aero = computeDynamicAeroMap(points, { carArchetype: "gt3" });

    // Under heavy braking, front ride height dives lower than cruising
    expect(aero.minFrontRideHeightMm).toBeLessThan(aero.staticFrontRideHeightMm);
    // Rear ride height rises
    expect(aero.maxRearRideHeightMm).toBeGreaterThan(aero.staticRearRideHeightMm);
    // Rake increases significantly during braking pitch
    const maxRake = Math.max(...aero.sampledProfile.map((p) => p.dynamicRakeMm));
    expect(maxRake).toBeGreaterThan(aero.staticRakeMm);
  });

  it("accurately detects splitter grounding and issues packer recommendations", () => {
    // Telemetry points with extreme downward front deflection causing splitter scrape
    const points: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.05,
      dist: i * 12,
      speed: 260,
      throttle: 100,
      brake: 0,
      steer: 0,
      gear: 6,
      rpm: 7500,
      latG: 0,
      longG: -0.2,
      tempFL: 85,
      tempFR: 85,
      tempRL: 85,
      tempRR: 85,
      pressFL: 27.5,
      pressFR: 27.5,
      pressRL: 27.5,
      pressRR: 27.5,
      // Provide raw low ride height below 46mm threshold
      rideHeightFL: 41,
      rideHeightFR: 41,
      rideHeightRL: 70,
      rideHeightRR: 70,
    }));

    const aero = computeDynamicAeroMap(points, { carArchetype: "gt3" });

    expect(aero.groundingEvents.length).toBeGreaterThan(0);
    expect(aero.groundingEvents[0].frontRideHeightMm).toBeLessThanOrEqual(46);
    expect(aero.setupRecommendations.some((r) => r.includes("Front Splitter Packer"))).toBe(true);
  });

  it("detects porpoising when sustained high-speed vertical oscillation occurs", () => {
    // Generate 100 high-speed points (> 220 km/h) with 4 Hz vertical bounce at 50 Hz
    const points: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => {
      const t = i * 0.02; // 50 Hz sim rate
      const oscillation = Math.sin(t * 2 * Math.PI * 4.0) * 8.0; // 4 Hz, 16mm peak-to-peak
      return {
        time: t,
        dist: 1000 + i * 5,
        speed: 250,
        throttle: 100,
        brake: 0,
        steer: 0,
        gear: 6,
        rpm: 7600,
        latG: 0,
        longG: 0.05,
        tempFL: 85,
        tempFR: 85,
        tempRL: 85,
        tempRR: 85,
        pressFL: 27.5,
        pressFR: 27.5,
        pressRL: 27.5,
        pressRR: 27.5,
        rideHeightFL: 50 + oscillation,
        rideHeightFR: 50 + oscillation,
        rideHeightRL: 70 - oscillation * 0.5,
        rideHeightRR: 70 - oscillation * 0.5,
      };
    });

    const aero = computeDynamicAeroMap(points, { carArchetype: "gt3" });

    expect(aero.porpoising.isDetected).toBe(true);
    expect(aero.porpoising.peakFrequencyHz).toBeGreaterThanOrEqual(3.0);
    expect(aero.porpoising.peakFrequencyHz).toBeLessThanOrEqual(7.5);
    expect(aero.setupRecommendations.some((r) => r.includes("Porpoising Remediation"))).toBe(true);
  });

  it("handles empty telemetry without throwing errors", () => {
    const aero = computeDynamicAeroMap([]);
    expect(aero.peakDownforceKg).toBe(0);
    expect(aero.speedBins).toEqual([]);
    expect(aero.sampledProfile).toEqual([]);
    expect(aero.groundingEvents).toEqual([]);
  });
});
