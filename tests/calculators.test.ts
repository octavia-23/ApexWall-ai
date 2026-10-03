import { describe, it, expect } from "vitest";
import { calculateCompensatedPressures, TYRE_PRESETS } from "@/lib/tyre-calculator";
import { calculateFuelStrategy } from "@/lib/fuel-calculator";

describe("src/lib/tyre-calculator characterization tests", () => {
  it("characterizes atmospheric calculation for clockwise circuit at baseline temp (30°C)", () => {
    // Preset: acc_gt3_dry (baseTrackTemp: 30, targetHotPressure: 26.85)
    // baseColdPressures: { FL: 26.2, FR: 26.5, RL: 25.9, RR: 26.2 }
    // trackTemp: 30 -> tempDelta = 0, tempAdjustment = 0
    // clockwise: left tyres take +0.4 lateral load gain -> cold compensated:
    // asymmFL = -0.4, asymmRL = -0.3, asymmFR = +0.2, asymmRR = +0.1
    const result = calculateCompensatedPressures({
      presetId: "acc_gt3_dry",
      trackTemp: 30,
      circuitDirection: "clockwise",
    });

    expect(result.targetHot).toBe(26.85);
    expect(result.tempDeltaFromBase).toBe(0);
    expect(result.recommendedCold).toEqual({
      FL: 26.0,
      FR: 26.6,
      RL: 25.7,
      RR: 26.3,
    });
    expect(result.expectedHot).toEqual({
      FL: 26.85,
      FR: 26.85,
      RL: 26.85,
      RR: 26.85,
    });
    expect(result.expectedGain).toEqual({
      FL: 0.9,
      FR: 0.3,
      RL: 1.2,
      RR: 0.6,
    });
  });

  it("characterizes hotter atmospheric condition (38°C) on counter-clockwise circuit", () => {
    // trackTemp: 38 -> tempDelta = +8°C -> tempAdjustment = -(8 * 0.10) = -0.80 PSI
    // counter-clockwise: right tyres take lateral load gain ->
    // asymmFL = +0.1, asymmRL = +0.1, asymmFR = -0.2, asymmRR = -0.2
    const result = calculateCompensatedPressures({
      presetId: "acc_gt3_dry",
      trackTemp: 38,
      circuitDirection: "counter-clockwise",
    });

    expect(result.targetHot).toBe(26.85);
    expect(result.tempDeltaFromBase).toBe(8);
    expect(result.recommendedCold).toEqual({
      FL: 25.5,
      FR: 25.5,
      RL: 25.2,
      RR: 25.2,
    });
    expect(result.expectedGain).toEqual({
      FL: 1.4,
      FR: 1.4,
      RL: 1.7,
      RR: 1.7,
    });
  });

  it("characterizes empirical telemetry delta calibration from observed stint", () => {
    // When currentColdPressures and observedHotPressures are provided:
    // targetHot = 26.85
    // Delta Cold = Target Hot - Observed Hot
    // recommendedCold = currentCold + (targetHot - observedHot)
    const result = calculateCompensatedPressures({
      presetId: "acc_gt3_dry",
      trackTemp: 30,
      circuitDirection: "balanced",
      currentColdPressures: { FL: 26.0, FR: 26.0, RL: 25.5, RR: 25.5 },
      observedHotPressures: { FL: 27.25, FR: 26.65, RL: 27.05, RR: 26.75 },
    });

    expect(result.targetHot).toBe(26.85);
    // FL: 26.0 + (26.85 - 27.25) = 26.0 - 0.40 = 25.6
    // FR: 26.0 + (26.85 - 26.65) = 26.0 + 0.20 = 26.2
    // RL: 25.5 + (26.85 - 27.05) = 25.5 - 0.20 = 25.3
    // RR: 25.5 + (26.85 - 26.75) = 25.5 + 0.10 = 25.6
    expect(result.recommendedCold).toEqual({
      FL: 25.6,
      FR: 26.2,
      RL: 25.3,
      RR: 25.6,
    });
    expect(result.circuitLoadingNotes).toContain("Calibrated directly from observed stint hot telemetry delta.");
  });
});

