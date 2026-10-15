import { describe, it, expect } from "vitest";
import { computeLapSimulation } from "../src/lib/lap-time-simulator";

describe("Closed-Loop Quasi-Static Lap Time Simulator & Setup Sensitivity Engine", () => {
  it("computes realistic lap time and velocity profile for Monza GP", () => {
    const sim = computeLapSimulation({
      trackName: "Autodromo Nazionale Monza",
    });

    // Monza lap times for GT3 vehicles: ~105s to 125s (1:45 to 2:05)
    expect(sim.lapTimeSeconds).toBeGreaterThan(95);
    expect(sim.lapTimeSeconds).toBeLessThan(135);
    expect(sim.lapTimeFormatted).toMatch(/^\d:\d{2}\.\d{3}$/);

    // Monza top speed should be ~245 - 290 km/h for GT3
    expect(sim.topSpeedKmh).toBeGreaterThan(240);
    expect(sim.topSpeedKmh).toBeLessThan(310);
    expect(sim.averageSpeedKmh).toBeGreaterThan(160);

    expect(sim.points.length).toBeGreaterThan(50);
  });

  it("enforces sector time sum invariant (S1 + S2 + S3 = Lap Time)", () => {
    const sim = computeLapSimulation({
      trackName: "Circuit de Spa-Francorchamps",
    });

    expect(sim.sectors).toHaveLength(3);
    const sectorSum = sim.sectors.reduce((acc, s) => acc + s.timeSeconds, 0);

    // Sum of sector times must match total lap time within numerical precision
    expect(sectorSum).toBeCloseTo(sim.lapTimeSeconds, 1);
  });

  it("verifies mass sensitivity invariant (lightening vehicle reduces lap time)", () => {
    const sim = computeLapSimulation({
      trackName: "Autodromo Nazionale Monza",
    });

    const massSensitivity = sim.sensitivities.find((s) => s.parameterName.includes("Fuel Burn"));
    expect(massSensitivity).toBeDefined();

    // Removing 30kg of fuel mass MUST physically decrease lap time (delta < 0)
    expect(massSensitivity!.lapTimeDeltaSeconds).toBeLessThan(0);
  });

  it("verifies aerodynamic downforce vs drag trade-off invariant", () => {
    const sim = computeLapSimulation({
      trackName: "Autodromo Nazionale Monza",
    });

    const lowDragSensitivity = sim.sensitivities.find((s) => s.parameterName.includes("Low Drag"));
    const highDownforceSensitivity = sim.sensitivities.find((s) => s.parameterName.includes("Rear Wing Trim (+2°)"));

    expect(lowDragSensitivity).toBeDefined();
    expect(highDownforceSensitivity).toBeDefined();

    // Low drag trim MUST increase straight line top speed
    expect(lowDragSensitivity!.topSpeedDeltaKmh).toBeGreaterThan(0);

    // High downforce trim (+2° wing) on a power circuit like Monza incurs drag penalty on straights
    expect(highDownforceSensitivity!.topSpeedDeltaKmh).toBeLessThan(0);
  });

  it("verifies tire friction expansion invariant (+5% rubber reduces lap time)", () => {
    const sim = computeLapSimulation({
      trackName: "Autodromo Nazionale Monza",
    });

    const tireSensitivity = sim.sensitivities.find((s) => s.parameterName.includes("Tire Friction"));
    expect(tireSensitivity).toBeDefined();

    // Increasing grip coefficient mu strictly improves cornering velocity and braking, reducing lap time
    expect(tireSensitivity!.lapTimeDeltaSeconds).toBeLessThan(-0.2);
  });
});
