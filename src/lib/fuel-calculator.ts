export interface FuelCalculationInput {
  raceFormat: "time" | "laps";
  raceDurationMinutes: number; // e.g. 45 or 60 min
  raceTotalLaps?: number; // e.g. 25 laps
  lapTimeSeconds: number; // e.g. 137.48
  fuelPerLapLiters: number; // e.g. 3.35 L
  tankCapacityLiters: number; // e.g. 120 L
  hasFormationLap: boolean;
  safetyBufferLaps: number; // e.g. 1.5 laps
}

export interface PitStopPlan {
  stopNumber: number;
  lapWindowStart: number;
  lapWindowEnd: number;
  recommendedLap: number;
  fuelToAddLiters: number;
}

export interface LiftAndCoastAnalysis {
  suggestedLiftMeters: number;
  fuelSavedPerLap: number;
  newStintMaxLaps: number;
  canEliminatePitStop: boolean;
  advice: string;
}

export interface FuelCalculationResult {
  totalRaceLaps: number;
  estimatedRaceDurationFormatted: string;
  totalFuelRequiredLiters: number;
  initialFuelLoadLiters: number;
  maxLapsPerTank: number;
  numberOfPitStops: number;
  pitStops: PitStopPlan[];
  burnRatePerMinute: number;
  safetyMarginLiters: number;
  liftAndCoast: LiftAndCoastAnalysis;
}

/**
 * Helper to convert seconds into mm:ss.ms
 */
export function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, "0")}`;
}

/**
 * Calculates complete motorsport fuel and pit window strategy
 */
export function calculateFuelStrategy(input: FuelCalculationInput): FuelCalculationResult {
  const lapTime = Math.max(30, input.lapTimeSeconds);
  const fuelPerLap = Math.max(0.5, input.fuelPerLapLiters);
  const tankCapacity = Math.max(10, input.tankCapacityLiters);

  // 1. Calculate Total Race Laps
  let totalLaps = 0;
  if (input.raceFormat === "laps" && input.raceTotalLaps) {
    totalLaps = input.raceTotalLaps;
  } else {
    const raceSeconds = input.raceDurationMinutes * 60;
    // In circuit racing, you must complete the lap after timer hits 0:00
    totalLaps = Math.ceil(raceSeconds / lapTime);
  }

  // 2. Extra Formation & Buffer Fuel
  const formationFuel = input.hasFormationLap ? fuelPerLap * 0.75 : 0;
  const safetyBufferFuel = input.safetyBufferLaps * fuelPerLap;

  // 3. Stint Range (how many race laps can fit into a full tank)
  const usableTankCapacity = tankCapacity - safetyBufferFuel;
  const maxLapsPerTank = Math.max(1, Math.floor(usableTankCapacity / fuelPerLap));

  // 4. Total Fuel Required for entire event
  const totalFuelNeeded = +(totalLaps * fuelPerLap + formationFuel + safetyBufferFuel).toFixed(1);

  // 5. Pit Stop Count
  const numberOfPitStops = Math.max(0, Math.ceil(totalLaps / maxLapsPerTank) - 1);

  // 6. Generate Pit Stop Windows & Fuel to Add
  const pitStops: PitStopPlan[] = [];
  let initialFuelLoad = 0;

  if (numberOfPitStops === 0) {
    // Sprint race: Start with all fuel needed (capped at tank size)
    initialFuelLoad = Math.min(tankCapacity, totalFuelNeeded);
  } else {
    // Multi-stint race: Start with full tank
    initialFuelLoad = tankCapacity;

    const totalStints = numberOfPitStops + 1;
    const balancedLapsPerStint = Math.ceil(totalLaps / totalStints);

    let lapsCompleted = 0;
    for (let i = 1; i <= numberOfPitStops; i++) {
      const windowStart = Math.max(1, lapsCompleted + balancedLapsPerStint - 3);
      const windowEnd = Math.min(totalLaps - 1, lapsCompleted + maxLapsPerTank);
      const recommendedLap = Math.min(windowEnd, lapsCompleted + balancedLapsPerStint);

      // Remaining race laps after this stop
      const remainingLaps = totalLaps - recommendedLap;
      const fuelForRestOfRace = remainingLaps * fuelPerLap + safetyBufferFuel;
      const fuelToAdd = +(Math.min(tankCapacity, fuelForRestOfRace)).toFixed(1);

      pitStops.push({
        stopNumber: i,
        lapWindowStart: windowStart,
        lapWindowEnd: windowEnd,
        recommendedLap,
        fuelToAddLiters: fuelToAdd,
      });

      lapsCompleted = recommendedLap;
    }
  }

  // 7. Lift-and-Coast Fuel Saving Analysis
  const potentialLapsExtra = maxLapsPerTank + 1;
  const targetBurnRateToSavePitStop = usableTankCapacity / potentialLapsExtra;
  const requiredSaving = +(fuelPerLap - targetBurnRateToSavePitStop).toFixed(2);

  const canSavePit = numberOfPitStops === 1 && totalLaps <= maxLapsPerTank + 2;

  let advice = "";
  if (canSavePit) {
    advice = `Lifting 40-50m before heavy braking zones saves ~${requiredSaving}L/lap. This extends your stint by 2 laps and COMPLETELY ELIMINATES your pit stop, saving ~35s!`;
  } else if (numberOfPitStops > 0) {
    advice = `Lifting 30m before turns 1 & 5 saves ~0.15L/lap, allowing you to stretch your pit window by 1-2 laps to undercut traffic.`;
  } else {
    advice = `Sprint race: No pit stop required. Fuel load is dialed in with ${input.safetyBufferLaps} laps of safety reserve.`;
  }

  const hours = Math.floor((totalLaps * lapTime) / 3600);
  const minutes = Math.floor(((totalLaps * lapTime) % 3600) / 60);
  const estFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return {
    totalRaceLaps: totalLaps,
    estimatedRaceDurationFormatted: estFormatted,
    totalFuelRequiredLiters: totalFuelNeeded,
    initialFuelLoadLiters: +initialFuelLoad.toFixed(1),
    maxLapsPerTank,
    numberOfPitStops,
    pitStops,
    burnRatePerMinute: +((fuelPerLap / (lapTime / 60))).toFixed(2),
    safetyMarginLiters: +safetyBufferFuel.toFixed(1),
    liftAndCoast: {
      suggestedLiftMeters: canSavePit ? 50 : 30,
      fuelSavedPerLap: requiredSaving > 0 ? requiredSaving : 0.15,
      newStintMaxLaps: potentialLapsExtra,
      canEliminatePitStop: canSavePit,
      advice,
    },
  };
}
