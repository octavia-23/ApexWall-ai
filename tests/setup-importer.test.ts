import { describe, it, expect } from "vitest";
import {
  parseSetupFileContent,
  parseACCSetupJson,
  parseAssettoCorsaINI,
  parseSVMSetup,
  parseF1SetupJson,
} from "@/lib/setup-importer";
import { buildBaselineSetup } from "@/lib/setup-engine/baseline-generator";

describe("Reverse Setup Ingestion Subsystem", () => {
  // --------------------------------------------------------------------------
  // 1. Assetto Corsa Competizione (ACC) JSON Setup Ingestion
  // --------------------------------------------------------------------------
  describe("ACC JSON Ingestion", () => {
    const accJsonPayload = {
      carName: "porsche_992_gt3_r",
      basicSetup: {
        tyres: {
          tyreCompound: 0,
          tyrePressure: [65, 68, 62, 64], // in ACC units: 20 + 6.5 = 26.5 psi, etc.
        },
        alignment: {
          camber: [35, 35, 28, 28],
          toe: [42, 42, 65, 65],
          staticCamber: [-3.5, -3.5, -2.8, -2.8],
          toeOutLinear: [-0.08, -0.08, 0.15, 0.15],
          casterLF: 15,
          casterRF: 15,
          steerRatio: 13,
        },
        electronics: {
          tC1: 4,
          tC2: 2,
          abs: 3,
          eCUMap: 1,
        },
        strategy: {
          fuel: 52,
        },
      },
      advancedSetup: {
        mechanicalBalance: {
          aRBFront: 4,
          aRBRear: 2,
          wheelRate: [175000, 175000, 140000, 140000],
          bumpStopRateUp: [1200, 1200, 1000, 1000],
          bumpStopWindow: [15, 15, 20, 20],
          brakeTorque: 100,
          brakeBias: 54.5,
        },
        dampers: {
          bumpSlow: [7, 7, 5, 5],
          bumpFast: [13, 13, 10, 10],
          reboundSlow: [8, 8, 6, 6],
          reboundFast: [15, 15, 12, 12],
        },
        aeroBalance: {
          rideHeight: [52, 52, 68, 68],
          splitter: 0,
          rearWing: 8,
          brakeDuct: [2, 2],
        },
        drivetrain: {
          preload: 70,
        },
      },
    };

    it("parses ACC JSON into calibrated garage tabs with authentic vehicle name", () => {
      const parsed = parseSetupFileContent(JSON.stringify(accJsonPayload), "spa_quali_porsche992.json");

      expect(parsed.format).toBe("ACC_JSON");
      expect(parsed.game).toBe("Assetto Corsa Competizione");
      expect(parsed.car).toBe("Porsche 911 GT3 R (992)");
      expect(parsed.rawParameterCount).toBeGreaterThan(15);

      const tyreSec = parsed.sections.find((s) => s.title === "TYRES");
      expect(tyreSec).toBeDefined();

      const flPress = tyreSec?.items.find((i) => i.label === "Front Left Pressure");
      expect(flPress?.value).toBe("26.5 psi");

      const camber = tyreSec?.items.find((i) => i.label === "Camber LF / RF");
      expect(camber?.value).toBe("-3.5° / -3.5°");

      const elecSec = parsed.sections.find((s) => s.title === "ELECTRONICS");
      expect(elecSec?.items.find((i) => i.label.includes("TC1"))?.value).toBe("4");
      expect(elecSec?.items.find((i) => i.label === "Fuel Load")?.value).toBe("52 L");

      const mechSec = parsed.sections.find((s) => s.title === "MECHANICAL GRIP");
      expect(mechSec?.items.find((i) => i.label === "Anti-Roll Bar Front")?.value).toBe("4");
      expect(mechSec?.items.find((i) => i.label === "Differential Preload")?.value).toBe("70 Nm");
      expect(mechSec?.items.find((i) => i.label === "Brake Bias")?.value).toBe("54.5%");

      const aeroSec = parsed.sections.find((s) => s.title === "AERO");
      expect(aeroSec?.items.find((i) => i.label === "Front Ride Height")?.value).toBe("52 mm");
      expect(aeroSec?.items.find((i) => i.label === "Rear Ride Height")?.value).toBe("68 mm");
      expect(aeroSec?.items.find((i) => i.label === "Rake")?.value).toBe("+16 mm");
      expect(aeroSec?.items.find((i) => i.label === "Rear Wing")?.value).toBe("8");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Assetto Corsa (AC) .INI Setup Ingestion
  // --------------------------------------------------------------------------
  describe("Assetto Corsa .INI Ingestion", () => {
    const acIniText = `
[CAR]
MODEL=ks_ferrari_488_gt3

[TYRES]
VALUE=0

[PRESSURE_LF]
VALUE=17.5

[PRESSURE_RF]
VALUE=17.0

[PRESSURE_LR]
VALUE=16.0

[PRESSURE_RR]
VALUE=16.5

[CAMBER_LF]
VALUE=-32   ; -3.2 degrees

[CAMBER_RF]
VALUE=-32

[TOE_OUT_LF]
VALUE=5

[TOE_OUT_RF]
VALUE=5

[CAMBER_LR]
VALUE=-24

[CAMBER_RR]
VALUE=-24

[TOE_OUT_LR]
VALUE=4

[TOE_OUT_RR]
VALUE=4

[ARB_FRONT]
VALUE=6

[ARB_REAR]
VALUE=3

[SPRING_RATE_LF]
VALUE=125

[SPRING_RATE_LR]
VALUE=110

[DAMP_BUMP_LF]
VALUE=8

[DAMP_REBOUND_LF]
VALUE=7

[DIFF_POWER]
VALUE=30

[DIFF_COAST]
VALUE=50

[DIFF_PRELOAD]
VALUE=40

[WING_2]
VALUE=7

[FRONT_BIAS]
VALUE=64

[TRACTION_CONTROL]
VALUE=5

[ABS]
VALUE=6
`;

    it("parses Assetto Corsa .ini and scales camber from tenths (-32 -> -3.2°)", () => {
      const parsed = parseSetupFileContent(acIniText, "ferrari_488_monza.ini");

      expect(parsed.format).toBe("AC_INI");
      expect(parsed.game).toBe("Assetto Corsa");
      expect(parsed.car).toContain("Ferrari 488 Gt3");

      const tyres = parsed.sections.find((s) => s.title === "TYRES");
      expect(tyres?.items.find((i) => i.label === "Front Left Pressure")?.value).toBe("17.5 psi");

      const align = parsed.sections.find((s) => s.title === "ALIGNMENT");
      expect(align?.items.find((i) => i.label === "Camber LF / RF")?.value).toBe("-3.2° / -3.2°");
      expect(align?.items.find((i) => i.label === "Camber LR / RR")?.value).toBe("-2.4° / -2.4°");

      const susp = parsed.sections.find((s) => s.title === "SUSPENSION");
      expect(susp?.items.find((i) => i.label === "Antiroll Bar Front")?.value).toBe("6");
      expect(susp?.items.find((i) => i.label === "Front Wheel Rate")?.value).toBe("125 N/mm");

      const diff = parsed.sections.find((s) => s.title === "DRIVETRAIN");
      expect(diff?.items.find((i) => i.label === "Diff Power")?.value).toBe("30%");
      expect(diff?.items.find((i) => i.label === "Diff Coast")?.value).toBe("50%");

      const aero = parsed.sections.find((s) => s.title === "AERO");
      expect(aero?.items.find((i) => i.label.includes("Wing 2"))?.value).toBe("7");
    });
  });

  // --------------------------------------------------------------------------
  // 3. rFactor 2 / Le Mans Ultimate / Automobilista 2 .SVM Ingestion
  // --------------------------------------------------------------------------
  describe("ISI / rF2 / LMU .SVM Ingestion", () => {
    const svmText = `
//[[gFID]] Setup File
[CAR]
Type="Ferrari 499P Hypercar"

[GENERAL]
Fuel="75.000000"
FrontWing="2"
RearWing="6"
BrakeBias="53.500000"
Track="Circuit de la Sarthe"

[FRONTLEFT]
Pressure="170.000000"
Camber="-3.200000"
Toe="-0.050000"
SpringRate="180.000000"
SlowBump="8"
SlowRebound="7"
RideHeight="48.000000"

[FRONTRIGHT]
Pressure="170.000000"
Camber="-3.200000"

[REARLEFT]
Pressure="165.000000"
Camber="-2.200000"
SpringRate="150.000000"
RideHeight="58.000000"

[DRIVETRAIN]
DifferentialPreload="55"
DifferentialPower="35"
DifferentialCoast="45"

[SUSPENSION]
FrontAntiRollBar="4"
RearAntiRollBar="2"
`;

    it("parses Le Mans Ultimate .svm setup correctly with sections and units", () => {
      const parsed = parseSetupFileContent(svmText, "lemans_499p_race.svm");

      expect(parsed.format).toBe("SVM");
      expect(parsed.game).toBe("Le Mans Ultimate");
      expect(parsed.car).toBe("Ferrari 499P Hypercar");
      expect(parsed.track).toBe("Circuit de la Sarthe");

      const tyres = parsed.sections.find((s) => s.title === "TYRES & ALIGNMENT");
      expect(tyres?.items.find((i) => i.label === "Front Left Pressure")?.value).toBe("170.0 psi");
      expect(tyres?.items.find((i) => i.label === "Front Camber")?.value).toBe("-3.2°");

      const susp = parsed.sections.find((s) => s.title === "CHASSIS & SUSPENSION");
      expect(susp?.items.find((i) => i.label === "Front Anti-Roll Bar")?.value).toBe("4");
      expect(susp?.items.find((i) => i.label === "Front Spring Rate")?.value).toBe("180 N/mm");
      expect(susp?.items.find((i) => i.label === "Front Ride Height")?.value).toBe("48.0 mm");

      const diff = parsed.sections.find((s) => s.title === "DRIVETRAIN & BRAKES");
      expect(diff?.items.find((i) => i.label === "Diff Power")?.value).toBe("35%");
      expect(diff?.items.find((i) => i.label === "Brake Bias")?.value).toBe("53.5%");
    });
  });

  // --------------------------------------------------------------------------
  // 4. EA Sports F1 JSON Ingestion
  // --------------------------------------------------------------------------
  describe("EA Sports F1 JSON Ingestion", () => {
    const f1Payload = {
      game: "F1 24",
      car: "Ferrari SF-24",
      aerodynamics: {
        frontWingAerodynamics: 24,
        rearWingAerodynamics: 18,
      },
      transmission: {
        differentialAdjustmentOnThrottle: 55,
        differentialAdjustmentOffThrottle: 50,
      },
      suspensionGeometry: {
        frontCamber: -3.5,
        rearCamber: -2.2,
      },
      suspension: {
        frontAntiRollBar: 12,
        rearAntiRollBar: 6,
        frontRideHeight: 33,
        rearRideHeight: 40,
      },
      brakes: {
        brakePressure: 100,
        frontBrakeBias: 54,
      },
      tyres: {
        frontLeftTyrePressure: 23.5,
        rearLeftTyrePressure: 21.0,
      },
    };

    it("parses EA Sports F1 JSON into authentic F1 garage categories", () => {
      const parsed = parseSetupFileContent(JSON.stringify(f1Payload), "monza_f1.json");

      expect(parsed.format).toBe("F1_JSON");
      expect(parsed.game).toBe("F1 24");
      expect(parsed.car).toBe("Ferrari SF-24");

      const aero = parsed.sections.find((s) => s.title === "AERODYNAMICS");
      expect(aero?.items.find((i) => i.label === "Front Wing Aero")?.value).toBe("24");

      const trans = parsed.sections.find((s) => s.title === "TRANSMISSION");
      expect(trans?.items.find((i) => i.label === "Diff On-Throttle")?.value).toBe("55%");

      const brakes = parsed.sections.find((s) => s.title === "BRAKES");
      expect(brakes?.items.find((i) => i.label === "Brake Bias")?.value).toBe("54%");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Invariant Test: Ingested Baseline Preservation in Baseline Engine
  // --------------------------------------------------------------------------
  describe("Invariant: Baseline Engine Integration", () => {
    it("preserves 100% of imported parameters when passed to buildBaselineSetup", () => {
      const accJsonPayload = {
        carName: "porsche_992_gt3_r",
        basicSetup: {
          tyres: { tyrePressure: [60, 60, 58, 58] },
          alignment: { casterLF: 15, steerRatio: 13 },
        },
        advancedSetup: {
          mechanicalBalance: { aRBFront: 5, aRBRear: 1, brakeBias: 56.0 },
          drivetrain: { preload: 80 },
        },
      };

      const parsed = parseSetupFileContent(JSON.stringify(accJsonPayload), "custom_baseline.json");

      // Pass parsed sections to baseline generator
      const baselineContext = buildBaselineSetup(
        "Assetto Corsa Competizione",
        parsed.car,
        "Monza",
        { sessionType: "Qualifying" },
        { summary: parsed.summary, sections: parsed.sections }
      );

      expect(baselineContext.isBaseline).toBe(false);
      expect(baselineContext.sections.length).toBe(parsed.sections.length);

      // Verify individual parameters preserved
      const frontArb = baselineContext.parameterMap.get("anti-roll bar front");
      expect(frontArb).toBeDefined();
      expect(frontArb?.value).toBe("5");
      expect(frontArb?.numericVal).toBe(5);

      const brakeBias = baselineContext.parameterMap.get("brake bias");
      expect(brakeBias).toBeDefined();
      expect(brakeBias?.value).toBe("56%");
      expect(brakeBias?.numericVal).toBe(56);

      const preload = baselineContext.parameterMap.get("differential preload");
      expect(preload).toBeDefined();
      expect(preload?.value).toBe("80 Nm");
      expect(preload?.numericVal).toBe(80);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Error Handling & Edge Cases
  // --------------------------------------------------------------------------
  describe("Error Handling", () => {
    it("throws a clear error on completely invalid non-setup files", () => {
      expect(() => {
        parseSetupFileContent("Just some random text without any setup keys", "random.txt");
      }).toThrow(/Unrecognized setup file format/);
    });

    it("parses fallback plain text key-value pairs gracefully", () => {
      const text = `
Front Wing: 22
Rear Wing: 14
Brake Bias: 54.5%
Tyre Pressure: 26.5 psi
`;
      const parsed = parseSetupFileContent(text, "setup_notes.txt");
      expect(parsed.format).toBe("UNKNOWN");
      expect(parsed.rawParameterCount).toBe(4);
      expect(parsed.sections[0].items.find((i) => i.label === "Front Wing")?.value).toBe("22");
    });
  });
});
