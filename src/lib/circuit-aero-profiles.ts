/**
 * ============================================================================
 * APEXWALL AI // CIRCUIT AERODYNAMIC DOWNFORCE PROFILES & DRAG CALIBRATION
 * ============================================================================
 * Provides track-specific aerodynamic downforce classification and wing targets
 * to prevent high/maximum drag wings on high-speed circuits like Spa-Francorchamps,
 * Monza, and Le Mans.
 * ============================================================================
 */

export type AeroDownforceTier = "super_low" | "low" | "medium" | "high";

export interface CircuitAeroProfile {
  tier: AeroDownforceTier;
  tierName: string;
  rationale: string;
  wings: {
    formulaModern: {
      frontWingNotches: number; // RSS / AC scale (0-25)
      rearWingNotches: number;  // RSS / AC scale (0-10)
      f1GameWings: { front: number; rear: number }; // 1-50 scale
    };
    formulaHistoric: {
      frontWingNotches: number;
      rearWingNotches: number;
    };
    gt3: {
      frontSplitter: number;    // Typically 1-2
      rearWing: number;         // Typically 1-12
    };
    prototype: {
      frontNotches: number;
      rearWing: number;
    };
    cupGt4: {
      rearWing: number;
    };
  };
  promptGuidance: string;
}

const CIRCUIT_AERO_DATABASE: Record<AeroDownforceTier, Omit<CircuitAeroProfile, "tier">> = {
  super_low: {
    tierName: "Super Low Downforce (Monza / Le Mans Spec)",
    rationale: "Extreme top speed priority. Straights make up the overwhelming majority of lap time. Minimal wing angles are run to eliminate drag and reach maximum terminal velocity.",
    wings: {
      formulaModern: {
        frontWingNotches: 4,
        rearWingNotches: 1,
        f1GameWings: { front: 12, rear: 10 },
      },
      formulaHistoric: {
        frontWingNotches: 4,
        rearWingNotches: 2,
      },
      gt3: {
        frontSplitter: 1,
        rearWing: 2,
      },
      prototype: {
        frontNotches: 1,
        rearWing: 1,
      },
      cupGt4: {
        rearWing: 1,
      },
    },
    promptGuidance: `CIRCUIT AERO TRIM: SUPER LOW DOWNFORCE (Monza / Le Mans Spec).
- Long straights dominate lap time. High wings are catastrophic here due to induced drag.
- Formula: Front Wing 3-5 notches (or 10-14/50 in F1 game), Rear Wing 1-2 notches (or 8-12/50).
- GT3: Splitter 1, Rear Wing 2-3 (absolute lowest drag trim).
- NEVER recommend medium or high wing angles on this circuit!`,
  },

  low: {
    tierName: "Low Downforce (Spa / Baku / Silverstone Spec)",
    rationale: "High-speed straight-line efficiency priority. Long full-throttle sectors (e.g. Kemmel Straight & Blanchimont at Spa, 2.2km straight at Baku) require skinny/medium-low wings to maintain top speed, while preserving just enough aero bite for medium-speed transitions.",
    wings: {
      formulaModern: {
        frontWingNotches: 8,
        rearWingNotches: 3,
        f1GameWings: { front: 22, rear: 18 },
      },
      formulaHistoric: {
        frontWingNotches: 7,
        rearWingNotches: 3,
      },
      gt3: {
        frontSplitter: 1,
        rearWing: 5,
      },
      prototype: {
        frontNotches: 1,
        rearWing: 3,
      },
      cupGt4: {
        rearWing: 2,
      },
    },
    promptGuidance: `CIRCUIT AERO TRIM: LOW DOWNFORCE (High-Speed Straight Priority).
- Crucial for Spa-Francorchamps, Baku, Silverstone, and Montreal.
- At Spa (Kemmel Straight and Sector 3 Blanchimont), running maximum or high wing angles destroys top speed by 15-20 km/h, leaving the driver defenseless against overtaking.
- Formula: Front Wing 7-9 notches (or 20-24/50 in F1 game), Rear Wing 2-4 notches (or 16-20/50).
- GT3: Front Splitter 1, Rear Wing 4-6 (low drag trim).
- STRICT RULE: Do NOT run high or maximum wing angles at Spa or similar high-speed layouts!`,
  },

  medium: {
    tierName: "Medium Downforce (Balanced GP Spec)",
    rationale: "Balanced compromise between straight-line speed and high-speed cornering load. Sweeping complexes (like Suzuka Esses, Nürburgring Schumacher S, Barcelona Sector 1/2) require substantial aerodynamic downforce without excessively penalizing straight-line performance.",
    wings: {
      formulaModern: {
        frontWingNotches: 14,
        rearWingNotches: 6,
        f1GameWings: { front: 32, rear: 28 },
      },
      formulaHistoric: {
        frontWingNotches: 12,
        rearWingNotches: 6,
      },
      gt3: {
        frontSplitter: 1,
        rearWing: 8,
      },
      prototype: {
        frontNotches: 2,
        rearWing: 5,
      },
      cupGt4: {
        rearWing: 4,
      },
    },
    promptGuidance: `CIRCUIT AERO TRIM: MEDIUM DOWNFORCE (Balanced GP Spec).
- Suited for Suzuka, Nürburgring GP, Barcelona Catalunya, COTA Austin, Imola, Mugello, Interlagos.
- Formula: Front Wing 13-16 notches (or 30-35/50 in F1 game), Rear Wing 5-7 notches (or 26-30/50).
- GT3: Front Splitter 1-2, Rear Wing 7-9 notches.`,
  },

  high: {
    tierName: "High Downforce (Monaco / Hungaroring / Zandvoort Spec)",
    rationale: "Maximum cornering grip priority. Straights are short, so aerodynamic drag carries almost no penalty. Teams crank on maximum wing angle of attack to maximize lateral Gs and high-speed stability.",
    wings: {
      formulaModern: {
        frontWingNotches: 20,
        rearWingNotches: 9,
        f1GameWings: { front: 45, rear: 42 },
      },
      formulaHistoric: {
        frontWingNotches: 18,
        rearWingNotches: 9,
      },
      gt3: {
        frontSplitter: 2,
        rearWing: 11,
      },
      prototype: {
        frontNotches: 2,
        rearWing: 8,
      },
      cupGt4: {
        rearWing: 5,
      },
    },
    promptGuidance: `CIRCUIT AERO TRIM: HIGH / MAXIMUM DOWNFORCE.
- Required for Monaco, Hungaroring, Singapore, Zandvoort, Brands Hatch, Laguna Seca.
- Formula: Front Wing 19-24 notches (or 42-48/50 in F1 game), Rear Wing 8-10 notches (or 40-45/50).
- GT3: Front Splitter 2-3, Rear Wing 10-12 notches (maximum downforce setting).`,
  },
};

