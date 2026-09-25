export interface TyrePreset {
  id: string;
  name: string;
  game: string;
  compound: string;
  targetHotPressure: number; // in PSI
  minHotPressure: number;
  maxHotPressure: number;
  baseTrackTemp: number; // in °C
  baseColdPressures: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
}

export const TYRE_PRESETS: TyrePreset[] = [
  {
    id: "acc_gt3_dry",
    name: "ACC — GT3 Slick (Pirelli DHE)",
    game: "Assetto Corsa Competizione",
    compound: "DHE Slick",
    targetHotPressure: 26.85,
    minHotPressure: 26.6,
    maxHotPressure: 27.0,
    baseTrackTemp: 30,
    baseColdPressures: { FL: 26.2, FR: 26.5, RL: 25.9, RR: 26.2 },
  },
  {
    id: "acc_gt3_wet",
    name: "ACC — GT3 Wet (Pirelli Rain)",
    game: "Assetto Corsa Competizione",
    compound: "Pirelli Rain",
    targetHotPressure: 30.0,
    minHotPressure: 29.5,
    maxHotPressure: 30.5,
    baseTrackTemp: 20,
    baseColdPressures: { FL: 28.5, FR: 28.8, RL: 28.2, RR: 28.5 },
  },
  {
    id: "acc_gt4_dry",
    name: "ACC — GT4 Slick",
    game: "Assetto Corsa Competizione",
    compound: "Medium Slick",
    targetHotPressure: 27.0,
    minHotPressure: 26.8,
    maxHotPressure: 27.3,
    baseTrackTemp: 30,
    baseColdPressures: { FL: 26.0, FR: 26.3, RL: 25.8, RR: 26.0 },
  },
  {
    id: "iracing_gt3",
    name: "iRacing — GT3 / IMSA Slick",
    game: "iRacing",
    compound: "Dry Michelin",
    targetHotPressure: 22.5,
    minHotPressure: 21.8,
    maxHotPressure: 23.2,
    baseTrackTemp: 32,
    baseColdPressures: { FL: 18.5, FR: 18.8, RL: 18.2, RR: 18.5 },
  },
  {
    id: "f1_dry",
    name: "F1 24 / 25 — Dry Slick (C3)",
    game: "F1 24 / 25",
    compound: "Pirelli C3",
    targetHotPressure: 23.5,
    minHotPressure: 22.5,
    maxHotPressure: 24.5,
    baseTrackTemp: 35,
    baseColdPressures: { FL: 23.5, FR: 23.5, RL: 21.5, RR: 21.5 },
  },
  {
    id: "lmu_hypercar",
    name: "Le Mans Ultimate — Hypercar / GTP",
    game: "Le Mans Ultimate",
    compound: "Medium Slick",
    targetHotPressure: 26.5,
    minHotPressure: 26.0,
    maxHotPressure: 27.0,
    baseTrackTemp: 28,
    baseColdPressures: { FL: 24.2, FR: 24.5, RL: 23.9, RR: 24.2 },
  },
];

export interface TyreCalculationInput {
  presetId: string;
  trackTemp: number; // in °C
  airTemp?: number; // in °C
  circuitDirection: "clockwise" | "counter-clockwise" | "balanced";
  trackCamberDemand?: "high" | "medium" | "low";
  currentColdPressures?: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
  observedHotPressures?: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
}

export interface TyreCalculationResult {
  preset: TyrePreset;
  targetHot: number;
  tempDeltaFromBase: number;
  recommendedCold: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
  expectedHot: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
  expectedGain: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
  circuitLoadingNotes: string;
}

/**
 * Calculates optimal cold tyre pressures based on atmospheric track temperature,
 * circuit loading asymmetry (clockwise vs counter-clockwise), and sim title targets.
 */
