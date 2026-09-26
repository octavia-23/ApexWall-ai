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
In Assetto Corsa, the garage setup menu has specific tabs and units:
- "TYRES": Pressures in psi (typically 24-34 psi). Compound (e.g., Semi-Slicks, Slicks Medium/Soft/Hard, Vintage 60s).
- "ALIGNMENT":
  • Camber LF/RF/LR/RR in degrees with negative values (e.g., -3.2° front, -2.4° rear).
  • Toe LF/RF/LR/RR: In AC, Toe is set in INTEGER CLICKS or MILLIMETERS (e.g. -8 to +8 clicks, or -2mm to +2mm. Negative is toe-out, positive is toe-in. NEVER use milliradians or tiny 0.05 fractions).
  • Caster in degrees (e.g. 7.5°).
- "SUSPENSION":
  • Antiroll Bar Front & Rear in integer steps (e.g. 0 to 6, or specific N/m rate).
  • Wheel Rate / Spring Rate LF/RF/LR/RR (in N/m or N/mm).
  • Rod Length / Ride Height LF/RF/LR/RR (in integer clicks/mm, e.g. -10mm to +10mm).
- "SUSPENSION ADV.": Packers / Travel Range in mm (e.g. 10mm front, 15mm rear).
- "DAMPERS":
  • Bump LF/RF/LR/RR (integer clicks, range 0 to 40, e.g. 12 clicks).
  • Fast Bump LF/RF/LR/RR (integer clicks, range 0 to 40, e.g. 8 clicks).
  • Rebound LF/RF/LR/RR (integer clicks, range 0 to 40, e.g. 16 clicks).
  • Fast Rebound LF/RF/LR/RR (integer clicks, range 0 to 40, e.g. 11 clicks).
- "DRIVETRAIN":
  • Diff Power (% lock, e.g. 50%).
  • Diff Coast (% lock, e.g. 35%).
  • Diff Preload (Nm, e.g. 60 Nm).
- "AERO":
  • Rear Wing in integer notches (e.g. 0 to 12, e.g. 6).
  • Front Splitter (if car supports it, 0 to 3).
- "BRAKES": Brake Bias (% front, e.g. 66% or 58%), Brake Power (%).
- "GENERIC": Fuel in Liters (e.g. 30 L).
`,
  generateProceduralSetup: (p) => {
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");
    const isOversteer = /oversteer|snap|loose|tail/i.test(p.handlingIssue || "");
    const isHighSpeed = /monza|spa|silverstone|mugello/i.test(p.track);

    return {
      summary: `Assetto Corsa garage specification for ${p.car} at ${p.track}. Calibrated specifically for AC's physics engine: integer toe notches, 0-40 damper clicks, and differential lock percentages to eliminate ${p.handlingIssue ? `"${p.handlingIssue}"` : "cornering scrub"}.`,
      sections: [
        {
          title: "TYRES",
          items: [
            { label: "Tyre Compound", value: p.tyreCompound || "Slick Medium" },
            { label: "Front Left Pressure", value: "26 psi (aim for 32 psi hot)" },
            { label: "Front Right Pressure", value: "27 psi (aim for 32 psi hot)" },
            { label: "Rear Left Pressure", value: "25 psi (aim for 31 psi hot)" },
            { label: "Rear Right Pressure", value: "26 psi (aim for 31 psi hot)" },
          ],
        },
        {
          title: "ALIGNMENT",
          items: [
            { label: "Camber LF / RF", value: isUndersteer ? "-3.4° / -3.4°" : "-3.0° / -3.0°" },
            { label: "Camber LR / RR", value: "-2.2° / -2.2°" },
            { label: "Toe LF / RF", value: isUndersteer ? "-6 clicks (-1.5mm toe-out for turn-in)" : "-2 clicks (-0.5mm toe-out)" },
            { label: "Toe LR / RR", value: "+4 clicks (+1.0mm toe-in for high-speed stability)" },
            { label: "Caster", value: "7.8°" },
          ],
        },
        {
          title: "SUSPENSION",
          items: [
            { label: "Antiroll Bar Front", value: isUndersteer ? "2 / 6 (Softened to bite into apex)" : "4 / 6" },
            { label: "Antiroll Bar Rear", value: isOversteer ? "1 / 6 (Softened for traction)" : "3 / 6" },
            { label: "Front Wheel Rate", value: "140 N/mm" },
            { label: "Rear Wheel Rate", value: "115 N/mm" },
            { label: "Rod Length / Height LF/RF", value: "-5 mm (Lower front nose)" },
            { label: "Rod Length / Height LR/RR", value: "+5 mm (Positive rake)" },
          ],
        },
        {
          title: "SUSPENSION ADV.",
          items: [
            { label: "Front Packers Travel", value: "12 mm" },
            { label: "Rear Packers Travel", value: "18 mm" },
          ],
        },
        {
          title: "DAMPERS",
          items: [
            { label: "Bump LF/RF", value: "11 / 40 clicks" },
            { label: "Fast Bump LF/RF", value: "7 / 40 clicks (curb compliance)" },
            { label: "Rebound LF/RF", value: "18 / 40 clicks" },
            { label: "Fast Rebound LF/RF", value: "12 / 40 clicks" },
            { label: "Bump LR/RR", value: "9 / 40 clicks" },
            { label: "Rebound LR/RR", value: "14 / 40 clicks" },
          ],
        },
        {
          title: "DRIVETRAIN",
          items: [
            { label: "Diff Power", value: isOversteer ? "40% (Prevent snap on power)" : "55%" },
            { label: "Diff Coast", value: isUndersteer ? "30% (Promote off-throttle rotation)" : "45%" },
            { label: "Diff Preload", value: "50 Nm" },
          ],
        },
        {
          title: "AERO",
          items: [
            { label: "Rear Wing Angle", value: isHighSpeed ? "4 / 12 (Low drag for straights)" : "8 / 12 (Downforce)" },
            { label: "Front Splitter", value: "2 / 3" },
          ],
        },
        {
          title: "BRAKES",
          items: [
            { label: "Brake Bias", value: /trail/i.test(p.driverStyle || "") ? "64% Front (Shifted rearward for trail-braking)" : "68% Front" },
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
      engineerNotes: `Copy driver, in Assetto Corsa your toe has been dialed into negative clicks (-6 clicks front toe-out) to force the front end to rotate on turn-in, curing the "${p.handlingIssue || "mid-corner scrub"}". Dampers are set in standard AC 0-40 click increments with fast-bump softened to swallow kerbs.`,
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
    const isUndersteer = /understeer|push|wash/i.test(p.handlingIssue || "");

    const frontWing = isMonzaOrSpa ? "18 / 50" : isMonacoOrHungary ? "48 / 50" : "34 / 50";
    const rearWing = isMonzaOrSpa ? "14 / 50" : isMonacoOrHungary ? "44 / 50" : "28 / 50";
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
// HELPER: RESOLVE PROFILE FOR GIVEN SIM TITLE
// ----------------------------------------------------------------------------
export function getGameSetupProfile(gameName: string): GameSetupProfile {
  const g = (gameName || "").toLowerCase();

  if (g.includes("competizione") || g === "acc") {
    return accProfile;
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
