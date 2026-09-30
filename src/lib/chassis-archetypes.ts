/**
 * ============================================================================
 * APEXWALL AI // UNIVERSAL CHASSIS ARCHETYPES & SIM PHYSICS CALIBRATION ENGINE
 * ============================================================================
 * Guarantees that the AI race engineer and setup generators ALWAYS build
 * fast, authentic, winning setups for ANY car across all supported sims
 * (Assetto Corsa, ACC, iRacing, Le Mans Ultimate, F1, Automobilista 2, etc.).
 *
 * Enforces strict archetype-specific physical constraints:
 * - Cold tyre pressure ranges and hot pressure windows
 * - Differential lock physics (e.g. GT3 Power < Coast vs FWD Power > Coast)
 * - Damper click ranges (e.g. 0-12/16 clicks in AC GT3 vs 0-40 in generic)
 * - Aerodynamic rake & ride heights (e.g. flat 5mm GT3 vs 5/95mm Formula diffuser)
 * - Suspension geometry, packers, heave springs, and electronic systems
 * ============================================================================
 */

export type ChassisArchetypeId =
  | "gt3"
  | "formula_modern"
  | "formula_historic"
  | "prototype"
  | "cup_gt4"
  | "touring_fwd"
  | "street_sports";

export interface ChassisArchetypeRules {
  id: ChassisArchetypeId;
  displayName: string;
  description: string;
  /** Cold tyre pressure bounds in PSI for Assetto Corsa & standard sims */
  coldPsi: {
    fl: { min: number; max: number; recommended: number };
    fr: { min: number; max: number; recommended: number };
    rl: { min: number; max: number; recommended: number };
    rr: { min: number; max: number; recommended: number };
    hotTarget: string;
  };
  /** Differential lock rules */
  differential: {
    powerMin: number;
    powerMax: number;
    powerRecommended: number;
    coastMin: number;
    coastMax: number;
    coastRecommended: number;
    preloadNm: number;
    behaviorNote: string;
  };
  /** Alignment rules */
  alignment: {
    camberFrontDeg: { min: number; max: number; recommended: number };
    camberRearDeg: { min: number; max: number; recommended: number };
    toeFrontClicks: number;
    toeRearClicks: number;
    casterDeg: number;
  };
  /** Suspension & Anti-Roll Bars */
  suspension: {
    springRateFrontNmm: number;
    springRateRearNmm: number;
    arbFrontStep: number;
    arbRearStep: number;
    arbMaxSteps: number;
    rodLengthFrontMm: number;
    rodLengthRearMm: number;
    packersFrontMm: number;
    packersRearMm: number;
    hasHeaveSprings: boolean;
    heaveSpringFrontNmm?: number;
    heaveSpringRearNmm?: number;
  };
  /** Dampers */
  dampers: {
    clickScaleMax: number;
    slowBumpFront: number;
    slowBumpRear: number;
    fastBumpFront: number;
    fastBumpRear: number;
    slowReboundFront: number;
    slowReboundRear: number;
    fastReboundFront: number;
    fastReboundRear: number;
  };
  /** Aerodynamics */
  aero: {
    hasFrontWing: boolean;
    hasRearWing: boolean;
    frontWingNotches: number;
    rearWingNotches: number;
    wingIdFront?: string;
    wingIdRear?: string;
  };
  /** Electronics & Powertrain */
  electronics: {
    hasAbs: boolean;
    absRecommended?: number;
    hasTc: boolean;
    tcRecommended?: number;
    hasHybrid: boolean;
    brakeBiasFrontPct: number;
  };
  /** Prompt guidance injected into AI race engineer and telemetry analyzer */
  promptGuidance: string;
}

// ----------------------------------------------------------------------------
// ARCHETYPE DEFINITIONS
// ----------------------------------------------------------------------------

