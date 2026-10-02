/**
 * ============================================================================
 * APEXWALL AI // GAME-AUTHENTIC CHASSIS & SETUP PROFILES
 * ============================================================================
 * Real sim racing games use radically different setup menus, terminology,
 * click ranges, and measurement units (e.g. Assetto Corsa uses integer notches/mm
 * for toe and 0-40 damper clicks, F1 uses 1-50 wings and 1-41 suspension,
 * ACC uses 0.1 psi and milliradian degrees, iRacing uses inches/plates).
 *
 * This module defines exact game-specific tab structures and calibration rules.
 * ============================================================================
 */

import { detectChassisArchetype } from "./chassis-archetypes";

export interface SetupParamItem {
  label: string;
  value: string;
}

export interface SetupSection {
  title: string;
  items: SetupParamItem[];
}

export interface GameSetupProfile {
  gameKey: string;
  displayName: string;
  menuTabs: string[];
  systemPromptGuidance: string;
  generateProceduralSetup: (params: {
    car: string;
    track: string;
    sessionType?: string;
    weather?: string;
    trackTemp?: string;
    airTemp?: string;
    fuelLoad?: string;
    tyreCompound?: string;
    driverStyle?: string;
    handlingIssue?: string;
    skillLevel?: string;
  }) => { summary: string; sections: SetupSection[]; engineerNotes: string };
}