describe("src/lib/fuel-calculator characterization tests", () => {
  it("characterizes sprint race without pit stops (time format)", () => {
    // 20 min, 100s per lap -> 1200 / 100 = 12 laps
    // fuelPerLap = 3.0 L
    // formation = 0, buffer = 1.0 * 3.0 = 3.0 L
    // usableTank = 100 - 3.0 = 97 L -> maxLapsPerTank = floor(97 / 3.0) = 32 laps
    // totalFuelNeeded = 12 * 3.0 + 0 + 3.0 = 39.0 L
    // numberOfPitStops = ceil(12 / 32) - 1 = 0
    const result = calculateFuelStrategy({
      raceFormat: "time",
      raceDurationMinutes: 20,
      lapTimeSeconds: 100,
      fuelPerLapLiters: 3.0,
      tankCapacityLiters: 100,
      hasFormationLap: false,
      safetyBufferLaps: 1.0,
    });

    expect(result.totalRaceLaps).toBe(12);
    expect(result.totalFuelRequiredLiters).toBe(39.0);
    expect(result.initialFuelLoadLiters).toBe(39.0);
    expect(result.numberOfPitStops).toBe(0);
    expect(result.pitStops).toHaveLength(0);
    expect(result.safetyMarginLiters).toBe(3.0);
    expect(result.estimatedRaceDurationFormatted).toBe("20m");
  });

  it("characterizes multi-stint endurance race with pit stops", () => {
    // 120 min, 120s per lap -> 7200 / 120 = 60 laps
    // fuelPerLap = 3.5 L
    // tankCapacity = 100 L
    // hasFormationLap: true -> formationFuel = 3.5 * 0.75 = 2.625 L
    // safetyBufferLaps: 2.0 -> safetyBufferFuel = 2.0 * 3.5 = 7.0 L
    // usableTank = 100 - 7 = 93 L -> maxLapsPerTank = floor(93 / 3.5) = 26 laps
    // totalFuelNeeded = (60 * 3.5 + 2.625 + 7.0).toFixed(1) = 219.6 L
    // numberOfPitStops = ceil(60 / 26) - 1 = 3 - 1 = 2 pit stops
    const result = calculateFuelStrategy({
      raceFormat: "time",
      raceDurationMinutes: 120,
      lapTimeSeconds: 120,
      fuelPerLapLiters: 3.5,
      tankCapacityLiters: 100,
      hasFormationLap: true,
      safetyBufferLaps: 2.0,
    });

    expect(result.totalRaceLaps).toBe(60);
    expect(result.totalFuelRequiredLiters).toBe(219.6);
    expect(result.initialFuelLoadLiters).toBe(100);
    expect(result.numberOfPitStops).toBe(2);
    expect(result.pitStops).toHaveLength(2);
    expect(result.pitStops[0].recommendedLap).toBe(20);
    expect(result.pitStops[1].recommendedLap).toBe(40);
    expect(result.safetyMarginLiters).toBe(7.0);
    expect(result.estimatedRaceDurationFormatted).toBe("2h 0m");
  });

  it("characterizes fixed lap-count race", () => {
    // 30 laps, lapTime = 95s
    // fuelPerLap = 2.5 L, tank = 110 L
    // formation = true -> 2.5 * 0.75 = 1.875 L
    // safetyBuffer = 1.5 * 2.5 = 3.75 L -> safetyMarginLiters = 3.8
    // totalFuel = (30 * 2.5 + 1.875 + 3.75).toFixed(1) = (75 + 5.625).toFixed(1) = 80.6 L
    // usableTank = 110 - 3.75 = 106.25 L -> maxLapsPerTank = floor(106.25 / 2.5) = 42 laps
    // numberOfPitStops = 0
    const result = calculateFuelStrategy({
      raceFormat: "laps",
      raceTotalLaps: 30,
      raceDurationMinutes: 0,
      lapTimeSeconds: 95,
      fuelPerLapLiters: 2.5,
      tankCapacityLiters: 110,
      hasFormationLap: true,
      safetyBufferLaps: 1.5,
    });

    expect(result.totalRaceLaps).toBe(30);
    expect(result.totalFuelRequiredLiters).toBe(80.6);
    expect(result.initialFuelLoadLiters).toBe(80.6);
    expect(result.numberOfPitStops).toBe(0);
    expect(result.maxLapsPerTank).toBe(42);
    expect(result.safetyMarginLiters).toBe(3.8);
    expect(result.estimatedRaceDurationFormatted).toBe("47m");
  });
});