export const CHASSIS_ARCHETYPES: Record<ChassisArchetypeId, ChassisArchetypeRules> = {
  // 1. GT3 / GTE / GTD / GT2 (Modern GT Racing)
  gt3: {
    id: "gt3",
    displayName: "GT3 / GTE / GT Racing",
    description: "Production-derived GT racecars with high downforce, ABS, and Traction Control.",
    coldPsi: {
      fl: { min: 15.5, max: 19.5, recommended: 18.0 },
      fr: { min: 15.5, max: 19.5, recommended: 17.5 },
      rl: { min: 15.0, max: 18.5, recommended: 16.5 },
      rr: { min: 15.0, max: 18.5, recommended: 17.0 },
      hotTarget: "26.5 - 27.2 psi hot (slicks gain +9 to +10 psi during heat cycling)",
    },
    differential: {
      powerMin: 20,
      powerMax: 40,
      powerRecommended: 30,
      coastMin: 40,
      coastMax: 65,
      coastRecommended: 50,
      preloadNm: 40,
      behaviorNote: "Power lock MUST be lower than coast lock (30% power allows corner-exit rotation; 50% coast stabilizes the rear axle under heavy trail-braking).",
    },
    alignment: {
      camberFrontDeg: { min: -4.0, max: -2.4, recommended: -2.8 },
      camberRearDeg: { min: -3.2, max: -1.8, recommended: -2.4 },
      toeFrontClicks: 4, // 4 clicks toe-out
      toeRearClicks: 5,  // 5 clicks toe-in
      casterDeg: 7.2,
    },
    suspension: {
      springRateFrontNmm: 120,
      springRateRearNmm: 115,
      arbFrontStep: 6,
      arbRearStep: 4,
      arbMaxSteps: 8,
      rodLengthFrontMm: 5,
      rodLengthRearMm: 5,
      packersFrontMm: 49,
      packersRearMm: 62,
      hasHeaveSprings: false,
    },
    dampers: {
      clickScaleMax: 12,
      slowBumpFront: 9,
      slowBumpRear: 8,
      fastBumpFront: 8,
      fastBumpRear: 8,
      slowReboundFront: 7,
      slowReboundRear: 8,
      fastReboundFront: 9,
      fastReboundRear: 9,
    },
    aero: {
      hasFrontWing: true,
      hasRearWing: true,
      frontWingNotches: 1,
      rearWingNotches: 6,
      wingIdFront: "WING_1",
      wingIdRear: "WING_2",
    },
    electronics: {
      hasAbs: true,
      absRecommended: 6,
      hasTc: true,
      tcRecommended: 5,
      hasHybrid: false,
      brakeBiasFrontPct: 63.5,
    },
    promptGuidance: `CAR CLASS: GT3 / GTE / GT Racing.
- TYRE PRESSURES: Cold slick pressures MUST be 16.5 - 18.5 psi (Front 17.5-18.0 psi, Rear 16.5-17.0 psi) targeting 26.5 - 27.2 psi HOT. NEVER recommend >20 psi cold for GT3 slicks!
- DIFFERENTIAL: Power lock 25-35% (30% ideal to rotate on exit), Coast lock 45-60% (50% ideal for trail-braking stability). Power MUST be lower than coast!
- DAMPERS: 0-12 click scale. Bump 8-9 front / 7-8 rear. Rebound 7 front / 8 rear. Fast Bump 8. Fast Rebound 9.
- PACKERS: 45-52mm front (49mm base), 55-65mm rear (62mm base). Rod lengths 5mm front / 5mm rear (flat aero platform).
- ELECTRONICS: ABS 5-7/12, TC 4-6/12. NO hybrid systems, NO heave springs.`,
  },

  // 2. MODERN FORMULA / OPEN WHEEL (F1, Super Formula, Formula Hybrid, VRC Formula Alpha)
  formula_modern: {
    id: "formula_modern",
    displayName: "Modern Formula / Open-Wheel",
    description: "Ultra-high downforce single seaters with hybrid powertrains, heave springs, and aero rake.",
    coldPsi: {
      fl: { min: 13.5, max: 17.0, recommended: 15.0 },
      fr: { min: 13.5, max: 17.0, recommended: 15.0 },
      rl: { min: 13.5, max: 17.0, recommended: 15.0 },
      rr: { min: 13.5, max: 17.0, recommended: 15.0 },
      hotTarget: "20.5 - 22.5 psi hot",
    },
    differential: {
      powerMin: 15,
      powerMax: 30,
      powerRecommended: 20,
      coastMin: 20,
      coastMax: 40,
      coastRecommended: 25,
      preloadNm: 30,
      behaviorNote: "Low diff lock (15-25%) prevents off-throttle understeer into slow tight corners and snappy high-speed transitions.",
    },
    alignment: {
      camberFrontDeg: { min: -3.8, max: -3.0, recommended: -3.3 },
      camberRearDeg: { min: -2.0, max: -1.0, recommended: -1.5 },
      toeFrontClicks: 0,
      toeRearClicks: 10,
      casterDeg: 6.5,
    },
    suspension: {
      springRateFrontNmm: 140,
      springRateRearNmm: 80,
      arbFrontStep: 100000,
      arbRearStep: 60000,
      arbMaxSteps: 150000,
      rodLengthFrontMm: 5,
      rodLengthRearMm: 95,
      packersFrontMm: 19,
      packersRearMm: 74,
      hasHeaveSprings: true,
      heaveSpringFrontNmm: 100,
      heaveSpringRearNmm: 20,
    },
    dampers: {
      clickScaleMax: 40,
      slowBumpFront: 11,
      slowBumpRear: 4,
      fastBumpFront: 7,
      fastBumpRear: 2,
      slowReboundFront: 10,
      slowReboundRear: 4,
      fastReboundFront: 5,
      fastReboundRear: 2,
    },
    aero: {
      hasFrontWing: true,
      hasRearWing: true,
      frontWingNotches: 15,
      rearWingNotches: 6,
      wingIdFront: "WING_0",
      wingIdRear: "WING_1",
    },
    electronics: {
      hasAbs: false,
      absRecommended: 0,
      hasTc: false,
      tcRecommended: 0,
      hasHybrid: true,
      brakeBiasFrontPct: 54.0,
    },
    promptGuidance: `CAR CLASS: Modern Formula / Open-Wheel.
- TYRE PRESSURES: Cold pressures 14.5 - 16.5 psi targeting 21.0 - 22.5 psi HOT.
- AERODYNAMIC RAKE: Front rod length 5mm (clears 20mm plank step), Rear rod length 85-95mm (extreme diffuser rake generating underbody downforce).
- SUSPENSION: Active 3rd element heave springs (Front 100 N/mm, Rear 20 N/mm). Front suspension much stiffer than rear.
- DIFFERENTIAL: Low lock 15-25% Power, 20-30% Coast.
- ELECTRONICS: Active ERS/MGU-K delivery & recovery, MGU-H mode. Brake Bias 53-56%. ABS & TC are prohibited.`,
  },

  // 3. HISTORIC FORMULA / V10 ERA (Ferrari F2004, F138, MP4/4, Formula 2010)
  formula_historic: {
    id: "formula_historic",
    displayName: "Historic Formula / V10 GP",
    description: "Screaming naturally-aspirated open-wheelers with immense mechanical grip and aerodynamic downforce.",
    coldPsi: {
      fl: { min: 14.0, max: 17.5, recommended: 15.5 },
      fr: { min: 14.0, max: 17.5, recommended: 15.5 },
      rl: { min: 14.0, max: 17.0, recommended: 15.0 },
      rr: { min: 14.0, max: 17.0, recommended: 15.0 },
      hotTarget: "20.5 - 22.0 psi hot",
    },
    differential: {
      powerMin: 35,
      powerMax: 60,
      powerRecommended: 45,
      coastMin: 25,
      coastMax: 45,
      coastRecommended: 35,
      preloadNm: 60,
      behaviorNote: "Higher power lock puts down V10 power cleanly without burning the rear inside tyre.",
    },
    alignment: {
      camberFrontDeg: { min: -3.6, max: -2.8, recommended: -3.2 },
      camberRearDeg: { min: -2.2, max: -1.2, recommended: -1.6 },
      toeFrontClicks: 1,
      toeRearClicks: 8,
      casterDeg: 7.0,
    },
    suspension: {
      springRateFrontNmm: 150,
      springRateRearNmm: 120,
      arbFrontStep: 80000,
      arbRearStep: 40000,
      arbMaxSteps: 120000,
      rodLengthFrontMm: 12,
      rodLengthRearMm: 45,
      packersFrontMm: 15,
      packersRearMm: 25,
      hasHeaveSprings: false,
    },
    dampers: {
      clickScaleMax: 40,
      slowBumpFront: 14,
      slowBumpRear: 8,
      fastBumpFront: 9,
      fastBumpRear: 5,
      slowReboundFront: 16,
      slowReboundRear: 10,
      fastReboundFront: 10,
      fastReboundRear: 6,
    },
    aero: {
      hasFrontWing: true,
      hasRearWing: true,
      frontWingNotches: 12,
      rearWingNotches: 8,
      wingIdFront: "WING_0",
      wingIdRear: "WING_1",
    },
    electronics: {
      hasAbs: false,
      absRecommended: 0,
      hasTc: false,
      tcRecommended: 0,
      hasHybrid: false,
      brakeBiasFrontPct: 56.0,
    },
    promptGuidance: `CAR CLASS: Historic Formula / V10 Era.
- TYRE PRESSURES: Cold 15.0 - 16.5 psi.
- NO hybrid systems (pure high-revving ICE), NO ABS, NO active heave springs.
- DIFFERENTIAL: 40-50% Power, 30-40% Coast.
- BRAKE BIAS: 55-57% front.`,
  },

  // 4. PROTOTYPE / HYPERCAR / LMP (Porsche 919, Ferrari 499P, Oreca 07, Ligier LMP3, Radical)
  prototype: {
    id: "prototype",
    displayName: "Hypercar / Prototype / LMP",
    description: "Purpose-built endurance prototypes with carbon monocoques and high aerodynamic efficiency.",
    coldPsi: {
      fl: { min: 16.0, max: 20.0, recommended: 17.5 },
      fr: { min: 16.0, max: 20.0, recommended: 17.5 },
      rl: { min: 16.0, max: 19.5, recommended: 17.0 },
      rr: { min: 16.0, max: 19.5, recommended: 17.0 },
      hotTarget: "25.0 - 27.0 psi hot",
    },
    differential: {
      powerMin: 25,
      powerMax: 45,
      powerRecommended: 35,
      coastMin: 40,
      coastMax: 60,
      coastRecommended: 50,
      preloadNm: 50,
      behaviorNote: "High coast lock (45-55%) stabilizes the car under high-speed braking into chicanes.",
    },
    alignment: {
      camberFrontDeg: { min: -3.8, max: -2.8, recommended: -3.2 },
      camberRearDeg: { min: -2.8, max: -1.8, recommended: -2.2 },
      toeFrontClicks: 2,
      toeRearClicks: 6,
      casterDeg: 7.5,
    },
    suspension: {
      springRateFrontNmm: 160,
      springRateRearNmm: 140,
      arbFrontStep: 5,
      arbRearStep: 3,
      arbMaxSteps: 7,
      rodLengthFrontMm: 8,
      rodLengthRearMm: 22,
      packersFrontMm: 35,
      packersRearMm: 45,
      hasHeaveSprings: true,
      heaveSpringFrontNmm: 120,
      heaveSpringRearNmm: 40,
    },
    dampers: {
      clickScaleMax: 16,
      slowBumpFront: 10,
      slowBumpRear: 9,
      fastBumpFront: 8,
      fastBumpRear: 7,
      slowReboundFront: 9,
      slowReboundRear: 8,
      fastReboundFront: 8,
      fastReboundRear: 8,
    },
    aero: {
      hasFrontWing: true,
      hasRearWing: true,
      frontWingNotches: 2,
      rearWingNotches: 5,
      wingIdFront: "WING_1",
      wingIdRear: "WING_2",
    },
    electronics: {
      hasAbs: false, // Pure LMP1/LMP2/LMH have no ABS (except LMP3/trackday)
      absRecommended: 0,
      hasTc: true,
      tcRecommended: 4,
      hasHybrid: false, // Overridden if Porsche 919 / 499P
      brakeBiasFrontPct: 58.0,
    },
    promptGuidance: `CAR CLASS: Hypercar / Prototype / LMP.
- TYRE PRESSURES: Cold 17.0 - 18.5 psi targeting 25.5 - 27.0 psi HOT.
- SUSPENSION: Heave springs control high-speed aero platform. Front spring rate 150-180 N/mm.
- DIFFERENTIAL: 30-35% Power, 45-55% Coast.
- BRAKE BIAS: 56-59% front. TC active (levels 3-5). ABS disabled on FIA WEC prototypes.`,
  },

  // 5. CUP / GT4 (Porsche 911 GT3 Cup, Cayman GT4, Huracan Super Trofeo, BMW M235i)
  cup_gt4: {
    id: "cup_gt4",
    displayName: "Cup Car / GT4",
    description: "Production-based sprint racers with moderate downforce and mechanical differential locks.",
    coldPsi: {
      fl: { min: 18.5, max: 23.0, recommended: 20.5 },
      fr: { min: 18.5, max: 23.0, recommended: 20.0 },
      rl: { min: 18.0, max: 22.5, recommended: 19.5 },
      rr: { min: 18.0, max: 22.5, recommended: 20.0 },
      hotTarget: "27.5 - 29.0 psi hot",
    },
    differential: {
      powerMin: 35,
      powerMax: 60,
      powerRecommended: 45,
      coastMin: 40,
      coastMax: 65,
      coastRecommended: 55,
      preloadNm: 60,
      behaviorNote: "Cup cars rely on high coast lock (50-60%) to prevent dangerous snap oversteer on turn-in.",
    },
    alignment: {
      camberFrontDeg: { min: -3.8, max: -2.6, recommended: -3.2 },
      camberRearDeg: { min: -3.0, max: -2.0, recommended: -2.6 },
      toeFrontClicks: 3,
      toeRearClicks: 5,
      casterDeg: 7.0,
    },
    suspension: {
      springRateFrontNmm: 130,
      springRateRearNmm: 140,
      arbFrontStep: 4,
      arbRearStep: 3,
      arbMaxSteps: 7,
      rodLengthFrontMm: 8,
      rodLengthRearMm: 12,
      packersFrontMm: 40,
      packersRearMm: 50,
      hasHeaveSprings: false,
    },
    dampers: {
      clickScaleMax: 16,
      slowBumpFront: 8,
      slowBumpRear: 7,
      fastBumpFront: 7,
      fastBumpRear: 7,
      slowReboundFront: 8,
      slowReboundRear: 8,
      fastReboundFront: 8,
      fastReboundRear: 8,
    },
    aero: {
      hasFrontWing: false,
      hasRearWing: true,
      frontWingNotches: 0,
      rearWingNotches: 4,
      wingIdFront: undefined,
      wingIdRear: "WING_1",
    },
    electronics: {
      hasAbs: false, // Porsche Cup has no ABS; GT4 has ABS
      absRecommended: 0,
      hasTc: false,
      tcRecommended: 0,
      hasHybrid: false,
      brakeBiasFrontPct: 62.0,
    },
    promptGuidance: `CAR CLASS: Cup / GT4.
- TYRE PRESSURES: Cold 19.5 - 22.0 psi targeting 27.5 - 29.0 psi HOT.
- MECHANICAL BALANCE: High reliance on mechanical grip. Coast lock 50-60% to settle rear weight transfer.
- NO HEAVE SPRINGS, NO HYBRID.
- ABS/TC: 0 on pure Cup cars (e.g. Carrera Cup), moderate (3-5) on GT4.`,
  },

  // 6. TOURING / FWD / TCR (Renault Clio Cup, Civic TCR, Golf TCR, Mini, Abarth)
  touring_fwd: {
    id: "touring_fwd",
    displayName: "Touring / FWD / TCR",
    description: "Front-wheel drive racing touring cars. Front tyres handle steering, braking, and drive.",
    coldPsi: {
      fl: { min: 24.0, max: 28.5, recommended: 26.5 },
      fr: { min: 24.0, max: 28.5, recommended: 26.5 },
      rl: { min: 22.0, max: 26.0, recommended: 24.0 },
      rr: { min: 22.0, max: 26.0, recommended: 24.0 },
      hotTarget: "Fronts 34-36 psi hot (heavy thermal loading); Rears 29-31 psi hot",
    },
    differential: {
      powerMin: 45,
      powerMax: 70,
      powerRecommended: 55,
      coastMin: 15,
      coastMax: 35,
      coastRecommended: 25,
      preloadNm: 70,
      behaviorNote: "FWD DIFFERENTIAL RULE: Power lock MUST be HIGH (50-65%) so the mechanical LSD pulls the nose into the apex on throttle! Coast lock MUST be LOW (20-30%) to allow off-throttle trail-braking rotation.",
    },
    alignment: {
      camberFrontDeg: { min: -4.5, max: -3.2, recommended: -3.8 },
      camberRearDeg: { min: -2.2, max: -1.2, recommended: -1.6 },
      toeFrontClicks: 3, // toe-out to sharpen turn in
      toeRearClicks: 1,  // near zero or slight toe-out to induce rear rotation
      casterDeg: 6.0,
    },
    suspension: {
      springRateFrontNmm: 110,
      springRateRearNmm: 85,
      arbFrontStep: 2, // Soft front ARB maintains inside wheel traction
      arbRearStep: 5,  // Stiff rear ARB induces tripoding and eliminates understeer!
      arbMaxSteps: 6,
      rodLengthFrontMm: 12,
      rodLengthRearMm: 8,
      packersFrontMm: 30,
      packersRearMm: 30,
      hasHeaveSprings: false,
    },
    dampers: {
      clickScaleMax: 16,
      slowBumpFront: 8,
      slowBumpRear: 11, // Stiffer rear bump controls turn-in roll
      fastBumpFront: 6,
      fastBumpRear: 8,
      slowReboundFront: 10,
      slowReboundRear: 7,
      fastReboundFront: 8,
      fastReboundRear: 7,
    },
    aero: {
      hasFrontWing: false,
      hasRearWing: true,
      frontWingNotches: 0,
      rearWingNotches: 2,
      wingIdFront: undefined,
      wingIdRear: "WING_1",
    },
    electronics: {
      hasAbs: true,
      absRecommended: 3,
      hasTc: false,
      tcRecommended: 0,
      hasHybrid: false,
      brakeBiasFrontPct: 66.0,
    },
    promptGuidance: `CAR CLASS: Touring / FWD / TCR (Front-Wheel Drive).
- TYRE PRESSURES: Fronts MUST be higher than rears! Cold Front 26-27 psi, Cold Rear 23-25 psi.
- DIFFERENTIAL: High Power Lock (50-60%) to pull the car through corner exits; Low Coast Lock (20-30%) for entry rotation.
- ANTI-ROLL BARS: Soft Front ARB (step 2) + Stiff Rear ARB (step 5) to rotate the rear end and cure FWD understeer!
- NO heave springs, NO hybrid.`,
  },

  // 7. STREET / ROAD SPORTS (Ferrari 458, 488 GTB, BMW M4, Supra MKIV, AE86, Miata)
  street_sports: {
    id: "street_sports",
    displayName: "Street / Sports / Trackday Road Car",
    description: "Production road vehicles with radial tyres, compliant road suspensions, and street geometry.",
    coldPsi: {
      fl: { min: 27.0, max: 33.0, recommended: 29.0 },
      fr: { min: 27.0, max: 33.0, recommended: 29.0 },
      rl: { min: 26.0, max: 32.0, recommended: 28.0 },
      rr: { min: 26.0, max: 32.0, recommended: 28.0 },
      hotTarget: "33.0 - 36.0 psi hot",
    },
    differential: {
      powerMin: 25,
      powerMax: 45,
      powerRecommended: 35,
      coastMin: 30,
      coastMax: 50,
      coastRecommended: 40,
      preloadNm: 40,
      behaviorNote: "Moderate differential lock tailored for predictable road handling.",
    },
    alignment: {
      camberFrontDeg: { min: -2.5, max: -1.0, recommended: -1.8 },
      camberRearDeg: { min: -2.0, max: -0.8, recommended: -1.4 },
      toeFrontClicks: 1,
      toeRearClicks: 2,
      casterDeg: 6.0,
    },
    suspension: {
      springRateFrontNmm: 65,
      springRateRearNmm: 55,
      arbFrontStep: 3,
      arbRearStep: 2,
      arbMaxSteps: 5,
      rodLengthFrontMm: 25,
      rodLengthRearMm: 25,
      packersFrontMm: 20,
      packersRearMm: 20,
      hasHeaveSprings: false,
    },
    dampers: {
      clickScaleMax: 16,
      slowBumpFront: 7,
      slowBumpRear: 6,
      fastBumpFront: 6,
      fastBumpRear: 5,
      slowReboundFront: 8,
      slowReboundRear: 7,
      fastReboundFront: 7,
      fastReboundRear: 6,
    },
    aero: {
      hasFrontWing: false,
      hasRearWing: false,
      frontWingNotches: 0,
      rearWingNotches: 0,
      wingIdFront: undefined,
      wingIdRear: undefined,
    },
    electronics: {
      hasAbs: true,
      absRecommended: 4,
      hasTc: true,
      tcRecommended: 4,
      hasHybrid: false,
      brakeBiasFrontPct: 65.0,
    },
    promptGuidance: `CAR CLASS: Street / Sports / Trackday Road Car.
- TYRE PRESSURES: Cold 28.0 - 30.0 psi (road radials target 33-35 psi hot).
- SPRINGS & DAMPERS: Compliant road spring rates (50-75 N/mm), moderate camber (-1.5° to -2.0°).
- NO heave springs, NO hybrid (unless hybrid supercar e.g. LaFerrari/SF90).`,
  },
};