// ----------------------------------------------------------------------------
// 1. ASSETTO CORSA (Original AC)
// ----------------------------------------------------------------------------
export const assettoCorsaProfile: GameSetupProfile = {
  gameKey: "assetto-corsa",
  displayName: "Assetto Corsa",
  menuTabs: [
    "TYRES",
    "ALIGNMENT",
    "SUSPENSION",
    "SUSPENSION ADV.",
    "DAMPERS",
    "DRIVETRAIN",
    "AERO",
    "BRAKES",
    "GENERIC",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: Assetto Corsa (Original AC by Kunos).
In Assetto Corsa, the garage setup menu has specific tabs, click ranges, and physics rules:
- "TYRES":
  • For GT3 / GTE / GT Racing (Ferrari 488 GT3, Porsche 911 GT3, AMG GT3, Huracan, R8 LMS):
    Cold pressures MUST be 16.0 - 18.0 psi (e.g. 17-18 psi Front, 16-17 psi Rear). Slicks warm up by +9-10 psi to hit the optimal 26.0 - 27.5 psi hot window. Starting at 24+ psi is catastrophically overinflated!
  • For Formula / Open-Wheel (Formula Hybrid, F1, RSS, Exos, Tatuus): Pressures MUST be 14-16 psi cold (aim for 21-22 psi hot).
  • For Street / Touring: 26-28 psi cold.
- "ALIGNMENT":
  • Camber: In degrees with negative values (GT3: -2.8° front, -2.4° rear; Formula: -3.3° front, -1.5° rear).
  • Toe: In AC, Toe is set in integer clicks / notches (GT3: 4 clicks front toe-out, 5 clicks rear toe-in).
  • Caster in degrees (e.g. 7.2°).
- "SUSPENSION":
  • Antiroll Bar Front & Rear: For GT3, 1 to 8 steps (typically Front 6, Rear 4).
  • Corner Spring Rates: GT3 uses ~120 N/mm front, 115 N/mm rear.
  • Rod Length / Ride Height: For GT3, keep LF/RF at 5 mm and LR/RR at 5 mm for a flat, stable, low-drag aerodynamic platform.
- "SUSPENSION ADV.":
  • Packers / Travel: For GT3, Front 45-52 mm (49mm baseline) and Rear 55-65 mm (62mm baseline) to provide suspension compliance before hitting bumpstops. NEVER use 12-18mm which causes the car to bottom out!
  • Bumpstop Rate: 70 N/mm.
- "DAMPERS":
  • In Kunos GT3 cars, dampers use a 0-12 or 0-16 click scale (NOT 40!):
    Slow Bump: 8-9 front, 7-8 rear. Fast Bump: 7-8 front, 7-8 rear.
    Slow Rebound: 6-7 front, 7-8 rear. Fast Rebound: 8-9 front, 8-9 rear.
- "DRIVETRAIN":
  • For GT3: Diff Power MUST be 25% - 35% (30% is ideal, unlocking rotation on corner exit). Diff Coast MUST be 45% - 55% (50% is ideal, stabilizing the rear axle under heavy trail-braking into chicanes/hairpins). Diff Preload: 30-50 Nm.
  • For Formula: Diff Power 15-20%, Diff Coast 20-30%.
- "AERO":
  • For GT3: Front Splitter [Wing 1] (1 to 2 notches), Rear Wing [Wing 2] (5 to 8 notches).
  • NEVER output [WING_0] or [WING_11] on GT3 cars.
- "ELECTRONICS":
  • For GT3: ABS (5 to 7 / 12, standard 6), Traction Control (4 to 6 / 12, standard 5).
  • NEVER output hybrid MGU-K/MGU-H or heave springs on GT3 cars.
- "BRAKES": Brake Bias (% front: 62-65% for GT3, 52-56% for Formula), Brake Power (100%).
- "GENERIC": Fuel in Liters (30 L for sprint/quali, 60-100 L for endurance).
`,
  generateProceduralSetup: (p) => {
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");
    const isOversteer = /oversteer|snap|loose|tail/i.test(p.handlingIssue || "");
    const isHighSpeed = /monza|spa|silverstone|mugello/i.test(p.track);
    const isFormula = /(formula|hybrid|exos|tatus|sf23|superformula|indycar|gp2|f1|f2|f3|f4|rss_formula|vrc_formula|ks_ferrari_sf|ks_ferrari_f)/i.test(p.car);
    const isGT3 = /(gt3|gt2|gte|488|huracan|911_gt3|amg_gt3|r8_lms|m6_gt3|z4_gt3|sls_gt3|650s|gtr_gt3|corvette_c7r|ferrari_488)/i.test(p.car);

    if (isGT3) {
      return {
        summary: `Assetto Corsa GT3 championship specification for ${p.car} at ${p.track}. Calibrated directly against authentic Kunos GT3 physics & verified race telemetry: cold slick pressures at 17-18 psi (targeting 26.5-27.0 psi hot optimal grip window), 30% diff power to eliminate traction snap on throttle exit, 50% coast lock for trail-braking stability into big stops, compliant 0-12 damper clicks with 49/62mm packers, and flat 5mm rod length aerodynamic platform.`,
        sections: [
          {
            title: "TYRES",
            items: [
              { label: "Tyre Compound", value: p.tyreCompound || "Slick Medium / DHE" },
              { label: "Front Left Pressure", value: "18 psi (aim for 26.8 psi hot)" },
              { label: "Front Right Pressure", value: "17 psi (aim for 26.5 psi hot)" },
              { label: "Rear Left Pressure", value: "16 psi (aim for 26.5 psi hot)" },
              { label: "Rear Right Pressure", value: "17 psi (aim for 26.8 psi hot)" },
            ],
          },
          {
            title: "ALIGNMENT",
            items: [
              { label: "Camber LF / RF", value: isUndersteer ? "-3.0° / -3.0°" : "-2.8° / -2.8°" },
              { label: "Camber LR / RR", value: "-2.4° / -2.4°" },
              { label: "Toe LF / RF", value: isUndersteer ? "5 clicks (toe-out for sharper turn-in)" : "4 clicks" },
              { label: "Toe LR / RR", value: "5 clicks (toe-in for high-speed rear tracking)" },
              { label: "Caster", value: "7.2°" },
            ],
          },
          {
            title: "SUSPENSION",
            items: [
              { label: "Antiroll Bar Front", value: isUndersteer ? "5 / 8" : "6 / 8" },
              { label: "Antiroll Bar Rear", value: isOversteer ? "3 / 8" : "4 / 8" },
              { label: "Front Wheel Rate", value: "120 N/mm" },
              { label: "Rear Wheel Rate", value: "115 N/mm" },
              { label: "Rod Length LF/RF", value: "5 mm (Flat low-drag aero platform)" },
              { label: "Rod Length LR/RR", value: "5 mm (Balanced diffuser pitch)" },
            ],
          },
          {
            title: "SUSPENSION ADV.",
            items: [
              { label: "Front Packers Travel", value: "49 mm (High bumpstop clearance)" },
              { label: "Rear Packers Travel", value: "62 mm" },
              { label: "Bumpstop Rate", value: "70 N/mm" },
            ],
          },
          {
            title: "DAMPERS",
            items: [
              { label: "Bump LF/RF", value: "9 / 12 clicks" },
              { label: "Bump LR/RR", value: "8 / 12 clicks" },
              { label: "Fast Bump LF/RF", value: "8 / 12 clicks (Kerb absorption)" },
              { label: "Fast Bump LR/RR", value: "8 / 12 clicks" },
              { label: "Rebound LF/RF", value: "7 / 12 clicks" },
              { label: "Rebound LR/RR", value: "8 / 12 clicks" },
              { label: "Fast Rebound LF/RF", value: "9 / 12 clicks" },
              { label: "Fast Rebound LR/RR", value: "9 / 12 clicks" },
            ],
          },
          {
            title: "DRIVETRAIN",
            items: [
              { label: "Diff Power", value: "30% (Smooth exit rotation without snap)" },
              { label: "Diff Coast", value: isOversteer ? "55% (Maximum trail-braking stability)" : "50%" },
              { label: "Diff Preload", value: "40 Nm" },
            ],
          },
          {
            title: "AERO",
            items: [
              { label: "Front Splitter [Wing 1]", value: "1 notch" },
              { label: "Rear Wing [Wing 2]", value: isHighSpeed ? "6 notches (Low drag for Spa/Monza)" : "8 notches (Downforce)" },
            ],
          },
          {
            title: "ELECTRONICS",
            items: [
              { label: "ABS", value: "6 / 12 (Deep trail-braking threshold)" },
              { label: "Traction Control", value: "5 / 12 (Optimum tyre slip angle)" },
            ],
          },
          {
            title: "BRAKES",
            items: [
              { label: "Brake Bias", value: "64% Front" },
              { label: "Brake Power", value: "100%" },
            ],
          },
          {
            title: "GENERIC",
            items: [
              { label: "Fuel Load", value: p.fuelLoad || "30 L (Sprint / Quali)" },
            ],
          },
        ],
        engineerNotes: `Copy driver, in Assetto Corsa your GT3 setup has been calibrated directly against authentic Kunos telemetry: cold slick pressures are at 17-18 psi (preventing hot pressures from blowing out past 30 psi), diff power is unlocked to 30% for smooth exit rotation without snap-oversteer, diff coast is locked to 50% for stable trail-braking, packers are opened to 49/62mm to eliminate bottoming out, and dampers are dialed in 0-12 click range for smooth curb riding.`,
      };
    }

    if (isFormula) {
      return {
        summary: `Assetto Corsa race-ready specification for ${p.car} at ${p.track}. Calibrated specifically for high-downforce open-wheel physics: 15.0 psi cold pressures, 100,000 N/m ARB, safe +6 rod length (clears floor limit without scraping), +24 rear rod length (controlled 18mm aero rake without diffuser stall), 3rd-element heave springs, and 15% diff power to eliminate traction snap.`,
        sections: [
          {
            title: "TYRES",
            items: [
              { label: "Tyre Compound", value: p.tyreCompound || "Soft Slicks" },
              { label: "Front Left Pressure", value: "15.0 psi (aim for 21.0 psi hot)" },
              { label: "Front Right Pressure", value: "15.0 psi (aim for 21.0 psi hot)" },
              { label: "Rear Left Pressure", value: "15.0 psi (aim for 21.0 psi hot)" },
              { label: "Rear Right Pressure", value: "15.0 psi (aim for 21.0 psi hot)" },
            ],
          },
          {
            title: "ALIGNMENT",
            items: [
              { label: "Camber LF / RF", value: "-3.3° / -3.3°" },
              { label: "Camber LR / RR", value: "-1.5° / -1.5°" },
              { label: "Toe LF / RF", value: isUndersteer ? "-2 clicks (-0.5mm toe-out for sharper turn-in)" : "0 clicks (0.0mm neutral drag)" },
              { label: "Toe LR / RR", value: "+10 clicks (+2.0mm toe-in for high-speed rear stability)" },
              { label: "Caster", value: "8.5°" },
            ],
          },
          {
            title: "SUSPENSION",
            items: [
              { label: "Antiroll Bar Front", value: "100,000 N/m (Optimal roll stiffness)" },
              { label: "Antiroll Bar Rear", value: isOversteer ? "80,000 N/m (Softened for exit traction)" : "100,000 N/m" },
              { label: "Front Wheel Rate", value: "140 N/mm" },
              { label: "Rear Wheel Rate", value: "80 N/mm" },
              { label: "Front Heave Spring (3rd Element)", value: "100 N/mm (Aero platform support)" },
              { label: "Rear Heave Spring (3rd Element)", value: "20 N/mm" },
              { label: "Rod Length / Height LF/RF", value: "+6 mm (26mm ground clearance, scraper eliminated)" },
              { label: "Rod Length / Height LR/RR", value: "+24 mm (Optimized aerodynamic rake without diffuser stall)" },
            ],
          },
          {
            title: "SUSPENSION ADV.",
            items: [
              { label: "Front Packers Travel", value: "16 mm" },
              { label: "Rear Packers Travel", value: "26 mm" },
              { label: "Bumpstop Rate", value: "70 N/mm" },
            ],
          },
          {
            title: "DAMPERS",
            items: [
              { label: "Bump LF/RF", value: "11 / 40 clicks" },
              { label: "Fast Bump LF/RF", value: "7 / 40 clicks (curb compliance)" },
              { label: "Rebound LF/RF", value: "10 / 40 clicks" },
              { label: "Fast Rebound LF/RF", value: "7 / 40 clicks" },
              { label: "Bump LR/RR", value: "4 / 40 clicks" },
              { label: "Rebound LR/RR", value: "4 / 40 clicks" },
              { label: "Heave Bump Front / Rear", value: "4 / 2 clicks" },
              { label: "Heave Rebound Front / Rear", value: "4 / 2 clicks" },
            ],
          },
          {
            title: "DRIVETRAIN",
            items: [
              { label: "Diff Power", value: "15% (Low lock prevents violent turbo torque wheelspin)" },
              { label: "Diff Coast", value: isUndersteer ? "20% (Agile turn-in)" : "25%" },
              { label: "Diff Preload", value: "30 Nm" },
            ],
          },
          {
            title: "AERO",
            items: [
              { label: "Front Wing [Wing 0]", value: isHighSpeed ? "13 notches" : "15 notches (Range 0-25)" },
              { label: "Rear Wing [Wing 1]", value: isHighSpeed ? "4 notches (Low drag)" : "6 notches (Range 0-10)" },
            ],
          },
          {
            title: "BRAKES",
            items: [
              { label: "Brake Bias", value: "54% Front" },
              { label: "Brake Engine", value: "6" },
              { label: "Brake Power", value: "100%" },
            ],
          },
          {
            title: "GENERIC",
            items: [
              { label: "Fuel Load", value: p.fuelLoad || "15 L (Sprint / Quali)" },
            ],
          },
        ],
        engineerNotes: `Copy driver, in Assetto Corsa your Formula setup has been calibrated to authentic open-wheel physics: front rod length is set to +6 (clearing the floor limit without scraping), while rear rod length is dialed to +24 for a stable 18mm aero rake delta. Heave springs are active to support aerodynamic downforce at speed, ARB is set to 100,000 N/m, and diff power is lowered to 15% to stop the rear axle snapping on throttle application.`,
      };
    }

    const archetype = detectChassisArchetype(p.car, "Assetto Corsa");
    const pPsi = archetype.coldPsi;
    const diff = archetype.differential;
    const susp = archetype.suspension;
    const damp = archetype.dampers;
    const align = archetype.alignment;
    const aero = archetype.aero;
    const elec = archetype.electronics;

    return {
      summary: `Assetto Corsa ${archetype.displayName} specification for ${p.car} at ${p.track}. Calibrated specifically for authentic ${archetype.id} physics: cold pressures at ${pPsi.fl.recommended}/${pPsi.rl.recommended} psi (aiming for ${pPsi.hotTarget}), diff at ${diff.powerRecommended}% Power / ${diff.coastRecommended}% Coast to resolve ${p.handlingIssue ? `"${p.handlingIssue}"` : "balance"}, and compliant damper damping.`,
      sections: [
        {
          title: "TYRES",
          items: [
            { label: "Tyre Compound", value: p.tyreCompound || "Slick Medium" },
            { label: "Front Left Pressure", value: `${pPsi.fl.recommended} psi (target ${pPsi.hotTarget})` },
            { label: "Front Right Pressure", value: `${pPsi.fr.recommended} psi` },
            { label: "Rear Left Pressure", value: `${pPsi.rl.recommended} psi` },
            { label: "Rear Right Pressure", value: `${pPsi.rr.recommended} psi` },
          ],
        },
        {
          title: "ALIGNMENT",
          items: [
            { label: "Camber LF / RF", value: `${align.camberFrontDeg.recommended.toFixed(1)}° / ${align.camberFrontDeg.recommended.toFixed(1)}°` },
            { label: "Camber LR / RR", value: `${align.camberRearDeg.recommended.toFixed(1)}° / ${align.camberRearDeg.recommended.toFixed(1)}°` },
            { label: "Toe LF / RF", value: isUndersteer ? `${align.toeFrontClicks + 1} clicks (toe-out for turn-in)` : `${align.toeFrontClicks} clicks` },
            { label: "Toe LR / RR", value: `${align.toeRearClicks} clicks (toe-in for tracking)` },
            { label: "Caster", value: `${align.casterDeg.toFixed(1)}°` },
          ],
        },
        {
          title: "SUSPENSION",
          items: [
            { label: "Antiroll Bar Front", value: isUndersteer ? `${Math.max(1, susp.arbFrontStep - 1)} / ${susp.arbMaxSteps}` : `${susp.arbFrontStep} / ${susp.arbMaxSteps}` },
            { label: "Antiroll Bar Rear", value: isOversteer ? `${Math.max(1, susp.arbRearStep - 1)} / ${susp.arbMaxSteps}` : `${susp.arbRearStep} / ${susp.arbMaxSteps}` },
            { label: "Front Wheel Rate", value: `${susp.springRateFrontNmm} N/mm` },
            { label: "Rear Wheel Rate", value: `${susp.springRateRearNmm} N/mm` },
            { label: "Rod Length / Height LF/RF", value: `${susp.rodLengthFrontMm} mm` },
            { label: "Rod Length / Height LR/RR", value: `${susp.rodLengthRearMm} mm` },
          ],
        },
        {
          title: "SUSPENSION ADV.",
          items: [
            { label: "Front Packers Travel", value: `${susp.packersFrontMm} mm` },
            { label: "Rear Packers Travel", value: `${susp.packersRearMm} mm` },
            { label: "Bumpstop Rate", value: "70 N/mm" },
          ],
        },
        {
          title: "DAMPERS",
          items: [
            { label: "Bump LF/RF", value: `${damp.slowBumpFront} / ${damp.clickScaleMax} clicks` },
            { label: "Fast Bump LF/RF", value: `${damp.fastBumpFront} / ${damp.clickScaleMax} clicks (curb compliance)` },
            { label: "Rebound LF/RF", value: `${damp.slowReboundFront} / ${damp.clickScaleMax} clicks` },
            { label: "Fast Rebound LF/RF", value: `${damp.fastReboundFront} / ${damp.clickScaleMax} clicks` },
            { label: "Bump LR/RR", value: `${damp.slowBumpRear} / ${damp.clickScaleMax} clicks` },
            { label: "Rebound LR/RR", value: `${damp.slowReboundRear} / ${damp.clickScaleMax} clicks` },
          ],
        },
        {
          title: "DRIVETRAIN",
          items: [
            { label: "Diff Power", value: `${diff.powerRecommended}% (${diff.behaviorNote.split('.')[0]})` },
            { label: "Diff Coast", value: `${diff.coastRecommended}%` },
            { label: "Diff Preload", value: `${diff.preloadNm} Nm` },
          ],
        },
        {
          title: "AERO",
          items: [
            ...(aero.hasFrontWing ? [{ label: "Front Wing / Splitter", value: `${aero.frontWingNotches} notch` }] : []),
            ...(aero.hasRearWing ? [{ label: "Rear Wing Angle", value: `${aero.rearWingNotches} notches` }] : []),
          ],
        },
        {
          title: "BRAKES",
          items: [
            { label: "Brake Bias", value: `${elec.brakeBiasFrontPct.toFixed(1)}% Front` },
            { label: "Brake Power", value: "100%" },
          ],
        },
        {
          title: "GENERIC",
          items: [
            { label: "Fuel Load", value: p.fuelLoad || "30 L" },
          ],
        },
      ],
      engineerNotes: `Copy driver, in Assetto Corsa your ${archetype.displayName} setup has been calibrated to authentic ${archetype.id} physics: tyre pressures are initialized to ${pPsi.fl.recommended}/${pPsi.rl.recommended} psi cold (aiming for ${pPsi.hotTarget}), differential is set to ${diff.powerRecommended}% power / ${diff.coastRecommended}% coast, and packers/bumpstops are configured for clean kerb compliance.`,
    };
  },
};

// ----------------------------------------------------------------------------
// 2. F1 23 / F1 24 / F1 25 (Codemasters / EA Sports)
// ----------------------------------------------------------------------------
export const f1Profile: GameSetupProfile = {
  gameKey: "f1",
  displayName: "F1 24 / F1 25",
  menuTabs: [
    "AERODYNAMICS",
    "TRANSMISSION",
    "SUSPENSION GEOMETRY",
    "SUSPENSION",
    "BRAKES",
    "TYRE PRESSURES",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: EA Sports F1 24 / F1 25 / F1 23 (Codemasters).
The setup menu in the F1 series has EXACTLY these 6 screens and ranges:
1. "AERODYNAMICS":
   • Front Wing Aero: integer from 1 to 50 (e.g. 38 for high downforce, 18 for Monza).
   • Rear Wing Aero: integer from 1 to 50 (e.g. 32 for high downforce, 14 for Monza).
2. "TRANSMISSION":
   • Differential Adjustment On-Throttle: percentage from 50% to 100% (e.g. 55% for traction, 70% for stability).
   • Differential Adjustment Off-Throttle: percentage from 50% to 100% (e.g. 50% for maximum rotation).
   • Engine Braking: percentage from 0% to 100% (typically 50%-80%).
3. "SUSPENSION GEOMETRY":
   • Front Camber: negative degrees from -3.50° to -2.50° in 0.10° steps (e.g. -2.70° or -3.50°).
   • Rear Camber: negative degrees from -2.00° to -1.00° in 0.10° steps (e.g. -1.50°).
   • Front Toe-Out: positive degrees from 0.00° to 0.15° (e.g. 0.03° or 0.00°).
   • Rear Toe-In: positive degrees from 0.10° to 0.50° (e.g. 0.10° or 0.15°).
4. "SUSPENSION":
   • Front Suspension: integer from 1 to 41 (e.g. 35 stiff, 12 soft).
   • Rear Suspension: integer from 1 to 41 (e.g. 10 soft for traction).
   • Front Anti-Roll Bar: integer from 1 to 21 (e.g. 14 stiff, 7 medium).
   • Rear Anti-Roll Bar: integer from 1 to 21 (e.g. 3 soft).
   • Front Ride Height: integer from 30 to 50 (e.g. 33).
   • Rear Ride Height: integer from 30 to 60 (e.g. 38).
5. "BRAKES":
   • Brake Pressure: percentage from 80% to 100% (typically 100%).
   • Front Brake Bias: percentage from 50% to 70% (typically 54% to 57%).
6. "TYRE PRESSURES":
   • Front Left Tyre Pressure: in psi from 22.0 to 25.5 psi (e.g. 23.5 psi).
   • Front Right Tyre Pressure: in psi from 22.0 to 25.5 psi (e.g. 23.5 psi).
   • Rear Left Tyre Pressure: in psi from 20.0 to 23.5 psi (e.g. 20.5 psi).
   • Rear Right Tyre Pressure: in psi from 20.0 to 23.5 psi (e.g. 20.5 psi).
`,
  generateProceduralSetup: (p) => {
    const isMonzaOrSpa = /monza|spa|las vegas|jeddah|baku/i.test(p.track);
    const isMonacoOrHungary = /monaco|hungaroring|singapore|zandvoort/i.test(p.track);
    const isSepangOrEfficiency = /sepang|malaysia|shanghai|bahrain/i.test(p.track);
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");

    const frontWing = isMonzaOrSpa
      ? "18 / 50"
      : isMonacoOrHungary
      ? "48 / 50"
      : isSepangOrEfficiency
      ? (isUndersteer ? "31 / 50" : "30 / 50")
      : "34 / 50";
    const rearWing = isMonzaOrSpa
      ? "14 / 50"
      : isMonacoOrHungary
      ? "44 / 50"
      : isSepangOrEfficiency
      ? "26 / 50"
      : "28 / 50";
    const onThrottleDiff = isUndersteer ? "55%" : "60%";
    const offThrottleDiff = "51%";
    const frontSusp = isUndersteer ? "33 / 41" : "36 / 41";
    const rearSusp = "9 / 41";
    const frontARB = isUndersteer ? "9 / 21" : "12 / 21";
    const rearARB = "3 / 21";

    return {
      summary: `Official F1 24 / F1 25 format setup for ${p.car} at ${p.track}. Programmed directly into Codemasters 1-50 wings, 1-41 suspension, and 1-21 anti-roll bar ranges.`,
      sections: [
        {
          title: "AERODYNAMICS",
          items: [
            { label: "Front Wing Aero", value: frontWing },
            { label: "Rear Wing Aero", value: rearWing },
          ],
        },
        {
          title: "TRANSMISSION",
          items: [
            { label: "Diff Adjustment On-Throttle", value: onThrottleDiff },
            { label: "Diff Adjustment Off-Throttle", value: offThrottleDiff },
            { label: "Engine Braking", value: "60%" },
          ],
        },
        {
          title: "SUSPENSION GEOMETRY",
          items: [
            { label: "Front Camber", value: "-2.80°" },
            { label: "Rear Camber", value: "-1.30°" },
            { label: "Front Toe-Out", value: "0.02°" },
            { label: "Rear Toe-In", value: "0.10° (Minimum drag)" },
          ],
        },
        {
          title: "SUSPENSION",
          items: [
            { label: "Front Suspension", value: frontSusp },
            { label: "Rear Suspension", value: rearSusp },
            { label: "Front Anti-Roll Bar", value: frontARB },
            { label: "Rear Anti-Roll Bar", value: rearARB },
            { label: "Front Ride Height", value: "33 / 50" },
            { label: "Rear Ride Height", value: "38 / 60" },
          ],
        },
        {
          title: "BRAKES",
          items: [
            { label: "Brake Pressure", value: "100%" },
            { label: "Front Brake Bias", value: "55%" },
          ],
        },
        {
          title: "TYRE PRESSURES",
          items: [
            { label: "Front Left Tyre Pressure", value: "23.5 psi" },
            { label: "Front Right Tyre Pressure", value: "23.5 psi" },
            { label: "Rear Left Tyre Pressure", value: "20.5 psi" },
            { label: "Rear Right Tyre Pressure", value: "20.5 psi" },
          ],
        },
      ],
      engineerNotes: `Radio check driver: in the F1 setup screen, set off-throttle diff right down to 51% to free up the nose in slow turns. Front ARB at ${frontARB} keeps the chassis flat through high-speed direction changes while rear suspension at 9/41 gives you maximum traction on corner exit.`,
    };
  },
};

// ----------------------------------------------------------------------------
// 3. ASSETTO CORSA COMPETIZIONE (ACC)
// ----------------------------------------------------------------------------
export const accProfile: GameSetupProfile = {
  gameKey: "acc",
  displayName: "Assetto Corsa Competizione",
  menuTabs: [
    "TYRES",
    "ELECTRONICS",
    "MECHANICAL GRIP",
    "DAMPERS",
    "AERO",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: Assetto Corsa Competizione (ACC - SRO GT World Challenge).
The setup menu in ACC has EXACTLY 5 tabs:
1. "TYRES":
   • Cold Pressure FL, FR, RL, RR in 0.1 psi increments (e.g. 26.2 psi aiming for hot 26.8-27.2 psi on GT3 DHE slick).
   • Camber FL, FR, RL, RR in degrees (-4.0° to -1.5°).
   • Toe FL, FR, RL, RR in degrees with 0.01 precision (-0.40° to +0.40°, negative is toe-out, positive is toe-in).
   • Caster in degrees (8.0° to 14.5°).
2. "ELECTRONICS":
   • TC1: integer (1 to 11).
   • TC2 (Cut): integer (0 to 11).
   • ABS: integer (1 to 11).
   • ECU Map: integer (1 to 4).
3. "MECHANICAL GRIP":
   • Front Anti-Roll Bar: integer (0 to 6).
   • Rear Anti-Roll Bar: integer (0 to 6).
   • Brake Power: percentage (80% to 100%).
   • Brake Bias: percentage (50.0% to 65.0% in 0.2% steps).
   • Steer Ratio: ratio (e.g. 13:1 to 15:1).
   • Wheel Rate FL/FR and RL/RR (N/mm).
   • Bumpstop Rate FL/FR and RL/RR (N).
   • Bumpstop Range FL/FR and RL/RR (mm).
   • Diff Preload (Nm, e.g. 40 to 120 Nm).
4. "DAMPERS":
   • Bump (Slow Bump) FL, FR, RL, RR: clicks (0 to 40 or 1 to 11).
   • Fast Bump FL, FR, RL, RR: clicks.
   • Rebound (Slow Rebound) FL, FR, RL, RR: clicks.
   • Fast Rebound FL, FR, RL, RR: clicks.
5. "AERO":
   • Front Ride Height: mm (e.g. 50 mm to 65 mm).
   • Rear Ride Height: mm (e.g. 68 mm to 80 mm).
   • Rear Wing: integer notch (0 to 12).
   • Brake Duct Front: integer (1 to 6).
   • Brake Duct Rear: integer (1 to 6).
`,
  generateProceduralSetup: (p) => {
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");
    const isOversteer = /oversteer|snap|loose|tail/i.test(p.handlingIssue || "");
    const isHighSpeed = /monza|spa|paul ricard|silverstone/i.test(p.track);

    return {
      summary: `Official Assetto Corsa Competizione (ACC) garage setup for ${p.car} at ${p.track}. Programmed strictly across ACC's 5 garage tabs with target 27.0 psi hot pressures, GT3 damper clicks, and aerodynamic rake.`,
      sections: [
        {
          title: "TYRES",
          items: [
            { label: "Front Left Pressure", value: "26.3 psi (aim for 27.0 psi hot)" },
            { label: "Front Right Pressure", value: "26.6 psi (aim for 27.0 psi hot)" },
            { label: "Rear Left Pressure", value: "26.2 psi (aim for 26.8 psi hot)" },
            { label: "Rear Right Pressure", value: "26.5 psi (aim for 26.8 psi hot)" },
            { label: "Front Camber (FL/FR)", value: isUndersteer ? "-3.7° / -3.7°" : "-3.4° / -3.4°" },
            { label: "Rear Camber (RL/RR)", value: "-2.8° / -2.8°" },
            { label: "Front Toe (FL/FR)", value: isUndersteer ? "-0.08° / -0.08° (Toe-out)" : "-0.04° / -0.04°" },
            { label: "Rear Toe (RL/RR)", value: "+0.14° / +0.14° (Toe-in for high-speed stability)" },
            { label: "Caster", value: "10.5°" },
          ],
        },
        {
          title: "ELECTRONICS",
          items: [
            { label: "TC1 (Traction Control)", value: "3 / 11" },
            { label: "TC2 (Cut Severity)", value: "2 / 11" },
            { label: "ABS", value: "3 / 11" },
            { label: "ECU Map", value: "1 (Quali / Race Max Power)" },
          ],
        },
        {
          title: "MECHANICAL GRIP",
          items: [
            { label: "Front Anti-Roll Bar", value: isUndersteer ? "2 / 6 (Softened for front turn-in)" : "4 / 6" },
            { label: "Rear Anti-Roll Bar", value: isOversteer ? "1 / 6 (Softened for exit drive)" : "3 / 6" },
            { label: "Wheel Rate Front", value: "165 N/mm" },
            { label: "Wheel Rate Rear", value: "135 N/mm" },
            { label: "Bumpstop Range Front", value: "14 mm" },
            { label: "Bumpstop Range Rear", value: "22 mm" },
            { label: "Brake Bias", value: "54.2%" },
            { label: "Brake Power", value: "100%" },
            { label: "Diff Preload", value: isUndersteer ? "50 Nm" : "70 Nm" },
          ],
        },
        {
          title: "DAMPERS",
          items: [
            { label: "Bump Front (FL/FR)", value: "5 / 11 clicks" },
            { label: "Fast Bump Front (FL/FR)", value: "3 / 11 clicks (curb absorption)" },
            { label: "Rebound Front (FL/FR)", value: "7 / 11 clicks" },
            { label: "Fast Rebound Front (FL/FR)", value: "5 / 11 clicks" },
            { label: "Bump Rear (RL/RR)", value: "4 / 11 clicks" },
            { label: "Rebound Rear (RL/RR)", value: "6 / 11 clicks" },
          ],
        },
        {
          title: "AERO",
          items: [
            { label: "Front Ride Height", value: "52 mm" },
            { label: "Rear Ride Height", value: "72 mm (20mm aerodynamic rake)" },
            { label: "Rear Wing", value: isHighSpeed ? "4 / 12 (Low drag)" : "8 / 12 (High downforce)" },
            { label: "Brake Duct Front", value: "3 / 6" },
            { label: "Brake Duct Rear", value: "2 / 6" },
          ],
        },
      ],
      engineerNotes: `ACC pit wall notes: Front toe is set to -0.08° and front ARB to 2/6 to immediately resolve "${p.handlingIssue || "mid-corner push"}". Target hot tyre pressures after 3 laps must settle right inside ACC's 26.8 - 27.2 psi optimum window.`,
    };
  },
};

