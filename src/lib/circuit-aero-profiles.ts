/**
 * ============================================================================
 * APEXWALL AI // CIRCUIT AERODYNAMIC DOWNFORCE PROFILES & DRAG CALIBRATION
 * ============================================================================
 * Provides track-specific aerodynamic downforce classification, wing targets,
 * and underfloor/diffuser ground-effect strategies.
 *
 * Prevents high-drag wings on high-speed circuits (Spa, Monza, Le Mans) while
 * recovering cornering downforce through high-efficiency, non-drag floor elements
 * (diffuser expansion rake, splitter throat sealing, bumpstop packers, heave springs).
 * Correctly classifies high-speed flow circuits like Silverstone and Suzuka as
 * Medium-High downforce.
 * ============================================================================
 */

export type AeroDownforceTier = "super_low" | "low" | "medium" | "medium_high" | "high";

export interface UnderfloorAeroStrategy {
  philosophy: string;
  diffuserRakeTarget: string;       // e.g. Positive rake expansion
  frontRideHeightTarget: string;    // Front floor & splitter throat sealing
  rearRideHeightTarget: string;     // Diffuser expansion ratio
  bumpstopPackersStrategy: string;  // High-speed bumpstop packer engagement
  heaveSpringStrategy: string;      // Third/heave spring dynamic platform control
  nonDragRecoveryNote: string;      // How floor/diffuser recovers downforce without drag penalty
}

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
  underfloor: UnderfloorAeroStrategy;
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
    underfloor: {
      philosophy: "Flat low-drag floor profile. Minimizes aerodynamic frontal area and wake separation along high-speed straights.",
      diffuserRakeTarget: "Low positive rake (+8mm to +12mm pitch delta Formula, +2mm to +4mm GT3) to minimize induced frontal cross-section.",
      frontRideHeightTarget: "Moderate low clearance to prevent excessive drag accumulation.",
      rearRideHeightTarget: "Tuned flat to reduce diffuser pressure differential on 330+ km/h straights.",
      bumpstopPackersStrategy: "Standard travel with progressive damping.",
      heaveSpringStrategy: "Firm third spring to resist excessive floor bottoming under top speed air pressure.",
      nonDragRecoveryNote: "Top speed is the primary lap time generator; aerodynamic drag is minimized across both wings and floor.",
    },
    promptGuidance: `CIRCUIT AERO TRIM: SUPER LOW DOWNFORCE (Monza / Le Mans Spec).
- Long straights dominate lap time. High wings are catastrophic here due to induced drag.
- Formula: Front Wing 3-5 notches (or 10-14/50 in F1 game), Rear Wing 1-2 notches (or 8-12/50).
- GT3: Splitter 1, Rear Wing 2-3 (absolute lowest drag trim).
- Underfloor: Low positive rake (+8-12mm delta), low drag floor alignment.
- NEVER recommend medium or high wing angles on this circuit!`,
  },

  low: {
    tierName: "Low Downforce with Underfloor Recovery (Spa / Baku / Montreal Spec)",
    rationale: "High-speed straight-line efficiency with active ground-effect downforce recovery. Long full-throttle sectors (Kemmel Straight & Blanchimont at Spa, 2.2km straight at Baku) require skinny/medium-low wings to maintain top speed, while controlled diffuser rake and front throat sealing recover cornering bite through Pouhon, Stavelot, and Fagnes without drag penalty.",
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
    underfloor: {
      philosophy: "Non-drag downforce recovery via underfloor Venturi suction and rear diffuser expansion. Wings are trimmed to prevent straight-line drag, while the undertray recovers high-speed grip.",
      diffuserRakeTarget: "Controlled positive aerodynamic rake (+12mm to +16mm pitch delta Formula, +3mm to +5mm GT3) expands diffuser volume and multiplies suction without inducing flow stall or braking pitch snaps.",
      frontRideHeightTarget: "Dropped to minimum permissible clearance to accelerate air velocity into the splitter throat (Bernoulli effect).",
      rearRideHeightTarget: "Elevated diffuser height maximizes expansion ratio, generating downforce with vastly higher L/D (lift-to-drag) efficiency than wings.",
      bumpstopPackersStrategy: "Moderate front bumpstop packers (16-22mm Formula, 48-52mm GT3) arrest vertical heave displacement, locking the front floor in its peak ground-effect operating window without scraping.",
      heaveSpringStrategy: "High front heave spring rate (100-130 N/mm) supports aerodynamic download at 300+ km/h, preventing floor stall.",
      nonDragRecoveryNote: "Trimming wing flap angle eliminates 15-20 km/h of drag; positive diffuser rake and sealed front floor recover over 65% of cornering downforce for Pouhon and Blanchimont.",
    },
    promptGuidance: `CIRCUIT AERO TRIM: LOW DOWNFORCE WITH UNDERFLOOR DIFFUSER RECOVERY (Spa / Baku / Montreal Spec).
- Crucial for Spa-Francorchamps, Baku, and Montreal.
- At Spa (Kemmel Straight and Sector 3 Blanchimont), running maximum or high wing angles destroys top speed by 15-20 km/h.
- Formula: Front Wing 7-9 notches (or 20-24/50 in F1 game), Rear Wing 2-4 notches (or 16-20/50).
- GT3: Front Splitter 1, Rear Wing 4-6 (low drag trim).
- CRITICAL NON-DRAG RECOVERY: Never rely on wings alone! Recover lost downforce through the underfloor:
  * Run controlled positive aerodynamic rake (+12-16mm pitch delta Formula, never extreme >25mm).
  * Use front bumpstop packers and heave springs to arrest pitch travel and seal the splitter in ground effect.`,
  },

  medium: {
    tierName: "Medium Downforce (Balanced GP Spec)",
    rationale: "Balanced compromise between straight-line speed and high-speed cornering load. Sweeping complexes (Nürburgring Schumacher S, Barcelona Sector 1/2, Imola) require solid aerodynamic downforce with progressive diffuser expansion.",
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
    underfloor: {
      philosophy: "Harmonized aerodynamic platform balancing upper wing load and underfloor venturi flow across medium and high speeds.",
      diffuserRakeTarget: "Balanced positive rake (+14mm to +18mm pitch delta Formula, +4mm to +6mm GT3) for consistent aero balance across curb transitions.",
      frontRideHeightTarget: "Balanced front clearance allowing compliant turn-in bite without hitting bumpstops prematurely.",
      rearRideHeightTarget: "Tuned for progressive diffuser expansion over undulating asphalt.",
      bumpstopPackersStrategy: "Moderate packer engagement allowing compliance over apex curbs.",
      heaveSpringStrategy: "Balanced heave spring rate (80-100 N/mm) providing platform stability.",
      nonDragRecoveryNote: "Diffuser provides consistent platform stability in medium-speed transitions.",
    },
    promptGuidance: `CIRCUIT AERO TRIM: MEDIUM DOWNFORCE (Balanced GP Spec).
- Suited for Nürburgring GP, Barcelona Catalunya, Imola, Mugello, Interlagos.
- Formula: Front Wing 13-16 notches (or 30-35/50 in F1 game), Rear Wing 5-7 notches (or 26-30/50).
- GT3: Front Splitter 1-2, Rear Wing 7-9 notches.
- Underfloor: Balanced positive rake (+14-18mm pitch delta Formula) and progressive diffuser expansion. Never use extreme rear rake.`,
  },

  medium_high: {
    tierName: "Medium-High Downforce & High-Speed Flow (Silverstone / Suzuka / COTA Spec)",
    rationale: "High-speed aerodynamic commitment priority. Silverstone is NOT a low downforce track: Copse (290 km/h entry), the Maggotts-Becketts-Chapel complex (4.5-5.0G sustained lateral load), Stowe, and Abbey demand substantial aerodynamic downforce. Requires medium-high upper wings for immediate steering bite combined with aggressive underfloor ground-effect sealing to keep the car glued at 270+ km/h.",
    wings: {
      formulaModern: {
        frontWingNotches: 17,
        rearWingNotches: 7,
        f1GameWings: { front: 38, rear: 34 },
      },
      formulaHistoric: {
        frontWingNotches: 15,
        rearWingNotches: 7,
      },
      gt3: {
        frontSplitter: 2,
        rearWing: 9,
      },
      prototype: {
        frontNotches: 2,
        rearWing: 6,
      },
      cupGt4: {
        rearWing: 4,
      },
    },
    underfloor: {
      philosophy: "Unyielding high-speed ground-effect suction. Underfloor venturi tunnels and diffuser generate over 60% of total vehicle download with minimal drag penalty through high-speed directional changes.",
      diffuserRakeTarget: "High-efficiency ground-effect rake (+16mm to +20mm pitch delta Formula, +5mm to +7mm GT3) maximizing underfloor suction through Maggotts-Becketts without flow separation.",
      frontRideHeightTarget: "Slammed to minimum permissible clearance to lock the front splitter into continuous ground effect.",
      rearRideHeightTarget: "Tuned to sustain massive diffuser expansion without flow detachment during rapid yaw changes.",
      bumpstopPackersStrategy: "Moderate-stiff front bumpstop packers (20-25mm Formula, 49-52mm GT3) prevent the chassis from pitching forward or bottoming out in Copse, locking in constant downforce.",
      heaveSpringStrategy: "High front heave spring stiffness (120-150 N/mm) resists extreme vertical aero download at 280+ km/h.",
      nonDragRecoveryNote: "Copse and Becketts require maximum underfloor suction to sustain high apex speeds. Mechanical roll stiffness (stiff front ARB) keeps the floor edges sealed to the tarmac.",
    },
    promptGuidance: `CIRCUIT AERO TRIM: MEDIUM-HIGH DOWNFORCE & HIGH-SPEED FLOW (Silverstone / Suzuka / COTA Spec).
- CRITICAL: Silverstone, Suzuka, and COTA are NOT low downforce tracks! They require high aerodynamic grip for Copse, Maggotts-Becketts, Suzuka Esses, and COTA S-curves.
- Running low wing angles at Silverstone is catastrophic: the car will understeer and wash out through Maggotts/Becketts or require heavy throttle lifts through Copse.
- Formula: Front Wing 16-18 notches (or 36-40/50 in F1 game), Rear Wing 7-8 notches (or 32-36/50).
- GT3: Front Splitter 2, Rear Wing 9-10 notches.
- UNDERFLOOR & GROUND EFFECT MANDATE:
  * Floor and diffuser generate the majority of downforce at low drag penalty.
  * Run low front ride height + controlled rear diffuser rake (+16-20mm delta, NEVER extreme +80mm).
  * Stiff front bumpstop packers and heave springs prevent pitch travel and floor stall in Copse.
  * Stiff ARBs prevent roll that would break the underfloor vortex seal.`,
  },

  high: {
    tierName: "High Downforce (Monaco / Hungaroring / Zandvoort Spec)",
    rationale: "Maximum cornering grip priority. Straights are short, so aerodynamic drag carries almost no penalty. Teams crank on maximum wing angle of attack and high underfloor rake to maximize lateral Gs and high-speed stability.",
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
    underfloor: {
      philosophy: "Maximum total aerodynamic download. Controlled high underfloor rake combined with maximum wing angle of attack generates peak lateral grip across low and medium speed apexes.",
      diffuserRakeTarget: "Maximum stable aerodynamic rake (+18mm to +24mm pitch delta Formula, +6mm to +8mm GT3) for maximum expansion suction.",
      frontRideHeightTarget: "Dropped to minimum clearance for continuous front ground effect.",
      rearRideHeightTarget: "High rear platform maximizing diffuser expansion volume.",
      bumpstopPackersStrategy: "Packers tuned to allow curb compliance without chassis stall.",
      heaveSpringStrategy: "Firm heave platform preventing chassis pitch under heavy braking into chicanes.",
      nonDragRecoveryNote: "Both upper wings and underfloor are set to peak downforce settings because drag carries near-zero penalty on twisty tracks.",
    },
    promptGuidance: `CIRCUIT AERO TRIM: HIGH / MAXIMUM DOWNFORCE.
- Required for Monaco, Hungaroring, Singapore, Zandvoort, Brands Hatch, Laguna Seca.
- Formula: Front Wing 19-24 notches (or 42-48/50 in F1 game), Rear Wing 8-10 notches (or 40-45/50).
- GT3: Front Splitter 2-3, Rear Wing 10-12 notches (maximum downforce setting).
- Underfloor: Stable high rake (+18-24mm delta Formula, never extreme) and maximum diffuser expansion for peak mechanical/aero grip.`,
  },
};

