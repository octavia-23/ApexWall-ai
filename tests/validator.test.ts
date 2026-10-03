import { describe, it, expect } from "vitest";
import { validateAndRepairSetup, ValidationContext } from "@/lib/setup-engine/validator";
import { getAuthoritativeCatalog, AC_FORMULA_PARAMETERS } from "@/lib/setup-engine/parameter-catalog";
import { SetupSection } from "@/types/telemetry";
import { BaselineContext } from "@/lib/setup-engine/baseline-generator";

function createMockBaseline(items: { label: string; value: string; sectionTitle?: string }[]): BaselineContext {
  const map = new Map<string, { label: string; value: string; numericVal: number | null; sectionTitle: string }>();
  const sections: SetupSection[] = [
    {
      title: "TYRES",
      items: [],
    },
  ];

  items.forEach((it) => {
    const num = parseFloat(it.value);
    const numericVal = isNaN(num) ? null : num;
    const secTitle = it.sectionTitle || "TYRES";
    map.set(it.label.toLowerCase().trim(), {
      label: it.label,
      value: it.value,
      numericVal,
      sectionTitle: secTitle,
    });
    sections[0].items.push({
      label: it.label,
      value: it.value,
    });
  });

  return {
    isBaseline: true,
    sections,
    parameterMap: map,
    summary: "Mock baseline",
    notes: "Baseline notes",
  };
}

