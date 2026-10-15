import { describe, it, expect } from "vitest";
import {
  computeEndurancePitStrategy,
  parseLapTimeToSeconds,
  formatSecondsToLapTime,
} from "../src/lib/endurance-strategy-calculator";
import { TelemetryPoint } from "../src/types/telemetry";

describe("Endurance Pit Strategy & Tyre Degradation Calculator", () => {
  const dummyPoints: TelemetryPoint[] = Array.from({ length: 200 }, (_, i) => ({
    time: i * 0.6,
    dist: i * 35,
    speed: 120 + 100 * Math.sin(i / 10),
    throttle: i % 3 === 0 ? 100 : 70,
    brake: i % 15 === 0 ? 80 : 0,
    steer: 0,
    gear: 4,
    rpm: 7000,
    latG: 1.8 * Math.cos(i / 8),
    longG: 0,
    tempFL: 85,
    tempFR: 88,
    tempRL: 84,
    tempRR: 84,
    pressFL: 27.2,
    pressFR: 27.4,
    pressRL: 26.8,
    pressRR: 26.9,
  }));

  it("parses and formats lap times accurately", () => {
    expect(parseLapTimeToSeconds("2:18.420")).toBeCloseTo(138.42, 2);
    expect(parseLapTimeToSeconds("1:44.000")).toBeCloseTo(104.0, 2);
    expect(formatSecondsToLapTime(138.42)).toBe("2:18.420");
    expect(formatSecondsToLapTime(104.05)).toBe("1:44.050");
  });

  it("computes realistic fuel burn rates and stint windows", () => {
    const strategy = computeEndurancePitStrategy(dummyPoints, "2:18.000", {
      track: "Spa-Francorchamps",
      raceDurationMinutes: 120,
      tankCapacityLiters: 120,
    });

    expect(strategy.fuelWindow.burnRatePerLapLiters).toBeGreaterThan(2.5);
    expect(strategy.fuelWindow.burnRatePerLapLiters).toBeLessThan(5.5);
    expect(strategy.fuelWindow.maxStintLaps).toBeGreaterThan(20);
    expect(strategy.fuelWindow.maxStintLaps).toBeLessThan(45);
    expect(strategy.fuelWindow.idealPitLap).toBeLessThanOrEqual(strategy.fuelWindow.maxStintLaps);
    expect(strategy.fuelWindow.undercutLapStart).toBeLessThan(strategy.fuelWindow.idealPitLap);
  });

  it("evaluates lift-and-coast tradeoffs mathematically", () => {
    const strategy = computeEndurancePitStrategy(dummyPoints, "2:18.000", {
      track: "Spa-Francorchamps",
      raceDurationMinutes: 120,
      tankCapacityLiters: 120,
    });

    expect(strategy.liftAndCoast.fuelSavedPerLapLiters).toBeGreaterThan(0.1);
    expect(strategy.liftAndCoast.timeCostPerLapSeconds).toBeGreaterThan(0.15);
    expect(strategy.liftAndCoast.verdict).toContain("Lift");
  });

  it("generates stint forecast lap matrix with tyre degradation and fuel burnout", () => {
    const strategy = computeEndurancePitStrategy(dummyPoints, "2:18.000", {
      track: "Spa-Francorchamps",
      raceDurationMinutes: 120,
      tankCapacityLiters: 120,
    });

    expect(strategy.stintForecast.length).toBeGreaterThan(15);
    const lap1 = strategy.stintForecast[0];
    const lap15 = strategy.stintForecast[14];

    // Fuel remaining should decrease
    expect(lap15.fuelRemainingLiters).toBeLessThan(lap1.fuelRemainingLiters);
    // Tyre grip should decrease
    expect(lap15.tyreGripFrontPct).toBeLessThan(lap1.tyreGripFrontPct);
    // Core pressures should be higher after warmup
    expect(lap15.pressureFL).toBeGreaterThan(lap1.pressureFL);
  });

  it("verifies 4-corner lateral load integral asymmetry invariant (e.g. pure clockwise circuit loads left tyres)", () => {
    // Pure clockwise track: constant positive lateral acceleration (turns right, loading left tyres)
    const clockwisePoints: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.5,
      dist: i * 50,
      speed: 180,
      throttle: 80,
      brake: 0,
      steer: 25,
      gear: 4,
      rpm: 7000,
      latG: 1.8, // positive latG = right turn = loads FL and RL
      longG: 0,
      tempFL: 92,
      tempFR: 75,
      tempRL: 90,
      tempRR: 74,
      pressFL: 27.5,
      pressFR: 26.6,
      pressRL: 27.1,
      pressRR: 26.4,
    }));

    const strategy = computeEndurancePitStrategy(clockwisePoints, "1:40.000", {
      track: "Custom Clockwise Circuit",
      raceDurationMinutes: 60,
    });

    // The limiting tyre MUST be Left (FL or RL) because lateral work is concentrated on the outside
    expect(strategy.tyreDegradation.limitingTyreCorner).toMatch(/^(FL|RL)$/);
    expect(strategy.stintForecast[10].pressureFL).toBeGreaterThan(strategy.stintForecast[10].pressureFR);
  });

  it("verifies fuel mass burn rate and vehicle mass sensitivity invariant", () => {
    const highFuelPoints: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.8,
      dist: i * 50,
      speed: 200,
      throttle: 100, // 100% WOT
      brake: 0,
      steer: 0,
      gear: 5,
      rpm: 8000,
      latG: 0,
      longG: 0.5,
      tempFL: 85,
      tempFR: 85,
      tempRL: 85,
      tempRR: 85,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
    }));

    const lowFuelPoints: TelemetryPoint[] = Array.from({ length: 100 }, (_, i) => ({
      time: i * 0.8,
      dist: i * 50,
      speed: 120,
      throttle: 25, // Light cruising
      brake: 0,
      steer: 0,
      gear: 3,
      rpm: 4000,
      latG: 0,
      longG: 0.1,
      tempFL: 85,
      tempFR: 85,
      tempRL: 85,
      tempRR: 85,
      pressFL: 27,
      pressFR: 27,
      pressRL: 27,
      pressRR: 27,
    }));

    const stratHigh = computeEndurancePitStrategy(highFuelPoints, "1:50.000");
    const stratLow = computeEndurancePitStrategy(lowFuelPoints, "1:50.000");

    // Full throttle burn rate MUST strictly exceed light throttle burn rate
    expect(stratHigh.fuelWindow.burnRatePerLapLiters).toBeGreaterThan(
      stratLow.fuelWindow.burnRatePerLapLiters
    );
  });
});