export function calculateCompensatedPressures(input: TyreCalculationInput): TyreCalculationResult {
  const preset = TYRE_PRESETS.find((p) => p.id === input.presetId) || TYRE_PRESETS[0];

  // If user provided empirical observed hot pressures from their previous run,
  // we calibrate directly from real telemetry delta: Delta Cold = Target Hot - Observed Hot
  if (input.currentColdPressures && input.observedHotPressures) {
    const curC = input.currentColdPressures;
    const obsH = input.observedHotPressures;
    const target = preset.targetHotPressure;

    const calcCorner = (cold: number, hot: number) => {
      const diff = target - hot;
      return +(cold + diff).toFixed(2);
    };

    const recCold = {
      FL: calcCorner(curC.FL, obsH.FL),
      FR: calcCorner(curC.FR, obsH.FR),
      RL: calcCorner(curC.RL, obsH.RL),
      RR: calcCorner(curC.RR, obsH.RR),
    };

    return {
      preset,
      targetHot: target,
      tempDeltaFromBase: input.trackTemp - preset.baseTrackTemp,
      recommendedCold: recCold,
      expectedHot: {
        FL: target,
        FR: target,
        RL: target,
        RR: target,
      },
      expectedGain: {
        FL: +(obsH.FL - curC.FL).toFixed(2),
        FR: +(obsH.FR - curC.FR).toFixed(2),
        RL: +(obsH.RL - curC.RL).toFixed(2),
        RR: +(obsH.RR - curC.RR).toFixed(2),
      },
      circuitLoadingNotes: "Calibrated directly from observed stint hot telemetry delta.",
    };
  }

  // Atmospheric thermodynamic compensation:
  // In GT3/racing slicks: ~0.10 PSI pressure shift per 1°C track temp change.
  // Higher track temp -> air inside tyre expands more -> need LOWER cold starting pressure.
  const tempDelta = input.trackTemp - preset.baseTrackTemp;
  const tempAdjustment = -(tempDelta * 0.10);

  // Circuit lateral asymmetry adjustment:
  // Clockwise circuits (e.g. Monza, Silverstone, Spa): Left tyres take more lateral load (+0.4 PSI thermal gain).
  // Counter-clockwise circuits (e.g. Interlagos, Imola): Right tyres take more lateral load.
  let asymmFL = 0;
  let asymmFR = 0;
  let asymmRL = 0;
  let asymmRR = 0;
  let circuitNotes = "";

  if (input.circuitDirection === "clockwise") {
    // Left side works harder: lower cold pressure on left so it expands to match right
    asymmFL = -0.2;
    asymmFR = +0.1;
    asymmRL = -0.2;
    asymmRR = +0.1;
    circuitNotes = "Clockwise circuit loading: Left-hand tyres (FL & RL) absorb higher lateral duty cycle. Cold pressures lowered on left to prevent hot over-inflation.";
  } else if (input.circuitDirection === "counter-clockwise") {
    asymmFL = +0.1;
    asymmFR = -0.2;
    asymmRL = +0.1;
    asymmRR = -0.2;
    circuitNotes = "Counter-clockwise circuit loading: Right-hand tyres (FR & RR) absorb higher lateral duty cycle. Cold pressures lowered on right to balance hot pressures.";
  } else {
    circuitNotes = "Balanced circuit layout: Equalized lateral loading across left and right axles.";
  }

  const base = preset.baseColdPressures;
  const roundPsi = (val: number) => +(Math.round(val * 10) / 10).toFixed(1);

  const recCold = {
    FL: +roundPsi(base.FL + tempAdjustment + asymmFL),
    FR: +roundPsi(base.FR + tempAdjustment + asymmFR),
    RL: +roundPsi(base.RL + tempAdjustment + asymmRL),
    RR: +roundPsi(base.RR + tempAdjustment + asymmRR),
  };

  // Expected pressure gain from cold to hot (typically +2.5 to +3.5 PSI under race load)
  const gainFL = +(preset.targetHotPressure - recCold.FL).toFixed(1);
  const gainFR = +(preset.targetHotPressure - recCold.FR).toFixed(1);
  const gainRL = +(preset.targetHotPressure - recCold.RL).toFixed(1);
  const gainRR = +(preset.targetHotPressure - recCold.RR).toFixed(1);

  return {
    preset,
    targetHot: preset.targetHotPressure,
    tempDeltaFromBase: tempDelta,
    recommendedCold: recCold,
    expectedHot: {
      FL: preset.targetHotPressure,
      FR: preset.targetHotPressure,
      RL: preset.targetHotPressure,
      RR: preset.targetHotPressure,
    },
    expectedGain: {
      FL: gainFL,
      FR: gainFR,
      RL: gainRL,
      RR: gainRR,
    },
    circuitLoadingNotes: circuitNotes,
  };
}
