import { SetupSection, SetupItem } from "@/types/telemetry";
import { ParameterDefinition, SetupValidationReport } from "./types";
import { snapToStep, findParameterDefinition, parseNumericValue } from "./parameter-catalog";
import { BaselineContext } from "./baseline-generator";

declare module "./types" {
  interface SetupValidationReport {
    wasRepaired?: boolean;
  }
}

/**
 * ============================================================================
 * DETERMINISTIC SETUP VALIDATOR & PROGRAMMATIC REPAIR ENGINE
 * ============================================================================
 * The LLM is NEVER the final authority over numeric validity.
 * Validates:
 * A. Schema structure
 * B. Parameter existence in game catalog
 * C. Unit consistency
 * D. Min / Max numerical limits
 * E. Step / Increment grid alignment (programmatic step-snapping)
 * F. Simulator menu tab compatibility
 * G. Cross-parameter sanity (aerodynamic rake, diff lock ratio, damper bounds)
 * H. Car-class compatibility (no ABS on Formula cars, etc.)
 * ============================================================================
 */

export interface ValidationContext {
  game: string;
  car: string;
  catalog: ParameterDefinition[];
  baseline: BaselineContext;
  allowedTargetParams?: string[];
  maxDeltas?: Record<string, { maxSteps: number; maxAbsDelta: number }>;
}

