import { ParameterDefinition, ParameterRuleSource } from "./types";
import { detectChassisArchetype } from "../chassis-archetypes";

/**
 * ============================================================================
 * AUTHORITATIVE SIMULATOR SETUP PARAMETER CATALOG & RULE ENFORCER
 * ============================================================================
 * Provides exact, validated parameter schemas, units, click ranges, and step sizes
 * for each supported simulation title.
 *
 * Rules are categorized into:
 * - HARD FACT: Directly declared by mod setup.ini or hard game slider boundaries
 * - VERIFIED GAME RULE: Backed by documented simulator physics mechanics
 * - ENGINEERING HEURISTIC: Vehicle dynamics prior
 * - UNCERTAIN: Flagged so it is never treated as a hard constraint
 * ============================================================================
 */

// Helper to snap a numeric value strictly to the parameter's step grid
export function snapToStep(val: number, min: number, max: number, step: number): number {
  if (step <= 0) return Math.min(max, Math.max(min, val));
  const stepsFromMin = Math.round((val - min) / step);
  const snapped = min + stepsFromMin * step;
  // Handle float precision quirks (e.g. 0.05 increments)
  const precision = step.toString().includes(".") ? step.toString().split(".")[1].length : 0;
  const clamped = Math.min(max, Math.max(min, snapped));
  return Number(clamped.toFixed(precision));
}

