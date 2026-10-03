export interface TyrePresetProvenance {
  sourceName: string;
  sourceType: "official_docs" | "telemetry_baseline" | "community_technical" | "sim_default";
  sourceUrl?: string;
  notes?: string;
  validatedDate?: string;
}

export interface TyrePreset {
  id: string;
  name: string;
  game: string;
  compound: string;
  targetHotPressure: number; // in PSI
  minHotPressure: number;
  maxHotPressure: number;
  baseTrackTemp: number; // in °C
  baseColdPressures?: {
    FL: number;
    FR: number;
    RL: number;
    RR: number;
  };
  provenance?: TyrePresetProvenance;
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
    provenance: {
      sourceName: "Kunos Simulazioni ACC Pirelli DHE Technical Specification",
      sourceType: "official_docs",
      notes: "Optimal hot pressure working window is 26.6 to 27.0 psi, centered at 26.85 psi.",
      validatedDate: "2024",
    },
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
    id: "ams2_gt3_slick",
    name: "AMS2 — GT3 / GTE Dry Slick",
    game: "Automobilista 2",
    compound: "Dry Slick",
    targetHotPressure: 25.4,
    minHotPressure: 24.0,
    maxHotPressure: 26.8,
    baseTrackTemp: 30,
    baseColdPressures: { FL: 21.8, FR: 22.0, RL: 21.5, RR: 21.8 },
    provenance: {
      sourceName: "Reiza Studios AMS2 V1.5/V1.6 Physics & Community Engineering Reference",
      sourceType: "community_technical",
      sourceUrl: "https://forum.reizastudios.com",
      validatedDate: "2024-2025",
      notes: "Madness Engine tyre model with dynamic carcass flex and tread contact patch. Operating hot pressure window: 24.0–26.8 psi (approx 1.65–1.85 bar). Drivers should evaluate Inner-Middle-Outer (IMO) temperature gradients to ensure uniform 75–90°C contact patch heat.",
    },
  },
  {
    id: "ams2_formula_ultimate_slick",
    name: "AMS2 — Formula Ultimate Gen2 Slick",
    game: "Automobilista 2",
    compound: "Pirelli-style Medium Slick",
    targetHotPressure: 23.5,
    minHotPressure: 22.0,
    maxHotPressure: 25.0,
    baseTrackTemp: 32,
    baseColdPressures: { FL: 20.0, FR: 20.0, RL: 18.5, RR: 18.5 },
    provenance: {
      sourceName: "Reiza Studios Open-Wheel Physics Guidelines",
      sourceType: "community_technical",
      sourceUrl: "https://forum.reizastudios.com",
      validatedDate: "2024-2025",
      notes: "High-downforce open-wheel aero loading generates rapid rear thermal and pressure buildup. Target hot window: 22.0–25.0 psi (1.52–1.72 bar). Cold rear pressure starts lower to accommodate traction expansion.",
    },
  },
  {
    id: "ams2_stockcar_slick",
    name: "AMS2 — Stock Car Brasil V8 Slick",
    game: "Automobilista 2",
    compound: "Competition Slick",
    targetHotPressure: 26.0,
    minHotPressure: 24.5,
    maxHotPressure: 27.5,
    baseTrackTemp: 30,
    baseColdPressures: { FL: 22.5, FR: 22.8, RL: 22.0, RR: 22.3 },
    provenance: {
      sourceName: "Reiza Studios Official Stock Car Brasil Data",
      sourceType: "official_docs",
      sourceUrl: "https://forum.reizastudios.com",
      validatedDate: "2024",
      notes: "Heavy touring car chassis (~1320 kg). Stiff sidewall requirements over curbs at Interlagos/Cascavel. Target hot window: 24.5–27.5 psi (1.69–1.90 bar).",
    },
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
  {
    id: "ace_semi_slick",
    name: "Assetto Corsa Evo — Semi-Slick / Sport",
    game: "Assetto Corsa Evo",
    compound: "Semi-Slick",
    targetHotPressure: 32.0,
    minHotPressure: 31.0,
    maxHotPressure: 33.0,
    baseTrackTemp: 30,
    baseColdPressures: { FL: 26.5, FR: 27.0, RL: 25.8, RR: 26.3 },
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

  // Resolve baseline cold pressures. If not explicitly declared by the preset,
  // derive from target hot pressure assuming standard ~3.5-3.8 psi thermal rise.
  const fallbackBaseCold = {
    FL: Number((preset.targetHotPressure - 3.5).toFixed(1)),
    FR: Number((preset.targetHotPressure - 3.5).toFixed(1)),
    RL: Number((preset.targetHotPressure - 3.8).toFixed(1)),
    RR: Number((preset.targetHotPressure - 3.8).toFixed(1)),
  };

  const base = {
    FL: Number.isFinite(preset.baseColdPressures?.FL) ? preset.baseColdPressures!.FL : fallbackBaseCold.FL,
    FR: Number.isFinite(preset.baseColdPressures?.FR) ? preset.baseColdPressures!.FR : fallbackBaseCold.FR,
    RL: Number.isFinite(preset.baseColdPressures?.RL) ? preset.baseColdPressures!.RL : fallbackBaseCold.RL,
    RR: Number.isFinite(preset.baseColdPressures?.RR) ? preset.baseColdPressures!.RR : fallbackBaseCold.RR,
  };

  // If user provided empirical observed hot pressures from their previous run,
  // we calibrate directly from real telemetry delta: Delta Cold = Target Hot - Observed Hot
  if (input.currentColdPressures && input.observedHotPressures) {
    const curC = input.currentColdPressures;
    const obsH = input.observedHotPressures;
    const target = preset.targetHotPressure;

    const calcCorner = (cold?: number, hot?: number, fallbackCold: number = base.FL) => {
      const validCold = typeof cold === "number" && Number.isFinite(cold) ? cold : fallbackCold;
      const validHot = typeof hot === "number" && Number.isFinite(hot) ? hot : target;
      const diff = target - validHot;
      return +(validCold + diff).toFixed(2);
    };

    const recCold = {
      FL: calcCorner(curC.FL, obsH.FL, base.FL),
      FR: calcCorner(curC.FR, obsH.FR, base.FR),
      RL: calcCorner(curC.RL, obsH.RL, base.RL),
      RR: calcCorner(curC.RR, obsH.RR, base.RR),
    };

    const calcGain = (cold?: number, hot?: number, fallbackCold: number = base.FL) => {
      const validCold = typeof cold === "number" && Number.isFinite(cold) ? cold : fallbackCold;
      const validHot = typeof hot === "number" && Number.isFinite(hot) ? hot : target;
      return +(validHot - validCold).toFixed(2);
    };

    let stintNotes = "Calibrated directly from observed stint hot telemetry delta.";
    if (preset.provenance?.notes) {
      stintNotes += ` ${preset.provenance.notes}`;
    }

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
        FL: calcGain(curC.FL, obsH.FL, base.FL),
        FR: calcGain(curC.FR, obsH.FR, base.FR),
        RL: calcGain(curC.RL, obsH.RL, base.RL),
        RR: calcGain(curC.RR, obsH.RR, base.RR),
      },
      circuitLoadingNotes: stintNotes,
    };
  }

  // Atmospheric temperature compensation:
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

  if (!preset.baseColdPressures) {
    circuitNotes += " Baseline cold pressures are derived from target hot delta; calibrate via observed stint telemetry for maximum precision.";
  }

  const roundPsi = (val: number) => +(Math.round(val * 10) / 10).toFixed(1);

  const recCold = {
    FL: +roundPsi(base.FL + tempAdjustment + asymmFL),
    FR: +roundPsi(base.FR + tempAdjustment + asymmFR),
    RL: +roundPsi(base.RL + tempAdjustment + asymmRL),
    RR: +roundPsi(base.RR + tempAdjustment + asymmRR),
  };

  // Expected pressure gain from cold to hot (typically +2.5 to +3.8 PSI under race load)
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