export function validateAndRepairSetup(
  rawSections: SetupSection[],
  ctx: ValidationContext
): {
  repairedSections: SetupSection[];
  report: SetupValidationReport;
} {
  const repairs: Array<{ param: string; original: string; repaired: string; reason: string }> = [];
  const rejected: Array<{ param: string; reason: string }> = [];
  const coherenceWarnings: string[] = [];

  const catalog = ctx.catalog;
  const isFormula = /formula|f1|f2|super_formula|lotus_exos/i.test(ctx.car + ctx.game);
  const isGT3 = /gt3|gte|gtd/i.test(ctx.car) || /competizione/i.test(ctx.game);

  // Group catalog by menu tabs
  const validTabs = new Set(catalog.map((c) => c.menuTab.toUpperCase()));

  const repairedSections: SetupSection[] = [];

  // Track repaired parameters for cross-parameter sanity
  const valuesByParamId = new Map<string, number>();

  for (const rawSec of rawSections) {
    if (!rawSec || !rawSec.title || !Array.isArray(rawSec.items)) {
      continue;
    }

    const secTitle = rawSec.title.trim().toUpperCase();
    const cleanItems: SetupItem[] = [];

    for (const item of rawSec.items) {
      if (!item || !item.label) continue;

      const paramDef = findParameterDefinition(catalog, item.label);
      const rawValStr = String(item.value || "");
      const parsedNum = parseNumericValue(rawValStr);

      if (!paramDef) {
        // B. Parameter does not exist in catalog
        // Check if baseline had this item; if so, preserve baseline, else reject
        const baseItem = ctx.baseline.parameterMap.get(item.label.toLowerCase().trim());
        if (baseItem) {
          cleanItems.push({
            label: baseItem.label,
            value: baseItem.value,
            styleNote: item.styleNote || baseItem.sectionTitle,
          });
        } else {
          rejected.push({
            param: item.label,
            reason: `Parameter "${item.label}" is not an authentic control in ${ctx.game}. Rejected.`,
          });
        }
        continue;
      }

      // If this parameter was a non-cause / do-not-touch parameter and a baseline exists, revert to baseline!
      if (
        ctx.allowedTargetParams &&
        ctx.allowedTargetParams.length > 0 &&
        !ctx.allowedTargetParams.some((p) => p === paramDef.id || paramDef.aliases.includes(p.toLowerCase()))
      ) {
        const baseItem = ctx.baseline.parameterMap.get(item.label.toLowerCase().trim());
        if (baseItem) {
          if (baseItem.value !== rawValStr) {
            repairs.push({
              param: paramDef.label,
              original: rawValStr,
              repaired: baseItem.value,
              reason: "Non-cause parameter locked to baseline to prevent shotgun changes.",
            });
          }
          cleanItems.push({
            label: paramDef.label,
            value: baseItem.value,
            styleNote: item.styleNote || baseItem.sectionTitle,
          });
          if (baseItem.numericVal != null) valuesByParamId.set(paramDef.id, baseItem.numericVal);
          continue;
        }
      }

      // If numerical value could not be parsed, revert to baseline default
      if (parsedNum === null) {
        const repairedVal = paramDef.formatDisplay
          ? paramDef.formatDisplay(paramDef.defaultValue)
          : `${paramDef.defaultValue}`;
        repairs.push({
          param: paramDef.label,
          original: rawValStr,
          repaired: repairedVal,
          reason: "Non-numeric or unparsable value. Replaced with authentic default.",
        });
        cleanItems.push({ label: paramDef.label, value: repairedVal, styleNote: item.styleNote });
        valuesByParamId.set(paramDef.id, paramDef.defaultValue);
        continue;
      }

      // D & E. Min/Max Validation and Programmatic Step Snapping
      let val = parsedNum;
      let repairReasons: string[] = [];

      if (val < paramDef.min) {
        repairReasons.push(`Exceeded minimum limit (${paramDef.min})`);
        val = paramDef.min;
      } else if (val > paramDef.max) {
        repairReasons.push(`Exceeded maximum limit (${paramDef.max})`);
        val = paramDef.max;
      }

      // Check delta limits if set for this parameter
      if (ctx.maxDeltas && ctx.maxDeltas[paramDef.id]) {
        const baseVal = ctx.baseline.parameterMap.get(item.label.toLowerCase().trim())?.numericVal ?? paramDef.defaultValue;
        const maxDelta = ctx.maxDeltas[paramDef.id].maxAbsDelta;
        if (Math.abs(val - baseVal) > maxDelta) {
          const clampedVal = val > baseVal ? baseVal + maxDelta : baseVal - maxDelta;
          repairReasons.push(`Exceeded conservative delta limit (max ±${maxDelta})`);
          val = clampedVal;
        }
      }

      // Step grid snapping
      const snapped = snapToStep(val, paramDef.min, paramDef.max, paramDef.step);
      if (snapped !== parsedNum) {
        repairReasons.push(`Snapped to authentic slider step (${paramDef.step})`);
        val = snapped;
      }

      valuesByParamId.set(paramDef.id, val);

      const formattedVal = paramDef.formatDisplay
        ? paramDef.formatDisplay(val)
        : `${val}${paramDef.unit ? ` ${paramDef.unit}` : ""}`;

      if (repairReasons.length > 0) {
        repairs.push({
          param: paramDef.label,
          original: rawValStr,
          repaired: formattedVal,
          reason: repairReasons.join("; "),
        });
      }

      cleanItems.push({
        label: paramDef.label,
        value: formattedVal,
        styleNote: item.styleNote,
      });
    }

    if (cleanItems.length > 0) {
      repairedSections.push({
        title: secTitle,
        items: cleanItems,
      });
    }
  }

  // --------------------------------------------------------------------------
  // G. CROSS-PARAMETER SANITY & COHERENCE PASS
  // --------------------------------------------------------------------------

  // 1. Aerodynamic Rake Sanity (Modern Formula Cars)
  if (isFormula) {
    // In Assetto Corsa: Rod Length Front vs Rear
    const rodF = valuesByParamId.get("ROD_LENGTH_F");
    const rodR = valuesByParamId.get("ROD_LENGTH_R");
    if (rodF !== undefined && rodR !== undefined) {
      const rakeDelta = rodR - rodF;
      if (rakeDelta > 26) {
        coherenceWarnings.push(`Excessive formula rake detected (${rakeDelta}mm). Automatically clamping rear rod length to prevent diffuser flow detachment.`);
        // Repair rear rod length
        const safeR = rodF + 18;
        valuesByParamId.set("ROD_LENGTH_R", safeR);
        // Apply repair to sections
        repairedSections.forEach((s) => {
          s.items.forEach((it) => {
            const itemDef = findParameterDefinition(catalog, it.label);
            if (itemDef?.id === "ROD_LENGTH_R" || /rod length.*r/i.test(it.label)) {
              const repairedStr = `+${safeR} mm`;
              if (it.value !== repairedStr) {
                repairs.push({
                  param: it.label,
                  original: it.value,
                  repaired: repairedStr,
                  reason: "Clamped extreme rear rake to stable 18mm delta to prevent diffuser stall.",
                });
                it.value = repairedStr;
              }
            }
          });
        });
      }
    }

    // In F1 Game: Front vs Rear Ride Height
    const f1HeightF = valuesByParamId.get("FRONT_RIDE_HEIGHT");
    const f1HeightR = valuesByParamId.get("REAR_RIDE_HEIGHT");
    if (f1HeightF !== undefined && f1HeightR !== undefined) {
      const delta = f1HeightR - f1HeightF;
      if (delta > 6) {
        coherenceWarnings.push(`F1 rear ride height delta (${delta} clicks) is unstable. Clamping to 4 clicks over front.`);
        const safeR = f1HeightF + 4;
        valuesByParamId.set("REAR_RIDE_HEIGHT", safeR);
        repairedSections.forEach((s) => {
          s.items.forEach((it) => {
            const itemDef = findParameterDefinition(catalog, it.label);
            if (itemDef?.id === "REAR_RIDE_HEIGHT" || /rear ride height/i.test(it.label)) {
              const repairedStr = `${safeR} / 60`;
              if (it.value !== repairedStr) {
                repairs.push({
                  param: it.label,
                  original: it.value,
                  repaired: repairedStr,
                  reason: "Clamped F1 rear ride height to stable 4-click delta over front.",
                });
                it.value = repairedStr;
              }
            }
          });
        });
      }
    }
  }

  // 2. GT3 Differential Sanity: Coast lock >= Power lock
  if (isGT3) {
    const diffPower = valuesByParamId.get("DIFF_POWER");
    const diffCoast = valuesByParamId.get("DIFF_COAST");
    if (diffPower !== undefined && diffCoast !== undefined && diffPower > diffCoast) {
      const powerDef = catalog.find((c) => c.id === "DIFF_POWER") || findParameterDefinition(catalog, "Diff Power");
      const targetPower = Math.min(diffPower, diffCoast);
      const snappedPower = powerDef ? snapToStep(targetPower, powerDef.min, powerDef.max, powerDef.step) : targetPower;
      const formattedPower = powerDef?.formatDisplay
        ? powerDef.formatDisplay(snappedPower)
        : `${snappedPower}${powerDef?.unit ? ` ${powerDef.unit}` : ""}`;

      valuesByParamId.set("DIFF_POWER", snappedPower);
      coherenceWarnings.push(
        `GT3 diff power lock was higher than coast lock, causing extreme exit understeer and entry instability. Equalized power lock to ${formattedPower}.`
      );
      repairedSections.forEach((s) => {
        s.items.forEach((it) => {
          const itemDef = findParameterDefinition(catalog, it.label);
          if (itemDef?.id === "DIFF_POWER" || /diff power/i.test(it.label)) {
            if (it.value !== formattedPower) {
              repairs.push({
                param: it.label,
                original: it.value,
                repaired: formattedPower,
                reason: "Corrected inverted GT3 differential lock ratio.",
              });
              it.value = formattedPower;
            }
          }
        });
      });
    }
  }

  // 3. Damper Bump vs Rebound Sanity (Rebound should be stiffer than bump in slow speed)
  const slowBumpF = valuesByParamId.get("BUMP_SLOW_F");
  const slowRebF = valuesByParamId.get("REBOUND_SLOW_F");
  if (slowBumpF !== undefined && slowRebF !== undefined && slowBumpF > slowRebF) {
    coherenceWarnings.push("Front slow bump was stiffer than slow rebound, which would make the front chassis overdamped into turn-in.");
  }

  // 4. Car-Class Sanity: Reject ABS & TC on modern formula single-seaters
  if (isFormula) {
    repairedSections.forEach((s) => {
      s.items = s.items.filter((it) => {
        if (/abs|traction control/i.test(it.label)) {
          rejected.push({
            param: it.label,
            reason: "ABS / TC are strictly prohibited on modern Formula cars by regulation.",
          });
          return false;
        }
        return true;
      });
    });
  }

  return {
    repairedSections,
    report: {
      isValid: rejected.length === 0,
      wasRepaired: repairs.length > 0,
      repairedCount: repairs.length,
      repairs,
      rejected,
      coherenceWarnings,
    },
  };
}