// ----------------------------------------------------------------------------
// 1. ASSETTO CORSA COMPETIZIONE (ACC) GT3 / GT4 CATALOG
// ----------------------------------------------------------------------------
export const ACC_GT3_PARAMETERS: ParameterDefinition[] = [
  // TYRES
  {
    id: "TYRE_PRESSURE_FL",
    label: "Tyre Pressure FL",
    aliases: ["pressure lf", "pressure fl", "front left pressure", "fl pressure"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 24.0,
    max: 30.0,
    step: 0.1,
    defaultValue: 26.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_FR",
    label: "Tyre Pressure FR",
    aliases: ["pressure rf", "pressure fr", "front right pressure", "fr pressure"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 24.0,
    max: 30.0,
    step: 0.1,
    defaultValue: 26.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RL",
    label: "Tyre Pressure RL",
    aliases: ["pressure lr", "pressure rl", "rear left pressure", "rl pressure"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 24.0,
    max: 30.0,
    step: 0.1,
    defaultValue: 26.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RR",
    label: "Tyre Pressure RR",
    aliases: ["pressure rr", "rear right pressure", "rr pressure"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 24.0,
    max: 30.0,
    step: 0.1,
    defaultValue: 26.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  // ELECTRONICS
  {
    id: "TC1",
    label: "Traction Control (TC1)",
    aliases: ["tc", "tc1", "traction control"],
    menuTab: "ELECTRONICS",
    subsystem: "electronics",
    unit: "",
    min: 0,
    max: 11,
    step: 1,
    defaultValue: 4,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 11`,
  },
  {
    id: "ABS",
    label: "ABS Setting",
    aliases: ["abs"],
    menuTab: "ELECTRONICS",
    subsystem: "electronics",
    unit: "",
    min: 0,
    max: 11,
    step: 1,
    defaultValue: 5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 11`,
  },
  // MECHANICAL GRIP / SUSPENSION
  {
    id: "ARB_FRONT",
    label: "Front Anti-Roll Bar",
    aliases: ["front arb", "arb front", "anti-roll bar front", "front antiroll bar"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "mechanical_platform",
    unit: "",
    min: 0,
    max: 10,
    step: 1,
    defaultValue: 5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 10`,
  },
  {
    id: "ARB_REAR",
    label: "Rear Anti-Roll Bar",
    aliases: ["rear arb", "arb rear", "anti-roll bar rear", "rear antiroll bar"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "mechanical_platform",
    unit: "",
    min: 0,
    max: 10,
    step: 1,
    defaultValue: 3,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 10`,
  },
  {
    id: "DIFF_PRELOAD",
    label: "Differential Preload",
    aliases: ["preload", "diff preload", "differential preload"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "drivetrain",
    unit: "Nm",
    min: 40,
    max: 200,
    step: 10,
    defaultValue: 80,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} Nm`,
  },
  {
    id: "BRAKE_BIAS",
    label: "Brake Bias",
    aliases: ["brake bias", "bias", "front brake bias"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "brakes",
    unit: "%",
    min: 50.0,
    max: 70.0,
    step: 0.2,
    defaultValue: 58.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}% Front`,
  },
  {
    id: "CAMBER_FRONT",
    label: "Front Camber (LF/RF)",
    aliases: ["front camber", "camber lf", "camber rf"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "alignment",
    unit: "°",
    min: -4.0,
    max: -2.0,
    step: 0.1,
    defaultValue: -3.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: "CAMBER_REAR",
    label: "Rear Camber (LR/RR)",
    aliases: ["rear camber", "camber lr", "camber rr"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "alignment",
    unit: "°",
    min: -3.5,
    max: -1.0,
    step: 0.1,
    defaultValue: -2.8,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: "TOE_FRONT",
    label: "Front Toe",
    aliases: ["front toe", "toe lf", "toe rf"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "alignment",
    unit: "°",
    min: -0.4,
    max: 0.4,
    step: 0.02,
    defaultValue: -0.06,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}°`,
  },
  {
    id: "TOE_REAR",
    label: "Rear Toe",
    aliases: ["rear toe", "toe lr", "toe rr"],
    menuTab: "MECHANICAL GRIP",
    subsystem: "alignment",
    unit: "°",
    min: -0.1,
    max: 0.6,
    step: 0.02,
    defaultValue: 0.14,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}°`,
  },
  // DAMPERS
  {
    id: "BUMP_SLOW_F",
    label: "Bump Slow Front",
    aliases: ["bump lf", "slow bump front", "bump front"],
    menuTab: "DAMPERS",
    subsystem: "dampers",
    unit: "clicks",
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 15,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 40 clicks`,
  },
  {
    id: "REBOUND_SLOW_F",
    label: "Rebound Slow Front",
    aliases: ["rebound lf", "slow rebound front", "rebound front"],
    menuTab: "DAMPERS",
    subsystem: "dampers",
    unit: "clicks",
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 18,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 40 clicks`,
  },
  {
    id: "BUMP_SLOW_R",
    label: "Bump Slow Rear",
    aliases: ["bump lr", "slow bump rear", "bump rear"],
    menuTab: "DAMPERS",
    subsystem: "dampers",
    unit: "clicks",
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 12,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 40 clicks`,
  },
  {
    id: "REBOUND_SLOW_R",
    label: "Rebound Slow Rear",
    aliases: ["rebound lr", "slow rebound rear", "rebound rear"],
    menuTab: "DAMPERS",
    subsystem: "dampers",
    unit: "clicks",
    min: 0,
    max: 40,
    step: 1,
    defaultValue: 16,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 40 clicks`,
  },
  // AERO & RIDE HEIGHT
  {
    id: "RIDE_HEIGHT_F",
    label: "Front Ride Height",
    aliases: ["front ride height", "front ride", "ride height front"],
    menuTab: "AERO",
    subsystem: "aero",
    unit: "mm",
    min: 48,
    max: 75,
    step: 1,
    defaultValue: 54,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} mm`,
  },
  {
    id: "RIDE_HEIGHT_R",
    label: "Rear Ride Height",
    aliases: ["rear ride height", "rear ride", "ride height rear"],
    menuTab: "AERO",
    subsystem: "aero",
    unit: "mm",
    min: 55,
    max: 95,
    step: 1,
    defaultValue: 68,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} mm`,
  },
  {
    id: "REAR_WING",
    label: "Rear Wing",
    aliases: ["rear wing", "rear wing angle"],
    menuTab: "AERO",
    subsystem: "aero",
    unit: "",
    min: 1,
    max: 12,
    step: 1,
    defaultValue: 6,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 12`,
  },
];

// ----------------------------------------------------------------------------
// 2. EA SPORTS F1 SERIES (F1 23 / 24 / 25) CATALOG
// ----------------------------------------------------------------------------
export const F1_GAME_PARAMETERS: ParameterDefinition[] = [
  // AERODYNAMICS
  {
    id: "FRONT_WING_AERO",
    label: "Front Wing Aero",
    aliases: ["front wing aero", "front wing"],
    menuTab: "AERODYNAMICS",
    subsystem: "aero",
    unit: "",
    min: 1,
    max: 50,
    step: 1,
    defaultValue: 30,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 50`,
  },
  {
    id: "REAR_WING_AERO",
    label: "Rear Wing Aero",
    aliases: ["rear wing aero", "rear wing"],
    menuTab: "AERODYNAMICS",
    subsystem: "aero",
    unit: "",
    min: 1,
    max: 50,
    step: 1,
    defaultValue: 26,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 50`,
  },
  // TRANSMISSION
  {
    id: "DIFF_ON_THROTTLE",
    label: "Diff Adjustment On-Throttle",
    aliases: ["diff on throttle", "on-throttle diff", "differential on-throttle", "diff adjustment on-throttle"],
    menuTab: "TRANSMISSION",
    subsystem: "drivetrain",
    unit: "%",
    min: 50,
    max: 100,
    step: 1,
    defaultValue: 55,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  {
    id: "DIFF_OFF_THROTTLE",
    label: "Diff Adjustment Off-Throttle",
    aliases: ["diff off throttle", "off-throttle diff", "differential off-throttle", "diff adjustment off-throttle"],
    menuTab: "TRANSMISSION",
    subsystem: "drivetrain",
    unit: "%",
    min: 50,
    max: 100,
    step: 1,
    defaultValue: 51,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  {
    id: "ENGINE_BRAKING",
    label: "Engine Braking",
    aliases: ["engine braking"],
    menuTab: "TRANSMISSION",
    subsystem: "drivetrain",
    unit: "%",
    min: 0,
    max: 100,
    step: 5,
    defaultValue: 60,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  // SUSPENSION GEOMETRY
  {
    id: "FRONT_CAMBER",
    label: "Front Camber",
    aliases: ["front camber"],
    menuTab: "SUSPENSION GEOMETRY",
    subsystem: "alignment",
    unit: "°",
    min: -3.50,
    max: -2.50,
    step: 0.05,
    defaultValue: -2.80,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(2)}°`,
  },
  {
    id: "REAR_CAMBER",
    label: "Rear Camber",
    aliases: ["rear camber"],
    menuTab: "SUSPENSION GEOMETRY",
    subsystem: "alignment",
    unit: "°",
    min: -2.20,
    max: -1.00,
    step: 0.05,
    defaultValue: -1.30,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(2)}°`,
  },
  {
    id: "FRONT_TOE_OUT",
    label: "Front Toe-Out",
    aliases: ["front toe-out", "front toe"],
    menuTab: "SUSPENSION GEOMETRY",
    subsystem: "alignment",
    unit: "°",
    min: 0.00,
    max: 0.10,
    step: 0.01,
    defaultValue: 0.02,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(2)}°`,
  },
  {
    id: "REAR_TOE_IN",
    label: "Rear Toe-In",
    aliases: ["rear toe-in", "rear toe"],
    menuTab: "SUSPENSION GEOMETRY",
    subsystem: "alignment",
    unit: "°",
    min: 0.10,
    max: 0.40,
    step: 0.01,
    defaultValue: 0.10,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(2)}°`,
  },
  // SUSPENSION
  {
    id: "FRONT_SUSPENSION",
    label: "Front Suspension",
    aliases: ["front suspension", "front spring rate"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "",
    min: 1,
    max: 41,
    step: 1,
    defaultValue: 35,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 41`,
  },
  {
    id: "REAR_SUSPENSION",
    label: "Rear Suspension",
    aliases: ["rear suspension", "rear spring rate"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "",
    min: 1,
    max: 41,
    step: 1,
    defaultValue: 9,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 41`,
  },
  {
    id: "FRONT_ARB",
    label: "Front Anti-Roll Bar",
    aliases: ["front anti-roll bar", "front arb", "arb front"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "",
    min: 1,
    max: 21,
    step: 1,
    defaultValue: 12,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 21`,
  },
  {
    id: "REAR_ARB",
    label: "Rear Anti-Roll Bar",
    aliases: ["rear anti-roll bar", "rear arb", "arb rear"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "",
    min: 1,
    max: 21,
    step: 1,
    defaultValue: 3,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 21`,
  },
  {
    id: "FRONT_RIDE_HEIGHT",
    label: "Front Ride Height",
    aliases: ["front ride height", "front height"],
    menuTab: "SUSPENSION",
    subsystem: "aero",
    unit: "",
    min: 30,
    max: 50,
    step: 1,
    defaultValue: 34,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 50`,
  },
  {
    id: "REAR_RIDE_HEIGHT",
    label: "Rear Ride Height",
    aliases: ["rear ride height", "rear height"],
    menuTab: "SUSPENSION",
    subsystem: "aero",
    unit: "",
    min: 30,
    max: 60,
    step: 1,
    defaultValue: 38,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} / 60`,
  },
  // BRAKES
  {
    id: "BRAKE_PRESSURE",
    label: "Brake Pressure",
    aliases: ["brake pressure", "pressure"],
    menuTab: "BRAKES",
    subsystem: "brakes",
    unit: "%",
    min: 80,
    max: 100,
    step: 1,
    defaultValue: 100,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  {
    id: "FRONT_BRAKE_BIAS",
    label: "Front Brake Bias",
    aliases: ["front brake bias", "brake bias", "bias"],
    menuTab: "BRAKES",
    subsystem: "brakes",
    unit: "%",
    min: 50,
    max: 70,
    step: 1,
    defaultValue: 55,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  // TYRE PRESSURES
  {
    id: "TYRE_PRESSURE_FL",
    label: "Front Left Tyre Pressure",
    aliases: ["front left tyre pressure", "fl tyre pressure"],
    menuTab: "TYRE PRESSURES",
    subsystem: "tyres",
    unit: "psi",
    min: 22.0,
    max: 25.5,
    step: 0.1,
    defaultValue: 23.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_FR",
    label: "Front Right Tyre Pressure",
    aliases: ["front right tyre pressure", "fr tyre pressure"],
    menuTab: "TYRE PRESSURES",
    subsystem: "tyres",
    unit: "psi",
    min: 22.0,
    max: 25.5,
    step: 0.1,
    defaultValue: 23.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RL",
    label: "Rear Left Tyre Pressure",
    aliases: ["rear left tyre pressure", "rl tyre pressure"],
    menuTab: "TYRE PRESSURES",
    subsystem: "tyres",
    unit: "psi",
    min: 20.0,
    max: 23.5,
    step: 0.1,
    defaultValue: 20.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RR",
    label: "Rear Right Tyre Pressure",
    aliases: ["rear right tyre pressure", "rr tyre pressure"],
    menuTab: "TYRE PRESSURES",
    subsystem: "tyres",
    unit: "psi",
    min: 20.0,
    max: 23.5,
    step: 0.1,
    defaultValue: 20.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
];

// ----------------------------------------------------------------------------
// 3. ASSETTO CORSA (ORIGINAL AC) FORMULA / GT3 CATALOG
// ----------------------------------------------------------------------------
export const AC_FORMULA_PARAMETERS: ParameterDefinition[] = [
  // TYRES
  {
    id: "TYRE_PRESSURE_FL",
    label: "Front Left Pressure",
    aliases: ["front left pressure", "fl pressure", "pressure lf"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 13.0,
    max: 18.0,
    step: 0.5,
    defaultValue: 15.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_FR",
    label: "Front Right Pressure",
    aliases: ["front right pressure", "fr pressure", "pressure rf"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 13.0,
    max: 18.0,
    step: 0.5,
    defaultValue: 15.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RL",
    label: "Rear Left Pressure",
    aliases: ["rear left pressure", "rl pressure", "pressure lr"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 13.0,
    max: 18.0,
    step: 0.5,
    defaultValue: 15.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  {
    id: "TYRE_PRESSURE_RR",
    label: "Rear Right Pressure",
    aliases: ["rear right pressure", "rr pressure", "pressure rr"],
    menuTab: "TYRES",
    subsystem: "tyres",
    unit: "psi",
    min: 13.0,
    max: 18.0,
    step: 0.5,
    defaultValue: 15.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)} psi`,
  },
  // ALIGNMENT
  {
    id: "CAMBER_LF_RF",
    label: "Camber LF / RF",
    aliases: ["camber lf / rf", "camber front", "front camber"],
    menuTab: "ALIGNMENT",
    subsystem: "alignment",
    unit: "°",
    min: -4.0,
    max: -2.5,
    step: 0.1,
    defaultValue: -3.3,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: "CAMBER_LR_RR",
    label: "Camber LR / RR",
    aliases: ["camber lr / rr", "camber rear", "rear camber"],
    menuTab: "ALIGNMENT",
    subsystem: "alignment",
    unit: "°",
    min: -2.5,
    max: -1.0,
    step: 0.1,
    defaultValue: -1.5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}°`,
  },
  {
    id: "TOE_LF_RF",
    label: "Toe LF / RF",
    aliases: ["toe lf / rf", "toe front", "front toe"],
    menuTab: "ALIGNMENT",
    subsystem: "alignment",
    unit: "clicks",
    min: -10,
    max: 10,
    step: 1,
    defaultValue: 0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} clicks`,
  },
  {
    id: "TOE_LR_RR",
    label: "Toe LR / RR",
    aliases: ["toe lr / rr", "toe rear", "rear toe"],
    menuTab: "ALIGNMENT",
    subsystem: "alignment",
    unit: "clicks",
    min: -5,
    max: 20,
    step: 1,
    defaultValue: 10,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} clicks`,
  },
  // SUSPENSION
  {
    id: "ARB_FRONT",
    label: "Antiroll Bar Front",
    aliases: ["antiroll bar front", "front arb", "arb front"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "N/m",
    min: 40000,
    max: 140000,
    step: 10000,
    defaultValue: 100000,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toLocaleString()} N/m`,
  },
  {
    id: "ARB_REAR",
    label: "Antiroll Bar Rear",
    aliases: ["antiroll bar rear", "rear arb", "arb rear"],
    menuTab: "SUSPENSION",
    subsystem: "mechanical_platform",
    unit: "N/m",
    min: 20000,
    max: 120000,
    step: 10000,
    defaultValue: 80000,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toLocaleString()} N/m`,
  },
  {
    id: "ROD_LENGTH_F",
    label: "Rod Length / Height LF/RF",
    aliases: ["rod length / height lf/rf", "rod length front", "front ride height", "rod length lf"],
    menuTab: "SUSPENSION",
    subsystem: "aero",
    unit: "mm",
    min: 0,
    max: 20,
    step: 1,
    defaultValue: 6,
    source: "HARD_FACT",
    formatDisplay: (v) => `+${v} mm`,
  },
  {
    id: "ROD_LENGTH_R",
    label: "Rod Length / Height LR/RR",
    aliases: ["rod length / height lr/rr", "rod length rear", "rear ride height", "rod length lr"],
    menuTab: "SUSPENSION",
    subsystem: "aero",
    unit: "mm",
    min: 10,
    max: 35,
    step: 1,
    defaultValue: 24,
    source: "HARD_FACT",
    formatDisplay: (v) => `+${v} mm`,
  },
  // DRIVETRAIN
  {
    id: "DIFF_POWER",
    label: "Diff Power",
    aliases: ["diff power", "power lock"],
    menuTab: "DRIVETRAIN",
    subsystem: "drivetrain",
    unit: "%",
    min: 10,
    max: 50,
    step: 5,
    defaultValue: 15,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  {
    id: "DIFF_COAST",
    label: "Diff Coast",
    aliases: ["diff coast", "coast lock"],
    menuTab: "DRIVETRAIN",
    subsystem: "drivetrain",
    unit: "%",
    min: 10,
    max: 60,
    step: 5,
    defaultValue: 25,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v}%`,
  },
  // AERO
  {
    id: "FRONT_WING",
    label: "Front Wing [Wing 0]",
    aliases: ["front wing [wing 0]", "front wing", "wing 0"],
    menuTab: "AERO",
    subsystem: "aero",
    unit: "notches",
    min: 0,
    max: 25,
    step: 1,
    defaultValue: 14,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} notches`,
  },
  {
    id: "REAR_WING",
    label: "Rear Wing [Wing 1]",
    aliases: ["rear wing [wing 1]", "rear wing", "wing 1"],
    menuTab: "AERO",
    subsystem: "aero",
    unit: "notches",
    min: 0,
    max: 10,
    step: 1,
    defaultValue: 5,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v} notches`,
  },
  // BRAKES
  {
    id: "BRAKE_BIAS",
    label: "Brake Bias",
    aliases: ["brake bias", "bias"],
    menuTab: "BRAKES",
    subsystem: "brakes",
    unit: "%",
    min: 50.0,
    max: 65.0,
    step: 0.5,
    defaultValue: 54.0,
    source: "HARD_FACT",
    formatDisplay: (v) => `${v.toFixed(1)}% Front`,
  },
];

/**
 * Dynamically converts parsed Assetto Corsa mod setup.ini sliders into authoritative HARD_FACT parameter definitions.
 */
export function buildModParameterCatalog(customModProfile: any): ParameterDefinition[] {
  if (!customModProfile?.sliders || !Array.isArray(customModProfile.sliders)) {
    return [];
  }

  return customModProfile.sliders.map((s: any) => {
    const rawCategory = (s.category || "GENERAL").toUpperCase();
    const sub: any = 
      /tyre|pressure/i.test(s.key + s.name) ? "tyres" :
      /camber|toe|caster/i.test(s.key + s.name) ? "alignment" :
      /arb|roll|spring|rod/i.test(s.key + s.name) ? "mechanical_platform" :
      /bump|rebound|damp/i.test(s.key + s.name) ? "dampers" :
      /wing|aero|splitter/i.test(s.key + s.name) ? "aero" :
      /diff/i.test(s.key + s.name) ? "drivetrain" :
      /brake/i.test(s.key + s.name) ? "brakes" : "electronics";

    const min = typeof s.min === "number" ? s.min : 0;
    const max = typeof s.max === "number" ? s.max : 100;
    const step = typeof s.step === "number" && s.step > 0 ? s.step : 1;
    const def = typeof s.defaultValue === "number" ? s.defaultValue : min;

    return {
      id: s.key || s.name,
      label: s.name || s.key,
      aliases: [s.name?.toLowerCase(), s.key?.toLowerCase()].filter(Boolean),
      menuTab: rawCategory,
      subsystem: sub,
      unit: s.unit || "",
      min,
      max,
      step,
      defaultValue: def,
      source: "HARD_FACT" as ParameterRuleSource,
      formatDisplay: (v: number) => `${v}${s.unit ? ` ${s.unit}` : ""}`,
    };
  });
}

/**
 * Resolves the authoritative parameter catalog for a given simulator and car context.
 */
export function getAuthoritativeCatalog(
  game: string,
  car: string,
  customModProfile?: any
): ParameterDefinition[] {
  // If custom mod physics were uploaded from an Assetto Corsa setup.ini, they take absolute precedence (HARD FACT)
  if (customModProfile?.sliders?.length > 0) {
    const modCatalog = buildModParameterCatalog(customModProfile);
    if (modCatalog.length > 0) return modCatalog;
  }

  const rawGame = (game || "").toLowerCase();
  if (/f1/i.test(rawGame) || /(ea sports|codemasters)/i.test(rawGame)) {
    return F1_GAME_PARAMETERS;
  }

  if (/competizione|acc/i.test(rawGame)) {
    return ACC_GT3_PARAMETERS;
  }

  const archetype = detectChassisArchetype(car, game);
  if (archetype.id === "formula_modern" || archetype.id === "formula_historic") {
    return AC_FORMULA_PARAMETERS;
  }

  // Default to ACC GT3 catalog format for GT cars
  return ACC_GT3_PARAMETERS;
}

/**
 * Searches the catalog for a parameter definition matching a given label or key.
 */
export function findParameterDefinition(
  catalog: ParameterDefinition[],
  targetLabel: string
): ParameterDefinition | undefined {
  const norm = targetLabel.toLowerCase().trim();

  // 1. Exact label or ID match
  const exact = catalog.find(
    (def) => def.label.toLowerCase() === norm || def.id.toLowerCase() === norm
  );
  if (exact) return exact;

  // 2. Exact alias match
  const aliasMatch = catalog.find((def) =>
    def.aliases.some((a) => a === norm)
  );
  if (aliasMatch) return aliasMatch;

  // 3. Strict token/word boundary match (alias must be distinct and specific)
  return catalog.find((def) => {
    return def.aliases.some((a) => {
      if (a.length < 4) return false;
      const escaped = a.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      return regex.test(norm) && Math.abs(norm.length - a.length) <= 6;
    });
  });
}

/**
 * Extracts a numeric value from arbitrary setup item strings (e.g. "26.2 psi", "-3.3°", "12 / 41", "+6 mm").
 */
export function parseNumericValue(valStr: string): number | null {
  if (typeof valStr !== "string") {
    const num = Number(valStr);
    return isNaN(num) ? null : num;
  }
  // If formatted as "X / Y clicks" or "X / Y", extract X
  const fractionMatch = valStr.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (fractionMatch) {
    return parseFloat(fractionMatch[1]);
  }
  const match = valStr.match(/([+-]?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}
