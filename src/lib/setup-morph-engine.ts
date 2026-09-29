import { SetupSection, SetupItem } from "@/types/telemetry";

export interface MorphInputConditions {
  trackTemp: number; // in Celsius
  airTemp: number;   // in Celsius
  weather: "optimum" | "greasy" | "green" | "damp" | "wet";
  fuelLiters: number;
}

export interface MorphedItemDiff {
  label: string;
  category: string;
  originalValue: string;
  morphedValue: string;
  changeDelta: string;
  changed: boolean;
  rationale: string;
}

export interface MorphResult {
  sections: SetupSection[];
  diffs: MorphedItemDiff[];
  summaryNote: string;
  totalChangesCount: number;
  conditionDescription: string;
}

function parseNumber(val: string, fallback: number = 0): number {
  const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : fallback;
}

/**
 * Computes thermodynamic and aerodynamic setup adaptations
 * based on asphalt temperature, ambient climate, wetness, and fuel load.
 */
export function morphSetupConditions(
  baselineSections: SetupSection[],
  baseline: MorphInputConditions,
  target: MorphInputConditions
): MorphResult {
  const deltaTrack = target.trackTemp - baseline.trackTemp;
  const deltaAir = target.airTemp - baseline.airTemp;
  const deltaFuel = target.fuelLiters - baseline.fuelLiters;

  const isWet = target.weather === "wet";
  const isDamp = target.weather === "damp";
  const isHot = target.trackTemp >= 34;
  const isCold = target.trackTemp <= 18;

  const diffs: MorphedItemDiff[] = [];
  let totalChanges = 0;

  const morphedSections: SetupSection[] = baselineSections.map((sec) => {
    const morphedItems: SetupItem[] = sec.items.map((item) => {
      const lower = item.label.toLowerCase();
      let morphedVal = item.value;
      let rationale = "";
      let deltaStr = "—";
      let changed = false;

      // 1. TYRE PRESSURES (FL, FR, RL, RR)
      if (
        lower.includes("pressure") ||
        lower.includes("psi") ||
        lower.includes("cold") ||
        lower.includes("front left") ||
        lower.includes("front right") ||
        lower.includes("rear left") ||
        lower.includes("rear right")
      ) {
        if (!lower.includes("brake") && !lower.includes("camber") && !lower.includes("toe")) {
          const basePsi = parseNumber(item.value, 26.5);
          let offset = 0;

          if (isWet) {
            // Wet tyres require higher pressure (+2.5 to +3.5 psi) to open tread grooves and prevent aquaplaning
            offset = 3.0;
            rationale = "Elevated cold pressure crowns tyre tread to displace standing water.";
          } else if (isDamp) {
            offset = 1.2;
            rationale = "Slightly higher inflation helps tyre carcass generate heat in damp patches.";
          } else {
            // Gay-Lussac thermodynamic expansion: ~0.11 PSI per +1°C asphalt heat
            offset = -(deltaTrack * 0.11);
            if (deltaTrack > 0) {
              rationale = `Compensates for +${deltaTrack.toFixed(0)}°C asphalt thermal expansion to hit target hot pressure window.`;
            } else if (deltaTrack < 0) {
              rationale = `Bumps cold pressure to counteract cold ${target.trackTemp}°C asphalt drop.`;
            }
          }

          if (Math.abs(offset) >= 0.1) {
            const finalPsi = Math.max(18.0, Math.min(36.0, Number((basePsi + offset).toFixed(1))));
            if (finalPsi !== basePsi) {
              morphedVal = `${finalPsi} psi`;
              deltaStr = `${offset > 0 ? "+" : ""}${offset.toFixed(1)} psi`;
              changed = true;
            }
          }
        }
      }

      // 2. ANTI-ROLL BARS (ARBs)
      else if (lower.includes("anti-roll") || lower.includes("arb")) {
        const baseArb = Math.round(parseNumber(item.value, 3));
        let newArb = baseArb;

        if (lower.includes("rear")) {
          if (isWet) {
            newArb = Math.max(0, baseArb - 2);
            rationale = "Softened rear ARB maximizes wet mechanical traction on corner exit.";
          } else if (isDamp || (isHot && deltaTrack >= 8)) {
            newArb = Math.max(0, baseArb - 1);
            rationale = "Softer rear roll resistance prevents thermal blistering & rear snap oversteer on hot asphalt.";
          }
        } else if (lower.includes("front")) {
          if (isWet) {
            newArb = Math.max(0, baseArb - 1);
            rationale = "Softer front ARB promotes front tyre bite on low-grip wet turn-in.";
          }
        }

        if (newArb !== baseArb) {
          morphedVal = `${newArb}`;
          deltaStr = `${newArb - baseArb > 0 ? "+" : ""}${newArb - baseArb} click`;
          changed = true;
        }
      }

      // 3. BRAKE DUCT OPENINGS
      else if (lower.includes("brake duct") || lower.includes("duct")) {
        const baseDuct = Math.round(parseNumber(item.value, 2));
        let newDuct = baseDuct;

        if (target.trackTemp >= 40 || deltaAir >= 10) {
          newDuct = Math.min(6, baseDuct + 2);
          rationale = "Opened brake ducts to prevent brake fluid boil & pad fade under high ambient heat.";
        } else if (target.trackTemp >= 32 || deltaAir >= 5) {
          newDuct = Math.min(6, baseDuct + 1);
          rationale = "Increased airflow keeps disc thermals in the optimal 450°C–600°C friction window.";
        } else if (isWet || isCold || deltaAir <= -8) {
          newDuct = Math.max(0, baseDuct - 1);
          rationale = "Closed ducting to retain heat in cold discs and prevent pad glazing.";
        }

        if (newDuct !== baseDuct) {
          morphedVal = `${newDuct}`;
          deltaStr = `${newDuct - baseDuct > 0 ? "+" : ""}${newDuct - baseDuct}`;
          changed = true;
        }
      }

      // 4. RIDE HEIGHTS & FUEL COMPENSATION
      else if (lower.includes("ride height") || lower.includes("height")) {
        const baseHeight = Math.round(parseNumber(item.value, 55));
        let heightOffset = 0;

        // Heavy fuel load compensation
        if (deltaFuel >= 30) {
          heightOffset += lower.includes("rear") ? 3 : 2;
          rationale = "Raised ride height prevents plank bottoming & diffuser stall under heavy fuel mass.";
        } else if (deltaFuel <= -25) {
          heightOffset -= lower.includes("rear") ? 2 : 1;
          rationale = "Lowered ride height takes advantage of lightweight qualifying fuel tank.";
        }

        // Wet track puddle clearance
        if (isWet) {
          heightOffset += lower.includes("rear") ? 4 : 3;
          rationale = "Added ground clearance prevents aquaplaning on standing water puddles.";
        }

        if (heightOffset !== 0) {
          const finalHeight = baseHeight + heightOffset;
          morphedVal = `${finalHeight} mm`;
          deltaStr = `${heightOffset > 0 ? "+" : ""}${heightOffset} mm`;
          changed = true;
        }
      }

      // 5. REAR WING / AERODYNAMICS
      else if (lower.includes("rear wing") || lower.includes("wing")) {
        const baseWing = Math.round(parseNumber(item.value, 7));
        let newWing = baseWing;

        if (isWet) {
          newWing = Math.min(12, baseWing + 2);
          rationale = "Added aerodynamic downforce maintains rear stability in treacherous wet conditions.";
        } else if (isDamp) {
          newWing = Math.min(12, baseWing + 1);
          rationale = "Slightly higher wing angle cushions high-speed stability.";
        }

        if (newWing !== baseWing) {
          morphedVal = `${newWing}°`;
          deltaStr = `${newWing - baseWing > 0 ? "+" : ""}${newWing - baseWing}°`;
          changed = true;
        }
      }

      // 6. BRAKE BIAS
      else if (lower.includes("brake bias") || lower.includes("bias")) {
        const baseBias = parseNumber(item.value, 54.5);
        let newBias = baseBias;

        if (isWet) {
          newBias = Number((baseBias - 1.2).toFixed(1));
          rationale = "Shifted brake bias rearward to avoid locking unloaded front tyres in rain.";
        } else if (isDamp) {
          newBias = Number((baseBias - 0.5).toFixed(1));
          rationale = "Slightly rearward bias softens front tyre scrubbing under braking.";
        }

        if (newBias !== baseBias) {
          morphedVal = `${newBias}%`;
          deltaStr = `${(newBias - baseBias).toFixed(1)}%`;
          changed = true;
        }
      }

      // 7. ELECTRONICS (TC & ABS)
      else if (lower.includes("traction control") || lower === "tc" || lower === "tc1") {
        const baseTc = Math.round(parseNumber(item.value, 3));
        let newTc = baseTc;

        if (isWet) {
          newTc = Math.min(11, baseTc + 2);
          rationale = "Heightened traction slip regulation prevents standing-start & curb wheelspin.";
        } else if (isHot && deltaTrack >= 10) {
          newTc = Math.min(11, baseTc + 1);
          rationale = "Extra TC intervention manages greasy asphalt thermal slide.";
        }

        if (newTc !== baseTc) {
          morphedVal = `${newTc}`;
          deltaStr = `+${newTc - baseTc}`;
          changed = true;
        }
      } else if (lower.includes("abs")) {
        const baseAbs = Math.round(parseNumber(item.value, 3));
        let newAbs = baseAbs;

        if (isWet) {
          newAbs = Math.min(11, baseAbs + 1);
          rationale = "Increased ABS slip threshold avoids flatspotting on wet paint & kerbs.";
        }

        if (newAbs !== baseAbs) {
          morphedVal = `${newAbs}`;
          deltaStr = `+${newAbs - baseAbs}`;
          changed = true;
        }
      }

      if (changed) {
        totalChanges++;
        diffs.push({
          label: item.label,
          category: sec.title,
          originalValue: item.value,
          morphedValue: morphedVal,
          changeDelta: deltaStr,
          changed: true,
          rationale,
        });
      }

      return {
        ...item,
        value: morphedVal,
        styleNote: changed ? `[Morphed] ${rationale}` : item.styleNote,
      };
    });

    return {
      ...sec,
      items: morphedItems,
    };
  });

  // Summary generation
  let condSummary = `Morphed from ${baseline.trackTemp}°C / ${baseline.airTemp}°C (${baseline.weather}) → ${target.trackTemp}°C / ${target.airTemp}°C (${target.weather}, Fuel: ${target.fuelLiters}L).`;
  if (totalChanges === 0) {
    condSummary += " Conditions are within the baseline tolerance window; no changes needed.";
  } else {
    condSummary += ` Calibrated ${totalChanges} parameters to protect tyre degradation and maintain aerodynamic balance.`;
  }

  return {
    sections: morphedSections,
    diffs,
    summaryNote: condSummary,
    totalChangesCount: totalChanges,
    conditionDescription: `${target.trackTemp}°C Track · ${target.weather.toUpperCase()} · ${target.fuelLiters}L Fuel`,
  };
}