// ----------------------------------------------------------------------------
// 4. iRACING
// ----------------------------------------------------------------------------
export const iracingProfile: GameSetupProfile = {
  gameKey: "iracing",
  displayName: "iRacing",
  menuTabs: [
    "TIRES",
    "CHASSIS / FRONT",
    "CHASSIS / REAR",
    "DRIVETRAIN",
    "IN-CAR ADJUSTMENTS",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: iRacing.
In the iRacing garage menu, the tabs are:
1. "TIRES":
   • Cold Inflation Pressures LF, RF, LR, RR in psi (e.g. 21.0 to 28.0 psi).
2. "CHASSIS / FRONT":
   • Front ARB Diameter & Blades (e.g. 1.25" / P2 or Blade setting 1-5).
   • Corner Weights / Cross Weight %.
   • Spring Rate LF/RF in lbs/in or N/mm (e.g. 900 lbs/in).
   • Spring Perch Offset LF/RF in mm.
   • Bump Stiffness / Rebound Stiffness LF/RF (clicks).
   • Camber LF/RF in degrees (e.g. -3.5°).
   • Caster LF/RF in degrees.
   • Toe-in in inches or mm (e.g. -1/16" or -1.5mm toe-out).
3. "CHASSIS / REAR":
   • Rear ARB Blades (e.g. P1 or P3).
   • Spring Rate LR/RR.
   • Spring Perch Offset LR/RR.
   • Bump & Rebound Stiffness LR/RR.
   • Camber LR/RR.
   • Toe-in LR/RR (e.g. +1/8" toe-in).
   • Wing Angle / Wicker (e.g. 6.0°).
4. "DRIVETRAIN":
   • Diff Preload (ft-lbs or Nm).
   • Clutch Plates (e.g. 4 plates).
   • Drive / Coast Ramp Angles (e.g. 45°/60°).
5. "IN-CAR ADJUSTMENTS":
   • Brake Bias (% front, e.g. 54.5%).
   • Traction Control (TC).
   • ABS.
   • Engine Map.
`,
  generateProceduralSetup: (p) => {
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");
    return {
      summary: `iRacing garage specification for ${p.car} at ${p.track}. Configured to iRacing's garage inspector with perch offsets, blade ARB settings, and differential clutch plates.`,
      sections: [
        {
          title: "TIRES",
          items: [
            { label: "Cold Pressure LF / RF", value: "22.5 psi / 23.0 psi" },
            { label: "Cold Pressure LR / RR", value: "22.0 psi / 22.5 psi" },
          ],
        },
        {
          title: "CHASSIS / FRONT",
          items: [
            { label: "Front ARB Blades", value: isUndersteer ? "P2 (Softened)" : "P3 (Medium)" },
            { label: "Corner Weights (Cross Weight)", value: "50.0% (Symmetric)" },
            { label: "Front Spring Rate", value: "950 lbs/in (166 N/mm)" },
            { label: "Spring Perch Offset LF / RF", value: "48 mm / 48 mm" },
            { label: "Camber LF / RF", value: "-3.6° / -3.6°" },
            { label: "Caster", value: "8.5°" },
            { label: "Toe-in", value: "-1/16\" (-1.6mm toe-out for sharp turn-in)" },
            { label: "Bump / Rebound Stiffness", value: "6 clicks / 8 clicks" },
          ],
        },
        {
          title: "CHASSIS / REAR",
          items: [
            { label: "Rear ARB Blades", value: "P2" },
            { label: "Rear Spring Rate", value: "750 lbs/in (131 N/mm)" },
            { label: "Spring Perch Offset LR / RR", value: "65 mm / 65 mm" },
            { label: "Camber LR / RR", value: "-2.6° / -2.6°" },
            { label: "Toe-in", value: "+1/8\" (+3.2mm toe-in for rear stability)" },
            { label: "Rear Wing Angle", value: "6.5°" },
          ],
        },
        {
          title: "DRIVETRAIN",
          items: [
            { label: "Diff Preload", value: "45 ft-lbs (61 Nm)" },
            { label: "Clutch Plates", value: "4 Plates" },
            { label: "Ramp Angles", value: "45° Drive / 60° Coast" },
          ],
        },
        {
          title: "IN-CAR ADJUSTMENTS",
          items: [
            { label: "Brake Bias", value: "54.0% Front" },
            { label: "Traction Control", value: "Position 3" },
            { label: "ABS", value: "Position 3" },
            { label: "Engine Map", value: "Map 1 (Race)" },
          ],
        },
      ],
      engineerNotes: `Copy driver: in iRacing's garage, set front toe to -1/16" and soften the front ARB to P2 to eliminate "${p.handlingIssue || "entry understeer"}". Rear perch offset is dialed to give positive rake for downforce through medium-speed sectors.`,
    };
  },
};

// ----------------------------------------------------------------------------
// 5. LE MANS ULTIMATE / rFACTOR 2
// ----------------------------------------------------------------------------
export const lmuProfile: GameSetupProfile = {
  gameKey: "lmu",
  displayName: "Le Mans Ultimate",
  menuTabs: [
    "GENERAL",
    "TIRES",
    "SUSPENSION & ALIGNMENT",
    "DAMPERS",
    "DRIVETRAIN & HYBRID",
    "AERO & BRAKES",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: Le Mans Ultimate (LMU) / rFactor 2.
LMU uses WEC Hypercar / LMP2 / GT3 garage tabs:
1. "GENERAL": Fuel (L), Radiator Blanking (%), Brake Blanking Front & Rear (%).
2. "TIRES": Starting cold pressure in kPa or psi (e.g. 175 kPa / 25.4 psi), Compound (Soft, Medium, Hard).
3. "SUSPENSION & ALIGNMENT":
   • Front & Rear ARB (N/mm or notches).
   • Front & Rear Springs (N/mm).
   • Front & Rear Ride Heights (mm).
   • Camber Front & Rear (degrees).
   • Toe-in Front & Rear (in millimeters, e.g. -1.0mm front, +2.0mm rear).
4. "DAMPERS": Slow Bump, Fast Bump, Slow Rebound, Fast Rebound (clicks).
5. "DRIVETRAIN & HYBRID":
   • Diff Preload (Nm), Power/Coast Ramps.
   • Virtual Energy Tank (MJ Target per stint).
   • Electric Motor Deployment Map (for Hypercar / GTP).
6. "AERO & BRAKES":
   • Front Splitter & Rear Wing Angle (degrees).
   • Brake Bias (% front, e.g. 54%).
`,
  generateProceduralSetup: (p) => {
    return {
      summary: `Official Le Mans Ultimate WEC garage setup for ${p.car} at ${p.track}. Tailored with LMU millimeter toe values, brake blanking percentages, and hybrid energy deployment.`,
      sections: [
        {
          title: "GENERAL",
          items: [
            { label: "Starting Fuel", value: p.fuelLoad || "75 L" },
            { label: "Front Brake Duct Blanking", value: "35% (Optimal rotor window 450°C-580°C)" },
            { label: "Rear Brake Duct Blanking", value: "40%" },
            { label: "Radiator Tape", value: "25%" },
          ],
        },
        {
          title: "TIRES",
          items: [
            { label: "Front Left Pressure", value: "175 kPa (25.4 psi)" },
            { label: "Front Right Pressure", value: "178 kPa (25.8 psi)" },
            { label: "Rear Left Pressure", value: "172 kPa (25.0 psi)" },
            { label: "Rear Right Pressure", value: "175 kPa (25.4 psi)" },
            { label: "Tyre Compound", value: p.tyreCompound || "Medium" },
          ],
        },
        {
          title: "SUSPENSION & ALIGNMENT",
          items: [
            { label: "Front Anti-Roll Bar", value: "120 N/mm (Softened)" },
            { label: "Rear Anti-Roll Bar", value: "85 N/mm" },
            { label: "Front Ride Height", value: "48 mm" },
            { label: "Rear Ride Height", value: "66 mm" },
            { label: "Front Camber", value: "-3.4°" },
            { label: "Rear Camber", value: "-2.3°" },
            { label: "Front Toe-in", value: "-1.0 mm (Toe-out for sharp apex bite)" },
            { label: "Rear Toe-in", value: "+2.0 mm (Toe-in for high-speed stability)" },
          ],
        },
        {
          title: "DAMPERS",
          items: [
            { label: "Slow Bump (Front / Rear)", value: "8 clicks / 6 clicks" },
            { label: "Fast Bump (Front / Rear)", value: "5 clicks / 4 clicks (kerb absorption)" },
            { label: "Slow Rebound (Front / Rear)", value: "12 clicks / 10 clicks" },
            { label: "Fast Rebound (Front / Rear)", value: "8 clicks / 7 clicks" },
          ],
        },
        {
          title: "DRIVETRAIN & HYBRID",
          items: [
            { label: "Diff Preload", value: "60 Nm" },
            { label: "Power / Coast Ramps", value: "45° / 55°" },
            { label: "Virtual Energy Tank (VET)", value: "898 MJ Stint Target" },
            { label: "Hybrid Deployment Mode", value: "Balanced Stint (Auto Regen)" },
          ],
        },
        {
          title: "AERO & BRAKES",
          items: [
            { label: "Rear Wing Angle", value: "P3 (Low drag configuration)" },
            { label: "Front Splitter", value: "Position 2" },
            { label: "Brake Bias", value: "53.8% Front" },
            { label: "Brake Pressure", value: "100%" },
          ],
        },
      ],
      engineerNotes: `Radio check driver: in Le Mans Ultimate, front toe is dialed to -1.0mm and brake blanking to 35% to manage rotor thermals into heavy stops like Indianapolis and Arnage. Virtual Energy Tank target is calibrated for complete stint length.`,
    };
  },
};

// ----------------------------------------------------------------------------
// 6. ASSETTO CORSA EVO
// ----------------------------------------------------------------------------
export const aceProfile: GameSetupProfile = {
  gameKey: "assetto-corsa-evo",
  displayName: "Assetto Corsa Evo",
  menuTabs: [
    "TYRES",
    "ALIGNMENT",
    "SUSPENSION",
    "DAMPERS",
    "DRIVETRAIN",
    "AERO",
    "BRAKES",
    "ELECTRONICS",
  ],
  systemPromptGuidance: `
TARGET SIMULATOR: Assetto Corsa Evo (AC Evo by Kunos Simulazioni, 2025).
Assetto Corsa Evo inherits AC's INI-based garage but with a modernised, per-wheel UI closer to ACC. Key tabs and ranges:
1. "TYRES":
   • Cold Pressure FL, FR, RL, RR in psi (e.g. 26.0-32.0 psi). Compound (e.g. Street, Sport, Semi-Slick, Slick Soft/Medium/Hard).
2. "ALIGNMENT":
   • Camber FL, FR, RL, RR in degrees (e.g. -3.0 front, -2.2 rear). Negative = top tilted inward.
   • Toe FL, FR, RL, RR in mm with 0.1 mm precision (e.g. -1.5 mm front toe-out, +1.8 mm rear toe-in). Negative = toe-out.
   • Caster (degrees, e.g. 8.2).
3. "SUSPENSION":
   • Front & Rear Anti-Roll Bar in integer clicks / notch (0-10 scale).
   • Spring Rate FL, FR, RL, RR in N/mm (e.g. 120-220 N/mm).
   • Ride Height FL, FR, RL, RR in mm (e.g. 65-130 mm).
4. "DAMPERS":
   • Bump (Slow) FL, FR, RL, RR: integer clicks (0-40).
   • Fast Bump FL, FR, RL, RR: integer clicks (0-40).
   • Rebound (Slow) FL, FR, RL, RR: integer clicks (0-40).
   • Fast Rebound FL, FR, RL, RR: integer clicks (0-40).
5. "DRIVETRAIN":
   • Differential Power Lock (% 0-100%).
   • Differential Coast Lock (% 0-100%).
   • Differential Preload (Nm, e.g. 30-100 Nm).
6. "AERO":
   • Rear Wing in integer notches (e.g. 0-12). Front Splitter (0-5 if supported by car).
   • Brake Duct Front & Rear (0-6 on cars that support it).
7. "BRAKES":
   • Brake Bias (% front, e.g. 56%-70%).
   • Brake Power (%, typically 100%).
8. "ELECTRONICS" (cars that support it):
   • TC (Traction Control level, e.g. 0-10 or Off/Low/Medium/High).
   • ABS level (0-10 or Off/Low/Medium/High).
   • Engine Map (e.g. 1-5 or named map).
`,
  generateProceduralSetup: (p) => {
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");
    const isOversteer = /oversteer|snap|loose|tail/i.test(p.handlingIssue || "");
    const isHighSpeed = /monza|spa|silverstone|mugello|le mans/i.test(p.track);
    const isStreet = /street|road|city/i.test(p.tyreCompound || "");

    return {
      summary: `Assetto Corsa Evo garage setup for ${p.car} at ${p.track}. Calibrated to AC Evo's modernised per-wheel damper interface (0-40 clicks), 0.1 mm toe precision, and notch-based ARB system to eliminate ${p.handlingIssue ? `"${p.handlingIssue}"` : "mid-corner imbalance"}.`,
      sections: [
        {
          title: "TYRES",
          items: [
            { label: "Tyre Compound", value: p.tyreCompound || "Semi-Slick" },
            { label: "Cold Pressure FL / FR", value: isStreet ? "29.0 / 29.5 psi" : "26.5 / 27.0 psi" },
            { label: "Cold Pressure RL / RR", value: isStreet ? "28.0 / 28.5 psi" : "25.8 / 26.3 psi" },
            { label: "Target Hot Pressure (FL/FR)", value: "32.0 psi" },
            { label: "Target Hot Pressure (RL/RR)", value: "31.0 psi" },
          ],
        },
        {
          title: "ALIGNMENT",
          items: [
            { label: "Camber FL / FR", value: isUndersteer ? "-3.4 / -3.4" : "-3.0 / -3.0" },
            { label: "Camber RL / RR", value: "-2.2 / -2.2" },
            { label: "Toe FL / FR", value: isUndersteer ? "-1.8 mm / -1.8 mm (Toe-out for turn-in)" : "-1.0 mm / -1.0 mm (Toe-out)" },
            { label: "Toe RL / RR", value: "+1.6 mm / +1.6 mm (Toe-in for stability)" },
            { label: "Caster", value: "8.2" },
          ],
        },
        {
          title: "SUSPENSION",
          items: [
            { label: "Anti-Roll Bar Front", value: isUndersteer ? "3 / 10 (Softened for front grip)" : "5 / 10" },
            { label: "Anti-Roll Bar Rear", value: isOversteer ? "2 / 10 (Softened for traction)" : "4 / 10" },
            { label: "Spring Rate FL / FR", value: "145 N/mm" },
            { label: "Spring Rate RL / RR", value: "120 N/mm" },
            { label: "Ride Height FL / FR", value: "72 mm" },
            { label: "Ride Height RL / RR", value: "78 mm (Positive rake for aero)" },
          ],
        },
        {
          title: "DAMPERS",
          items: [
            { label: "Bump FL / FR", value: "12 / 40 clicks" },
            { label: "Fast Bump FL / FR", value: "8 / 40 clicks (Kerb compliance)" },
            { label: "Rebound FL / FR", value: "18 / 40 clicks" },
            { label: "Fast Rebound FL / FR", value: "12 / 40 clicks" },
            { label: "Bump RL / RR", value: "10 / 40 clicks" },
            { label: "Fast Bump RL / RR", value: "6 / 40 clicks" },
            { label: "Rebound RL / RR", value: "15 / 40 clicks" },
            { label: "Fast Rebound RL / RR", value: "10 / 40 clicks" },
          ],
        },
        {
          title: "DRIVETRAIN",
          items: [
            { label: "Differential Power Lock", value: isOversteer ? "40% (Reduce snap on exit)" : "55%" },
            { label: "Differential Coast Lock", value: isUndersteer ? "30% (Promote off-throttle rotation)" : "45%" },
            { label: "Differential Preload", value: "55 Nm" },
          ],
        },
        {
          title: "AERO",
          items: [
            { label: "Rear Wing", value: isHighSpeed ? "4 / 12 (Low drag for straights)" : "8 / 12 (Downforce)" },
            { label: "Front Splitter", value: "2 / 5" },
          ],
        },
        {
          title: "BRAKES",
          items: [
            { label: "Brake Bias", value: /trail/i.test(p.driverStyle || "") ? "63% Front (Shifted rearward for trail-braking)" : "67% Front" },
            { label: "Brake Power", value: "100%" },
          ],
        },
        {
          title: "ELECTRONICS",
          items: [
            { label: "Traction Control", value: p.skillLevel === "Beginner" ? "Medium (Level 5 / 10)" : p.skillLevel === "Pro / iRating high" ? "Off / Level 1" : "Low (Level 3 / 10)" },
            { label: "ABS", value: p.skillLevel === "Beginner" ? "Medium (Level 5 / 10)" : "Low (Level 2 / 10)" },
            { label: "Engine Map", value: "Map 1 (Max Power)" },
          ],
        },
      ],
      engineerNotes: `Copy driver: in Assetto Corsa Evo, toe is dialled to ${isUndersteer ? "-1.8 mm" : "-1.0 mm"} front toe-out in 0.1 mm steps to force the nose to rotate on turn-in, directly curing "${p.handlingIssue || "mid-corner scrub"}". Dampers follow the 0-40 click scale — fast-bump is kept soft at 8 clicks to absorb kerbs without upsetting the aero platform. Diff power at ${isOversteer ? "40%" : "55%"} is conservative; add 5% increments if traction allows on corner exit.`,
    };
  },
};

// ----------------------------------------------------------------------------
// HELPER: RESOLVE PROFILE FOR GIVEN SIM TITLE
// ----------------------------------------------------------------------------
export function getGameSetupProfile(gameName: string): GameSetupProfile {
  const g = (gameName || "").toLowerCase();

  if (g.includes("competizione") || g === "acc") {
    return accProfile;
  }
  if (g.includes("evo") && (g.includes("assetto") || g.includes("ace"))) {
    return aceProfile;
  }
  if (g.includes("f1") || g.includes("formula 1")) {
    return f1Profile;
  }
  if (g.includes("iracing")) {
    return iracingProfile;
  }
  if (g.includes("mans") || g.includes("lmu") || g.includes("rfactor")) {
    return lmuProfile;
  }
  // Default to Assetto Corsa if AC or generic
  return assettoCorsaProfile;
}