/**
 * Resolves the aerodynamic downforce tier and wing guidelines for any track query.
 */
export function getCircuitAeroProfile(trackName: string): CircuitAeroProfile {
  const raw = (trackName || "").toLowerCase();

  // 1. Super Low Downforce (Monza / Le Mans / Daytona / Talladega)
  if (
    /(monza|lemans|le_mans|sarthe|daytona|talladega|avus|indianapolis_oval)/i.test(raw)
  ) {
    return { tier: "super_low", ...CIRCUIT_AERO_DATABASE.super_low };
  }

  // 2. Low Downforce (Spa / Baku / Red Bull Ring / Montreal / Vegas)
  // Note: Silverstone is intentionally EXCLUDED from low downforce!
  if (
    /(spa|spa_francorchamps|baku|spielberg|red_bull_ring|redbullring|montreal|gilles_villeneuve|vegas|las_vegas|interlagos_oval|bathurst|mount_panorama)/i.test(raw)
  ) {
    return { tier: "low", ...CIRCUIT_AERO_DATABASE.low };
  }

  // 3. Medium Downforce with Aero-Efficiency Priority (Sepang / Shanghai / Bahrain)
  // Two massive 900m+ straights demand low drag and top-speed efficiency,
  // but high-speed sweepers (T5-6, T7-8) demand aero platform stability without excessive rake.
  if (
    /(sepang|malaysia|kuala_lumpur|shanghai|bahrain|sakhir)/i.test(raw)
  ) {
    return {
      tier: "medium",
      ...CIRCUIT_AERO_DATABASE.medium,
      tierName: "Medium Downforce / High Aero Efficiency (Sepang / Shanghai / Bahrain Spec)",
      rationale: "Aero-efficiency compromise circuit. Two massive 900+ meter straights mandate slick top-end velocity and low-drag wing angles, while sweeping fast corners (Turns 5-6, 7-8) and heavy braking into hairpins (Turns 1, 4, 9, 15) demand a stable, controlled aerodynamic platform. Never run excessive rear rake here: high rake stalls the diffuser at high speed, creates massive straight-line drag, and causes snap oversteer under trail-braking.",
      wings: {
        ...CIRCUIT_AERO_DATABASE.medium.wings,
        formulaModern: {
          frontWingNotches: 13,
          rearWingNotches: 5,
          f1GameWings: { front: 30, rear: 26 },
        },
        gt3: {
          frontSplitter: 1,
          rearWing: 7,
        },
      },
      promptGuidance: `CIRCUIT AERO TRIM: MEDIUM DOWNFORCE / HIGH AERO EFFICIENCY (Sepang / Shanghai Spec).
- Two long 900+ meter straights require slick straight-line speed; high-speed sweepers (T5-6, T7-8) require clean aero grip.
- Formula: Front Wing 12-14 notches (or 28-32/50 in F1 game), Rear Wing 4-5 notches (or 24-28/50 in F1 game).
- GT3: Front Splitter 1, Rear Wing 6-8 notches.
- CRITICAL RAKE MANDATE: Keep aerodynamic rake controlled (+14mm to +18mm pitch delta; in AC +5-8mm front, +20-25mm rear; in F1 33-35 front, 36-39 rear).
- NEVER prescribe extreme rake: it causes violent diffuser stall, induces huge drag on the twin straights, and produces snap-spins under heavy braking into Turn 1 and Turn 15.`,
    };
  }

  // 4. Medium-High Downforce / High-Speed Flow (Silverstone / Suzuka / COTA / Losail / Road America)
  if (
    /(silverstone|copse|maggotts|becketts|suzuka|cota|americas|circuit_of_the_americas|losail|qatar|road_america)/i.test(raw)
  ) {
    return { tier: "medium_high", ...CIRCUIT_AERO_DATABASE.medium_high };
  }

  // 5. High Downforce (Monaco / Hungaroring / Singapore / Zandvoort / Brands / Laguna)
  if (
    /(monaco|monte_carlo|hungaroring|budapest|singapore|marina_bay|zandvoort|brands_hatch|brands|laguna|laguna_seca|portimao|algarve|norisring|macau|knoxville|limerock|lime_rock)/i.test(raw)
  ) {
    return { tier: "high", ...CIRCUIT_AERO_DATABASE.high };
  }

  // 6. Default: Medium Downforce (Nürburgring GP, Catalunya, Imola, Mugello, etc.)
  return { tier: "medium", ...CIRCUIT_AERO_DATABASE.medium };
}
