import { describe, it, expect } from "vitest";
import { extractTelemetryEvidence, formulateDiagnosticPlan } from "@/lib/setup-engine/causal-diagnostics";
import { generateCalibratedSetup } from "@/lib/setup-engine/engine";
import { getAuthoritativeCatalog } from "@/lib/setup-engine/parameter-catalog";

describe("Closed-Loop Telemetry to Setup Integration Engine", () => {
  const catalog = getAuthoritativeCatalog("Assetto Corsa Competizione", "Ferrari 296 GT3");

  describe("extractTelemetryEvidence", () => {
    it("extracts damper histogram asymmetry and packing down flags", () => {
      const telemetryContext = {
        damperHistograms: {
          corners: {
            FL: { bumpPct: 64, reboundPct: 36, isPackingDown: true },
            FR: { bumpPct: 62, reboundPct: 38, isPackingDown: true },
            RL: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
            RR: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
          },
          overallVerdict: "Front compression over-damped",
        },
      };

      const evidence = extractTelemetryEvidence(telemetryContext);
      expect(evidence.hasTelemetry).toBe(true);
      expect(evidence.observedPhenomena.some((p) => p.includes("Front compression over-damping"))).toBe(true);
    });

    it("extracts dynamic aero ride height collapse and splitter grounding", () => {
      const telemetryContext = {
        aeroMap: {
          minFrontRideHeightMm: 4.2,
          maxRearRideHeightMm: 85.0,
          staticRakeMm: 22.0,
          groundingEvents: [{ severity: "HIGH", minRideHeightMm: 4.2 }],
        },
      };

      const evidence = extractTelemetryEvidence(telemetryContext);
      expect(evidence.hasTelemetry).toBe(true);
      expect(evidence.observedPhenomena.some((p) => p.includes("Critical front ride height collapse"))).toBe(true);
    });

    it("extracts endurance tyre degradation and limiting corner", () => {
      const telemetryContext = {
        enduranceStrategy: {
          tyreDegradation: {
            degradationRatePerLapSeconds: 0.125,
            limitingTyreCorner: "FL",
          },
        },
      };

      const evidence = extractTelemetryEvidence(telemetryContext);
      expect(evidence.hasTelemetry).toBe(true);
      expect(evidence.observedPhenomena.some((p) => p.includes("Elevated degradation rate"))).toBe(true);
    });
  });

  describe("formulateDiagnosticPlan target parameter inclusion", () => {
    it("includes damper parameters in target list when damper packing down is detected", () => {
      const telemetryContext = {
        damperHistograms: {
          corners: {
            FL: { bumpPct: 65, reboundPct: 35, isPackingDown: true },
            FR: { bumpPct: 65, reboundPct: 35, isPackingDown: true },
            RL: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
            RR: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
          },
        },
      };

      const plan = formulateDiagnosticPlan("Slight bump instability", catalog, telemetryContext);
      const allTargets = plan.primaryTargetParams.concat(plan.secondaryTargetParams);
      expect(allTargets.some((t) => t.includes("BUMP_SLOW_F") || t.includes("REBOUND_SLOW_F"))).toBe(true);
    });

    it("includes front ride height in target list when aero platform bottoming is detected", () => {
      const telemetryContext = {
        aeroMap: {
          minFrontRideHeightMm: 4.0,
          groundingEvents: [{ severity: "HIGH" }],
        },
      };

      const plan = formulateDiagnosticPlan("Car feels loose at high speed", catalog, telemetryContext);
      const allTargets = plan.primaryTargetParams.concat(plan.secondaryTargetParams);
      expect(allTargets.some((t) => t.includes("RIDE_HEIGHT_F") || t.includes("FRONT_RIDE_HEIGHT"))).toBe(true);
    });
  });

  describe("generateCalibratedSetup closed-loop adjustments", () => {
    it("automatically softens front slow bump when front damper histograms are packing down", async () => {
      const result = await generateCalibratedSetup({
        game: "Assetto Corsa Competizione",
        car: "Ferrari 296 GT3",
        track: "Circuit de Spa-Francorchamps",
        handlingIssue: "Analyze telemetry and optimize platform",
        telemetryContext: {
          damperHistograms: {
            corners: {
              FL: { bumpPct: 65, reboundPct: 35, isPackingDown: true },
              FR: { bumpPct: 65, reboundPct: 35, isPackingDown: true },
              RL: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
              RR: { bumpPct: 50, reboundPct: 50, isPackingDown: false },
            },
          },
        },
      });

      expect(result.changes.length).toBeGreaterThan(0);
      const damperChange = result.changes.find(
        (c) => c.parameter.toLowerCase().includes("bump slow front") || c.parameter.toLowerCase().includes("bump front")
      );
      expect(damperChange).toBeDefined();
      expect(damperChange?.diagnosis).toContain("MoTeC damper histogram detected front compression over-damping");
    });

    it("automatically raises front ride height when dynamic aero map detects splitter bottoming", async () => {
      const result = await generateCalibratedSetup({
        game: "Assetto Corsa Competizione",
        car: "Ferrari 296 GT3",
        track: "Circuit de Spa-Francorchamps",
        handlingIssue: "High speed braking stability",
        telemetryContext: {
          aeroMap: {
            minFrontRideHeightMm: 4.1,
            groundingEvents: [{ severity: "HIGH" }],
          },
        },
      });

      const rideHeightChange = result.changes.find(
        (c) => c.parameter.toLowerCase().includes("front ride height")
      );
      expect(rideHeightChange).toBeDefined();
      expect(rideHeightChange?.diagnosis).toContain("Dynamic Aero Map detected front platform collapse");
    });

    it("automatically trims front camber when tyre degradation is critical", async () => {
      const result = await generateCalibratedSetup({
        game: "Assetto Corsa Competizione",
        car: "Ferrari 296 GT3",
        track: "Circuit de Spa-Francorchamps",
        handlingIssue: "Endurance tyre wear balance",
        telemetryContext: {
          enduranceStrategy: {
            tyreDegradation: {
              degradationRatePerLapSeconds: 0.12,
              limitingTyreCorner: "FL",
            },
          },
        },
      });

      const camberChange = result.changes.find(
        (c) => c.parameter.toLowerCase().includes("camber") && c.parameter.toLowerCase().includes("front")
      );
      expect(camberChange).toBeDefined();
      expect(camberChange?.diagnosis).toContain("Endurance degradation rate is critical");
    });
  });
});
