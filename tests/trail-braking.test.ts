import { describe, it, expect } from "vitest";
import { computeTrailBrakingAnalysis } from "../src/lib/trail-braking-profiler";
import { TelemetryPoint } from "../src/types/telemetry";

describe("Trail-Braking & Deceleration Envelope Profiler", () => {
  it("handles sparse or short telemetry traces gracefully", () => {
    const res = computeTrailBrakingAnalysis([]);
    expect(res.overallTrailScore).toBeDefined();
    expect(res.brakingZones).toHaveLength(0);
    expect(res.recommendedBrakeBiasDirection).toBe("optimal");
  });

  it("detects discrete braking zones and profiles deceleration envelope", () => {
    // Generate synthetic lap with 2 distinct braking zones
    const points: TelemetryPoint[] = Array.from({ length: 400 }, (_, i) => {
      const dist = i * 15; // 6000m lap
      // Braking zone 1 at dist 300-500m
      const inZone1 = dist >= 300 && dist <= 500;
      // Braking zone 2 at dist 1800-2000m
      const inZone2 = dist >= 1800 && dist <= 2000;

      let speed = 230;
      let brake = 0;
      let steer = 0;
      let longG = 0;
      let latG = 0;

      if (inZone1) {
        // High speed heavy braking zone
        const progress = (dist - 300) / 200;
        speed = 250 - progress * 170; // 250 down to 80 km/h
        brake = progress < 0.25 ? progress * 400 : 100 * Math.exp(-progress * 2.8); // Peak then smooth exponential trail
        steer = progress > 0.4 ? (progress - 0.4) * 50 : 0; // Steering introduces during trail off
        longG = -2.2 * (brake / 100);
        latG = 1.6 * (steer / 30);
      } else if (inZone2) {
        // Linear/abrupt release braking zone
        const progress = (dist - 1800) / 200;
        speed = 210 - progress * 120;
        brake = progress < 0.2 ? progress * 450 : 90 * (1 - progress);
        steer = progress > 0.6 ? 20 : 0;
        longG = -1.8 * (brake / 100);
        latG = 1.2 * (steer / 20);
      }

      return {
        time: i * 0.3,
        dist,
        speed,
        throttle: brake > 5 ? 0 : 100,
        brake,
        steer,
        gear: speed < 90 ? 2 : 4,
        rpm: 6800,
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

    const res = computeTrailBrakingAnalysis(points, "Circuit de Spa-Francorchamps");

    expect(res.brakingZones.length).toBeGreaterThanOrEqual(1);
    const z1 = res.brakingZones[0];
    expect(z1.entrySpeedKmh).toBeGreaterThan(150);
    expect(z1.minSpeedKmh).toBeLessThan(120);
    expect(z1.peakDecelG).toBeGreaterThan(1.0);
    expect(z1.lengthMeters).toBeGreaterThan(30);
    expect(z1.releaseShape).toBeDefined();
    expect(z1.trailBrakingScore).toBeGreaterThanOrEqual(0);
    expect(z1.trailBrakingScore).toBeLessThanOrEqual(100);
  });

  it("provides mechanical brake bias recommendation based on trail braking overlap and yaw", () => {
    // Generate telemetry with front lockup tendency
    const understeerPoints: TelemetryPoint[] = Array.from({ length: 300 }, (_, i) => {
      const dist = i * 20;
      const inZone = dist >= 200 && dist <= 400;
      const progress = inZone ? (dist - 200) / 200 : 0;

      return {
        time: i * 0.4,
        dist,
        speed: inZone ? 240 - progress * 150 : 200,
        throttle: inZone ? 0 : 100,
        brake: inZone ? (progress < 0.3 ? 95 : 60) : 0, // Sustained high brake during turn-in
        steer: inZone && progress > 0.3 ? 45 : 0, // Excessive steering angle needed
        gear: 3,
        rpm: 6500,
        latG: inZone && progress > 0.3 ? 0.9 : 0.1, // Poor lateral G response (understeer)
        longG: inZone ? -1.8 : 0,
        tempFL: 92,
        tempFR: 94,
        tempRL: 84,
        tempRR: 84,
        pressFL: 28.2,
        pressFR: 28.4,
        pressRL: 26.8,
        pressRR: 26.9,
      };
    });

    const res = computeTrailBrakingAnalysis(understeerPoints, "Circuit de Spa-Francorchamps");
    expect(res.recommendedBrakeBiasDirection).toBeDefined();
    expect(res.biasRecommendationRationale).toBeDefined();
  });
});
