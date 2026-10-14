"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  parseSetupFileContent,
  ParsedSetupFile,
} from "@/lib/setup-importer";
import { saveSetupToVault } from "@/lib/setup-vault";

interface SetupIngestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyBaseline: (parsed: ParsedSetupFile) => void;
  onDiscussWithEngineer?: (parsed: ParsedSetupFile) => void;
}

const SAMPLE_PRESETS: { name: string; sim: string; filename: string; content: string }[] = [
  {
    name: "ACC GT3 — Porsche 992 @ Spa",
    sim: "Assetto Corsa Competizione",
    filename: "porsche_992_spa_quali.json",
    content: JSON.stringify(
      {
        carName: "porsche_992_gt3_r",
        basicSetup: {
          tyres: {
            tyreCompound: 0,
            tyrePressure: [65, 68, 62, 64],
          },
          alignment: {
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
      },
      null,
      2
    ),
  },
  {
    name: "Assetto Corsa — Ferrari 488 GT3 @ Monza",
    sim: "Assetto Corsa",
    filename: "ferrari_488_monza.ini",
    content: `[CAR]
MODEL=ks_ferrari_488_gt3

[PRESSURE_LF]
VALUE=17.5

[PRESSURE_RF]
VALUE=17.0

[PRESSURE_LR]
VALUE=16.0

[PRESSURE_RR]
VALUE=16.5

[CAMBER_LF]
VALUE=-32

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
VALUE=6`,
  },
  {
    name: "Le Mans Ultimate — Ferrari 499P @ Le Mans",
    sim: "Le Mans Ultimate",
    filename: "lemans_499p_race.svm",
    content: `//[[gFID]] Setup File
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
RearAntiRollBar="2"`,
  },
  {
    name: "F1 24 — Ferrari SF-24 @ Monza",
    sim: "F1 24",
    filename: "f1_24_ferrari_monza.json",
    content: JSON.stringify(
      {
        game: "F1 24",
        car: "Ferrari SF-24",
        track: "Monza",
        aerodynamics: {
          frontWingAerodynamics: 22,
          rearWingAerodynamics: 16,
        },
        transmission: {
          differentialAdjustmentOnThrottle: 55,
          differentialAdjustmentOffThrottle: 50,
          engineBraking: 100,
        },
        suspensionGeometry: {
          frontCamber: -3.5,
          rearCamber: -2.2,
          frontToeOut: 0.05,
          rearToeIn: 0.15,
        },
        suspension: {
          frontSuspension: 38,
          rearSuspension: 12,
          frontAntiRollBar: 14,
          rearAntiRollBar: 7,
          frontRideHeight: 34,
          rearRideHeight: 42,
        },
        brakes: {
          brakePressure: 100,
          frontBrakeBias: 54,
        },
        tyres: {
          frontLeftTyrePressure: 23.5,
          frontRightTyrePressure: 23.5,
          rearLeftTyrePressure: 21.0,
          rearRightTyrePressure: 21.0,
        },
      },
      null,
      2
    ),
  },
];

export const SetupIngestorModal: React.FC<SetupIngestorModalProps> = ({
  isOpen,
  onClose,
  onApplyBaseline,
  onDiscussWithEngineer,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState("");
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("upload");
  const [parsed, setParsed] = useState<ParsedSetupFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedGarageTab, setSelectedGarageTab] = useState<number>(0);
  const [vaultSaved, setVaultSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const res = parseSetupFileContent(text, file.name);
      setParsed(res);
      setSelectedGarageTab(0);
      setVaultSaved(false);
    } catch (err: any) {
      setError(err?.message || "Failed to parse setup file.");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handlePasteParse = () => {
    if (!rawText.trim()) {
      setError("Please paste setup file contents or code.");
      return;
    }
    setError(null);
    try {
      const res = parseSetupFileContent(rawText, "pasted_setup");
      setParsed(res);
      setSelectedGarageTab(0);
      setVaultSaved(false);
    } catch (err: any) {
      setError(err?.message || "Failed to recognize setup file format.");
    }
  };

  const handleLoadPreset = (preset: (typeof SAMPLE_PRESETS)[0]) => {
    setError(null);
    try {
      const res = parseSetupFileContent(preset.content, preset.filename);
      setParsed(res);
      setSelectedGarageTab(0);
      setVaultSaved(false);
    } catch (err: any) {
      setError(err?.message || "Failed to parse preset.");
    }
  };

  const handleApply = () => {
    if (!parsed) return;
    onApplyBaseline(parsed);
    onClose();
  };

  const handleDiscuss = () => {
    if (!parsed) return;
    onApplyBaseline(parsed);
    onDiscussWithEngineer?.(parsed);
    onClose();
  };

  const handleSaveToVault = () => {
    if (!parsed) return;
    saveSetupToVault({
      name: `${parsed.car} - ${parsed.setupName}`,
      game: parsed.game,
      car: parsed.car,
      track: parsed.track || "Imported Circuit",
      sessionType: "Imported Baseline",
      weather: "Dry",
      trackTemp: "30°C",
      airTemp: "22°C",
      summary: parsed.summary,
      engineerNotes: `Imported setup (${parsed.format} format).`,
      sections: parsed.sections,
    });
    setVaultSaved(true);
    setTimeout(() => setVaultSaved(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-xl border border-white/10 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[var(--bg-surface-elevated)]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Import Existing Setup
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Extract sliders from ACC (.json), Assetto Corsa (.ini), or rFactor 2 / LMU (.svm)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body Container */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Quick Test Presets */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Sample Pro Presets
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleLoadPreset(preset)}
                  className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-[#d4a373]/50 text-left transition-all"
                >
                  <div className="text-slate-200 font-medium truncate">
                    {preset.name}
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5">
                    {preset.sim} • {preset.filename}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex border-b border-white/10 gap-4 text-xs">
            <button
              type="button"
              className={`pb-2 transition-colors ${
                activeTab === "upload"
                  ? "border-b-2 border-[#d4a373] text-[#d4a373] font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("upload")}
            >
              Upload Setup File
            </button>
            <button
              type="button"
              className={`pb-2 transition-colors ${
                activeTab === "paste"
                  ? "border-b-2 border-[#d4a373] text-[#d4a373] font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              onClick={() => setActiveTab("paste")}
            >
              Paste Setup Text
            </button>
          </div>

          {/* Upload Dropzone */}
          {activeTab === "upload" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-[#d4a373] bg-[#d4a373]/10"
                  : "border-white/10 hover:border-white/20 bg-white/[0.02]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.ini,.svm,.xml,.pc,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processFile(e.target.files[0]);
                  }
                }}
              />
              <div className="text-slate-200 font-medium text-sm mb-1">
                Drop your setup file here, or click to browse
              </div>
              <div className="text-slate-400 text-[11px]">
                Supports .json (ACC, F1), .ini (Assetto Corsa, AC Evo), .svm (rFactor 2, LMU, AMS2)
              </div>
            </div>
          )}

          {/* Text Paste Area */}
          {activeTab === "paste" && (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste JSON setup payload, INI file lines, or key: value setup specs here..."
                rows={6}
                className="w-full text-[11.5px] bg-black/40 border border-white/10 rounded-lg p-3 text-slate-200 focus:outline-none focus:border-[#d4a373] placeholder:text-slate-600"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handlePasteParse}
                  className="action-btn action-btn-accent"
                >
                  Parse Setup Content
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded border border-rose-500/30 bg-rose-950/20 text-rose-300 text-[11.5px]">
              {error}
            </div>
          )}

          {/* Parsed Setup Inspection Drawer */}
          {parsed && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{parsed.car}</span>
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/10">
                      {parsed.game}
                    </span>
                    <span className="text-[10.5px] px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
                      {parsed.format}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Setup: <span className="text-slate-200">{parsed.setupName}</span> •{" "}
                    <span className="text-[#d4a373] font-medium">
                      {parsed.rawParameterCount} parameters extracted
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveToVault}
                    className="action-btn"
                  >
                    {vaultSaved ? "Saved to Vault ✓" : "Save to Vault"}
                  </button>
                </div>
              </div>

              {/* Garage Tabs Navigation */}
              <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-2">
                {parsed.sections.map((sec, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedGarageTab(i)}
                    className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                      selectedGarageTab === i
                        ? "bg-[#d4a373]/15 text-[#d4a373] border border-[#d4a373]/30 font-medium"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    {sec.title} ({sec.items.length})
                  </button>
                ))}
              </div>

              {/* Active Tab Sliders Display */}
              {parsed.sections[selectedGarageTab] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {parsed.sections[selectedGarageTab].items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5"
                    >
                      <span className="text-slate-400 text-[11px] truncate mr-2" title={item.label}>
                        {item.label}
                      </span>
                      <span className="text-slate-200 font-medium shrink-0">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-[11px] text-slate-400">
                  Ready to optimize handling, test telemetry, or discuss with engineer.
                </div>
                <div className="flex items-center gap-2">
                  {onDiscussWithEngineer && (
                    <button
                      type="button"
                      onClick={handleDiscuss}
                      className="action-btn"
                    >
                      Discuss with Engineer →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApply}
                    className="action-btn action-btn-accent font-semibold"
                  >
                    Set as Active Baseline ✓
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-[var(--bg-surface-elevated)] flex items-center justify-between text-[11px] text-slate-400">
          <span>ApexWall Setup Ingestion</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