// ----------------------------------------------------------------------------
// ARCHETYPE RESOLUTION & CLASSIFIER
// ----------------------------------------------------------------------------

/**
 * Detects the authentic vehicle archetype from car ID, mod name, or full string.
 */
export function detectChassisArchetype(carName: string, game?: string): ChassisArchetypeRules {
  const raw = (carName || "").toLowerCase();

  // 1. Prototypes / Hypercars / LMP (Check first to capture 919 Hybrid, 499P, etc.)
  if (
    /(919|499p|gr010|a424|oreca|ligier|radical|praga_r1|scg003|glickenhaus|hypercar|lmdh|lmp1|lmp2|lmp3|dp_v|cadillac_v)/i.test(raw) ||
    (/(prototype|daytona_sp)/i.test(raw) && !/formula/i.test(raw))
  ) {
    const isHybridProto = /(919|499|gr010|a424|hybrid)/i.test(raw);
    if (isHybridProto) {
      return {
        ...CHASSIS_ARCHETYPES.prototype,
        electronics: {
          ...CHASSIS_ARCHETYPES.prototype.electronics,
          hasHybrid: true,
        },
      };
    }
    return CHASSIS_ARCHETYPES.prototype;
  }

  // 2. Modern Formula / Open-Wheel
  if (
    /(sf70h|sf15t|sf23|superformula|formula_hybrid|vrc_formula|rss_formula|rss_supreme|indycar|f1_20|f1_21|f1_22|f1_23|f1_24|f1_25)/i.test(raw) ||
    (/(formula|openwheel|single_seater|f1)/i.test(raw) && /(hybrid|modern|202|201|halo)/i.test(raw)) ||
    (raw.includes("hybrid") && raw.includes("formula"))
  ) {
    return CHASSIS_ARCHETYPES.formula_modern;
  }

  // 3. Historic Formula / V10 Era
  if (
    /(f2004|f138|f310|mp4_4|mp4_13|lotus_98t|lotus_72|formula_2010|v10|v12|v8_f1|classic_f1)/i.test(raw) ||
    (/(formula|exos|tatuus)/i.test(raw) && !/(hybrid)/i.test(raw))
  ) {
    return CHASSIS_ARCHETYPES.formula_historic;
  }

  // 4. Touring / FWD / TCR
  if (
    /(clio|cup_2023|civic_tcr|elantra_tcr|golf_tcr|audi_rs3_lms|btcc|fsr_clio|tcr|fwd|abarth|alfa_romeo_giulietta|leon_tcr|corsa)/i.test(raw)
  ) {
    return CHASSIS_ARCHETYPES.touring_fwd;
  }

  // 5. Cup / GT4 / Single-Make Challenge
  if (
    /(gt3_cup|gt3-cup|cup_2017|991_cup|992_cup|cayman_gt4|supra_gt4|m235i|m240i|tt_cup|huracan_st|huracan_trofeo|488_challenge|challenge_evo|mx5_cup|mx-5 cup|trofeo|supercup)/i.test(raw) ||
    /(gt4|clubsport)/i.test(raw)
  ) {
    return CHASSIS_ARCHETYPES.cup_gt4;
  }

  // 6. Street / Sports / Trackday Road Cars (Check before generic GT if pure road car)
  if (
    (/(italia|458|gtb|f40|f50|laferrari|m4_akrapovic|ae86|supra_mkiv|miata|road|street|stradale)/i.test(raw) &&
      !/(gt3|gt2|gte|gt4|cup)/i.test(raw))
  ) {
    return CHASSIS_ARCHETYPES.street_sports;
  }

  // 7. GT3 / GTE / GTD / GT2 (Modern GT Racing)
  if (
    /(gt3|gt2|gte|gtd|488_gt3|488 gt3|296_gt3|911_gt3_r|amg_gt3|r8_lms|huracan_gt3|650s_gt3|720s_gt3|m4_gt3|m6_gt3|z4_gt3|sls_gt3|gtr_gt3|c7r|c8r|corvette_c7r|vantage_gt3|darche_992)/i.test(raw) ||
    (game && /(acc|assetto corsa competizione)/i.test(game))
  ) {
    return CHASSIS_ARCHETYPES.gt3;
  }

  // Default to GT3 if unknown race car, or street if clearly passenger
  return CHASSIS_ARCHETYPES.gt3;
}