describe("src/lib/setup-engine/validator characterization tests", () => {
  const catalog = getAuthoritativeCatalog("Assetto Corsa Competizione", "Porsche 992 GT3 R");

  it("characterizes min and max numerical clamping", () => {
    // In ACC_GT3_PARAMETERS:
    // Tyre Pressure FL: min 24.0, max 30.0, step 0.1
    const baseline = createMockBaseline([
      { label: "Tyre Pressure FL", value: "26.0 psi" },
      { label: "Tyre Pressure FR", value: "26.0 psi" },
    ]);

    const rawSections: SetupSection[] = [
      {
        title: "TYRES",
        items: [
          { label: "Tyre Pressure FL", value: "20.0 psi" }, // Under min 24.0
          { label: "Tyre Pressure FR", value: "35.0 psi" }, // Over max 30.0
        ],
      },
    ];

    const ctx: ValidationContext = {
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R",
      catalog,
      baseline,
    };

    const { repairedSections, report } = validateAndRepairSetup(rawSections, ctx);

    // Clamped to 24.0 and 30.0 psi
    expect(repairedSections[0].items[0].value).toBe("24.0 psi");
    expect(repairedSections[0].items[1].value).toBe("30.0 psi");

    expect(report.repairs).toHaveLength(2);
    expect(report.repairs[0].reason).toContain("Exceeded minimum limit (24)");
    expect(report.repairs[1].reason).toContain("Exceeded maximum limit (30)");
    expect(report.isValid).toBe(true); // Repairs do not invalidate the setup
  });

  it("characterizes step-grid snapping", () => {
    // Step is 0.1. A value of 26.23 should snap to 26.2
    const baseline = createMockBaseline([{ label: "Tyre Pressure FL", value: "26.0 psi" }]);
    const rawSections: SetupSection[] = [
      {
        title: "TYRES",
        items: [{ label: "Tyre Pressure FL", value: "26.23 psi" }],
      },
    ];

    const ctx: ValidationContext = {
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R",
      catalog,
      baseline,
    };

    const { repairedSections, report } = validateAndRepairSetup(rawSections, ctx);

    expect(repairedSections[0].items[0].value).toBe("26.2 psi");
    expect(report.repairs[0].reason).toContain("Snapped to authentic slider step (0.1)");
    expect(report.isValid).toBe(true);
  });

  it("characterizes delta-limit enforcement", () => {
    // Parameter catalog ID for "Tyre Pressure FL" is "TYRE_PRESSURE_FL"
    // Baseline is 26.0. If maxAbsDelta is 0.4 and proposed value is 27.5, should clamp to 26.4
    const baseline = createMockBaseline([{ label: "Tyre Pressure FL", value: "26.0 psi" }]);
    const rawSections: SetupSection[] = [
      {
        title: "TYRES",
        items: [{ label: "Tyre Pressure FL", value: "27.5 psi" }],
      },
    ];

    const ctx: ValidationContext = {
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R",
      catalog,
      baseline,
      maxDeltas: {
        TYRE_PRESSURE_FL: { maxSteps: 4, maxAbsDelta: 0.4 },
      },
    };

    const { repairedSections, report } = validateAndRepairSetup(rawSections, ctx);

    expect(repairedSections[0].items[0].value).toBe("26.4 psi");
    expect(report.repairs[0].reason).toContain("Exceeded conservative delta limit (max ±0.4)");
  });

  it("characterizes baseline-locking behavior for non-targeted parameters", () => {
    // If allowedTargetParams contains only TYRE_PRESSURE_FL, then TYRE_PRESSURE_FR must revert to baseline
    const baseline = createMockBaseline([
      { label: "Tyre Pressure FL", value: "26.0 psi" },
      { label: "Tyre Pressure FR", value: "26.0 psi" },
    ]);

    const rawSections: SetupSection[] = [
      {
        title: "TYRES",
        items: [
          { label: "Tyre Pressure FL", value: "26.5 psi" },
          { label: "Tyre Pressure FR", value: "28.0 psi" }, // Not allowed to change
        ],
      },
    ];

    const ctx: ValidationContext = {
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R",
      catalog,
      baseline,
      allowedTargetParams: ["TYRE_PRESSURE_FL"],
    };

    const { repairedSections, report } = validateAndRepairSetup(rawSections, ctx);

    expect(repairedSections[0].items[0].value).toBe("26.5 psi"); // Allowed change preserved
    expect(repairedSections[0].items[1].value).toBe("26.0 psi"); // Reverted to baseline
    expect(report.repairs.some((r) => r.reason.includes("Non-cause parameter locked to baseline"))).toBe(true);
  });

  it("characterizes rejection and isValid semantics", () => {
    // 1. Unknown parameter not in catalog nor baseline -> rejected, isValid = false
    const baseline = createMockBaseline([{ label: "Tyre Pressure FL", value: "26.0 psi" }]);
    const rawSectionsWithUnknown: SetupSection[] = [
      {
        title: "EXPERIMENTAL",
        items: [{ label: "Warp Drive Injector", value: "99.9" }],
      },
    ];

    const ctxUnknown: ValidationContext = {
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R",
      catalog,
      baseline,
    };

    const resultUnknown = validateAndRepairSetup(rawSectionsWithUnknown, ctxUnknown);
    expect(resultUnknown.report.isValid).toBe(false);
    expect(resultUnknown.report.rejected).toHaveLength(1);
    expect(resultUnknown.report.rejected[0].reason).toContain("is not an authentic control in Assetto Corsa Competizione. Rejected.");

    // 2. Formula car ABS / TC rejection -> rejected, isValid = false
    const formulaCatalog = getAuthoritativeCatalog("Assetto Corsa", "Ferrari SF-24");
    const formulaBaseline = createMockBaseline([{ label: "Brake Bias", value: "56%" }]);
    const formulaSections: SetupSection[] = [
      {
        title: "ELECTRONICS",
        items: [{ label: "ABS", value: "4" }],
      },
    ];

    const ctxFormula: ValidationContext = {
      game: "Assetto Corsa",
      car: "Lotus Exos 125 (Formula)",
      catalog: formulaCatalog,
      baseline: formulaBaseline,
    };

    const resultFormula = validateAndRepairSetup(formulaSections, ctxFormula);
    expect(resultFormula.report.isValid).toBe(false);
    expect(resultFormula.report.rejected[0].reason).toBe(
      "ABS / TC are strictly prohibited on modern Formula cars by regulation."
    );
  });

  it("characterizes CURRENT GT3 diff repair and coherence warning", () => {
    // In GT3 cars with adjustable power/coast diff (e.g. Assetto Corsa GT3 using AC catalog):
    // If diffPower > diffCoast, power lock is equalized to "30%"
    const acCatalog = AC_FORMULA_PARAMETERS;
    const baseline = createMockBaseline([
      { label: "Diff Power", value: "30%" },
      { label: "Diff Coast", value: "50%" },
    ]);

    const rawSections: SetupSection[] = [
      {
        title: "DRIVETRAIN",
        items: [
          { label: "Diff Power", value: "60%" }, // 60 > 40
          { label: "Diff Coast", value: "40%" },
        ],
      },
    ];

    const ctx: ValidationContext = {
      game: "Assetto Corsa",
      car: "Ferrari 488 GT3", // Matches /gt3/i so isGT3 = true
      catalog: acCatalog,
      baseline,
    };

    const { repairedSections, report } = validateAndRepairSetup(rawSections, ctx);

    // Diff power should be repaired to "30%"
    const diffPowerItem = repairedSections[0].items.find((it) => /diff power/i.test(it.label));
    expect(diffPowerItem?.value).toBe("30%");

    // Coherence warning and repair reason
    expect(report.coherenceWarnings).toContain(
      "GT3 diff power lock was higher than coast lock, causing extreme exit understeer and entry instability. Equalized power lock to 30%."
    );
    expect(report.repairs.some((r) => r.reason === "Corrected inverted GT3 differential lock ratio.")).toBe(true);

    // Because no item was rejected, isValid remains true
    expect(report.isValid).toBe(true);
  });
});