/**
 * Resolves the aerodynamic downforce tier and wing guidelines for any track query.
 */
export function getCircuitAeroProfile(trackName: string): CircuitAeroProfile {
  const raw = (trackName || "").toLowerCase();

  // 1. Super Low Downforce (Monza / Le Mans / Daytona)
  if (
    /(monza|lemans|le_mans|sarthe|daytona|talladega|avus|indianapolis_oval)/i.test(raw)
  ) {
    return { tier: "super_low", ...CIRCUIT_AERO_DATABASE.super_low };
  }

  // 2. Low Downforce (Spa / Baku / Silverstone / Red Bull Ring / Montreal / Vegas)
  if (
    /(spa|spa_francorchamps|baku|silverstone|spielberg|red_bull_ring|redbullring|montreal|gilles_villeneuve|vegas|las_vegas|interlagos_oval|bathurst|mount_panorama)/i.test(raw)
  ) {
    return { tier: "low", ...CIRCUIT_AERO_DATABASE.low };
  }

  // 3. High Downforce (Monaco / Hungaroring / Singapore / Zandvoort / Brands / Laguna)
  if (
    /(monaco|monte_carlo|hungaroring|budapest|singapore|marina_bay|zandvoort|brands_hatch|brands|laguna|laguna_seca|portimao|algarve|norisring|macau|knoxville|limerock|lime_rock)/i.test(raw)
  ) {
    return { tier: "high", ...CIRCUIT_AERO_DATABASE.high };
  }

  // 4. Default: Medium Downforce (Suzuka, Nürburgring, Catalunya, COTA, Mugello, etc.)
  return { tier: "medium", ...CIRCUIT_AERO_DATABASE.medium };
}