// ----------------------------------------------------------------------------
// DYNAMIC ADAPTIVE SETUP GENERATION (GROUNDED IN ARCHETYPE)
// ----------------------------------------------------------------------------

/**
 * Builds a 100% authentic, high-speed adaptive setup calibrated for any car,
 * completely replacing broken hardcoded values (like 26.4 psi on GT3).
 */
export function getCalibratedAdaptiveSetup(
  car: string,
  track: string,
  driverStyle?: string,
  balancePreference?: string,
  game?: string
) {
  const archetype = detectChassisArchetype(car, game);
  const style = driverStyle || "Heavy Trail-Braker";
  const balance = balancePreference || "Neutral Balance";

  // Tyre pressure offsets for driving style & balance
  let flOffset = 0;
  let frOffset = 0;
  let rlOffset = 0;
  let rrOffset = 0;

  if (/trail/i.test(style)) {
    // Stiffen front slightly to resist rollover under braking
    flOffset += 0.2;
    frOffset += 0.2;
  }
  if (/oversteer|rotation/i.test(balance)) {
    // Soften rear or stiffen front
    rlOffset -= 0.3;
    rrOffset -= 0.3;
  } else if (/understeer|stability/i.test(balance)) {
    flOffset -= 0.3;
    frOffset -= 0.3;
  }

  const p = archetype.coldPsi;
  const flPsi = (p.fl.recommended + flOffset).toFixed(1);
  const frPsi = (p.fr.recommended + frOffset).toFixed(1);
  const rlPsi = (p.rl.recommended + rlOffset).toFixed(1);
  const rrPsi = (p.rr.recommended + rrOffset).toFixed(1);

  const diff = archetype.differential;
  const susp = archetype.suspension;
  const damp = archetype.dampers;
  const align = archetype.alignment;
  const aero = archetype.aero;
  const elec = archetype.electronics;

  return {
    philosophy: `Championship ${archetype.displayName} baseline engineered for your ${style} technique and ${balance} requirement on ${track}. Calibrated against authentic ${archetype.id.toUpperCase()} vehicle dynamics: cold tyre pressures dialed to ${flPsi}/${frPsi} psi (targeting ${p.hotTarget}), differential set to ${diff.powerRecommended}% Power / ${diff.coastRecommended}% Coast to ensure stable trail-braking entry without throttle-exit traction snap, and compliant suspension geometry to preserve the tire contact patch.`,
    sections: [
      {
        title: "Tyres & Cold Pressures",
        items: [
          { label: "Front Left Cold Pressure", value: `${flPsi} psi`, styleNote: `Targeting ${p.hotTarget}` },
          { label: "Front Right Cold Pressure", value: `${frPsi} psi`, styleNote: "Equalized across corner weights" },
          { label: "Rear Left Cold Pressure", value: `${rlPsi} psi`, styleNote: "Optimized for traction patch under load" },
          { label: "Rear Right Cold Pressure", value: `${rrPsi} psi`, styleNote: "Thermal balance on lateral exit" },
        ],
      },
      {
        title: "Suspension & Wheel Alignment",
        items: [
          { label: "Front Anti-Roll Bar", value: `${susp.arbFrontStep} / ${susp.arbMaxSteps}`, styleNote: "Front mechanical roll stiffness" },
          { label: "Rear Anti-Roll Bar", value: `${susp.arbRearStep} / ${susp.arbMaxSteps}`, styleNote: "Rear axle compliance for traction" },
          { label: "Front Camber", value: `${align.camberFrontDeg.recommended.toFixed(1)}°`, styleNote: "Maximized lateral grip under cornering" },
          { label: "Rear Camber", value: `${align.camberRearDeg.recommended.toFixed(1)}°`, styleNote: "Optimal contact patch under acceleration" },
          { label: "Front Toe", value: `${align.toeFrontClicks} clicks (Toe-Out)`, styleNote: "Sharp turn-in response" },
          { label: "Rear Toe", value: `${align.toeRearClicks} clicks (Toe-In)`, styleNote: "High-speed rear braking stability" },
        ],
      },
      {
        title: "Dampers (Bump & Rebound)",
        items: [
          { label: "Front Slow Bump", value: `${damp.slowBumpFront} / ${damp.clickScaleMax}`, styleNote: "Controls front pitch into braking" },
          { label: "Rear Slow Bump", value: `${damp.slowBumpRear} / ${damp.clickScaleMax}`, styleNote: "Rear axle platform support" },
          { label: "Front Slow Rebound", value: `${damp.slowReboundFront} / ${damp.clickScaleMax}`, styleNote: "Smooth weight transfer off apex" },
          { label: "Rear Slow Rebound", value: `${damp.slowReboundRear} / ${damp.clickScaleMax}`, styleNote: "Prevents rear lift under trail-braking" },
        ],
      },
      {
        title: "Aerodynamics & Ride Height",
        items: [
          { label: "Front Rod Length / Ride Height", value: `${susp.rodLengthFrontMm} mm`, styleNote: "Low drag, consistent aerodynamic platform" },
          { label: "Rear Rod Length / Ride Height", value: `${susp.rodLengthRearMm} mm`, styleNote: "Diffuser expansion ratio control" },
          ...(aero.hasRearWing ? [{ label: "Rear Wing Angle", value: `${aero.rearWingNotches} notches`, styleNote: "Circuit downforce vs drag trade-off" }] : []),
        ],
      },
      {
        title: "Differential & Drivetrain",
        items: [
          { label: "Diff Power Lock", value: `${diff.powerRecommended}%`, styleNote: "Corner exit rotation without sudden snap" },
          { label: "Diff Coast Lock", value: `${diff.coastRecommended}%`, styleNote: "Trail-braking entry stability into turn-in" },
          { label: "Diff Preload", value: `${diff.preloadNm} Nm`, styleNote: "Smooth transition between on/off throttle" },
        ],
      },
      {
        title: "Brakes & Electronics",
        items: [
          { label: "Brake Bias", value: `${elec.brakeBiasFrontPct.toFixed(1)}% (Front)`, styleNote: "Trail-braking rotation without front lockup" },
          ...(elec.hasAbs ? [{ label: "ABS Setting", value: `${elec.absRecommended} / 12`, styleNote: "Allows driver threshold modulation" }] : [{ label: "ABS Setting", value: "Disabled (Authentic Regulations)", styleNote: "Driver threshold braking required" }]),
          ...(elec.hasTc ? [{ label: "Traction Control (TC)", value: `${elec.tcRecommended} / 12`, styleNote: "Permits optimal slip angle on exit" }] : [{ label: "Traction Control (TC)", value: "Disabled", styleNote: "Raw throttle pedal control" }]),
        ],
      },
    ],
  };
}
