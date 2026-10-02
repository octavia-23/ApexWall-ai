'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Thermometer, 
  Wind, 
  Fuel, 
  CloudRain, 
  Sun, 
  Sparkles, 
  ArrowRight, 
  Check, 
  RotateCcw, 
  SlidersHorizontal,
  Flame,
  Download,
  BookmarkPlus,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { SetupSection } from '@/types/telemetry';
import { SetupExportContext } from '@/lib/setup-exporter';
import { 
  morphSetupConditions, 
  MorphInputConditions, 
  MorphResult 
} from '@/lib/setup-morph-engine';
import { saveSetupToVault } from '@/lib/setup-vault';

interface SetupMorphModalProps {
  context: SetupExportContext;
  isOpen: boolean;
  onClose: () => void;
  onApplyMorphedSetup: (newSections: SetupSection[], summaryNote: string) => void;
  onOpenExportModal?: (morphedContext: SetupExportContext) => void;
}

export const SetupMorphModal: React.FC<SetupMorphModalProps> = ({
  context,
  isOpen,
  onClose,
  onApplyMorphedSetup,
  onOpenExportModal,
}) => {
  // Extract initial baseline numbers from context
  const parseInitNum = (str?: string, fallback: number = 28) => {
    if (!str) return fallback;
    const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
    return match ? parseFloat(match[0]) : fallback;
  };

  const initialTrackTemp = parseInitNum(context.trackTemp, 30);
  const initialAirTemp = parseInitNum(context.airTemp, 22);
  const initialFuel = parseInitNum(context.fuelLoad, 35);

  // Baseline conditions
  const baselineConditions: MorphInputConditions = useMemo(() => ({
    trackTemp: initialTrackTemp,
    airTemp: initialAirTemp,
    weather: context.weather?.toLowerCase().includes("wet") ? "wet" : "optimum",
    fuelLiters: initialFuel,
  }), [initialTrackTemp, initialAirTemp, initialFuel, context.weather]);

  // Target target state
  const [targetTrackTemp, setTargetTrackTemp] = useState<number>(initialTrackTemp);
  const [targetAirTemp, setTargetAirTemp] = useState<number>(initialAirTemp);
  const [targetWeather, setTargetWeather] = useState<"optimum" | "greasy" | "green" | "damp" | "wet">("optimum");
  const [targetFuel, setTargetFuel] = useState<number>(initialFuel);

  const [savedToVaultToast, setSavedToVaultToast] = useState(false);
  const [appliedToast, setAppliedToast] = useState(false);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate live morph result
  const morphResult: MorphResult = useMemo(() => {
    return morphSetupConditions(
      context.sections,
      baselineConditions,
      {
        trackTemp: targetTrackTemp,
        airTemp: targetAirTemp,
        weather: targetWeather,
        fuelLiters: targetFuel,
      }
    );
  }, [context.sections, baselineConditions, targetTrackTemp, targetAirTemp, targetWeather, targetFuel]);

  if (!isOpen) return null;

  const deltaTrack = targetTrackTemp - baselineConditions.trackTemp;
  const deltaFuel = targetFuel - baselineConditions.fuelLiters;

  const handleApply = () => {
    onApplyMorphedSetup(morphResult.sections, morphResult.summaryNote);
    setAppliedToast(true);
    setTimeout(() => {
      setAppliedToast(false);
      onClose();
    }, 1200);
  };

  const handleSaveToVault = () => {
    saveSetupToVault({
      name: `${context.car} - ${context.track} (Morphed: ${targetTrackTemp}°C ${targetWeather.toUpperCase()})`,
      game: context.game || "Assetto Corsa",
      car: context.car,
      track: context.track,
      sessionType: context.sessionType || "Race",
      weather: targetWeather.toUpperCase(),
      trackTemp: `${targetTrackTemp}°C`,
      airTemp: `${targetAirTemp}°C`,
      tyreCompound: context.tyreCompound || "Slick",
      fuelLoad: `${targetFuel} L`,
      driverStyle: context.driverStyle,
      summary: `Dynamic Weather Morph: Adapted from ${baselineConditions.trackTemp}°C to ${targetTrackTemp}°C (${targetWeather}). ${morphResult.summaryNote}`,
      engineerNotes: `Thermal adaptation offset: ΔTrack ${deltaTrack > 0 ? "+" : ""}${deltaTrack}°C. Adjusted ${morphResult.totalChangesCount} parameters.`,
      sections: morphResult.sections,
    });

    setSavedToVaultToast(true);
    setTimeout(() => setSavedToVaultToast(false), 2000);
  };

  const handleExport = () => {
    if (onOpenExportModal) {
      const morphedCtx: SetupExportContext = {
        ...context,
        trackTemp: `${targetTrackTemp}°C`,
        airTemp: `${targetAirTemp}°C`,
        fuelLoad: `${targetFuel} L`,
        weather: targetWeather.toUpperCase(),
        summary: `Morphed Setup (${targetTrackTemp}°C · ${targetWeather}) - ${morphResult.summaryNote}`,
        sections: morphResult.sections,
      };
      onOpenExportModal(morphedCtx);
    }
  };

  const handleReset = () => {
    setTargetTrackTemp(baselineConditions.trackTemp);
    setTargetAirTemp(baselineConditions.airTemp);
    setTargetWeather(baselineConditions.weather);
    setTargetFuel(baselineConditions.fuelLiters);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#090C14] border border-white/10 rounded-lg shadow-xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0E1320]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white font-sans">
                  Setup Morph
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Weather & Temp Compensation
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Adapts baseline setup thermodynamics, brake cooling, and mechanical rake to new session conditions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.04] transition-colors flex items-center gap-1.5"
              title="Reset target sliders to original baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Target Conditions Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0E1320] border border-white/[0.06] p-4 rounded-xl">
            {/* 1. Track Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-rose-400" />
                  Target Track Temp:
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sm font-bold text-white">{targetTrackTemp}°C</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${
                    deltaTrack > 0 
                      ? "bg-rose-500/20 text-rose-300" 
                      : deltaTrack < 0 
                      ? "bg-sky-500/20 text-sky-300" 
                      : "bg-white/10 text-slate-400"
                  }`}>
                    {deltaTrack > 0 ? `+${deltaTrack}°C HOTTER` : deltaTrack < 0 ? `${deltaTrack}°C COLDER` : "BASELINE"}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="12"
                max="52"
                step="1"
                value={targetTrackTemp}
                onChange={(e) => setTargetTrackTemp(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>12°C (Freezing)</span>
                <span>28°C (Baseline)</span>
                <span>52°C (Scorching)</span>
              </div>
            </div>

            {/* 2. Ambient / Air Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  Target Air Temp:
                </span>
                <span className="font-mono text-sm font-bold text-white">{targetAirTemp}°C</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="1"
                value={targetAirTemp}
                onChange={(e) => setTargetAirTemp(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>10°C (Cold Air)</span>
                <span>22°C (Moderate)</span>
                <span>40°C (Tropical)</span>
              </div>
            </div>

            {/* 3. Surface & Weather Condition Pills */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-medium text-slate-300">
                Track Grip & Surface State:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "optimum", label: "Optimum Dry", desc: "100% Grip", dot: "bg-emerald-400" },
                  { id: "greasy", label: "Greasy Hot", desc: "Thermal Slide", dot: "bg-amber-400" },
                  { id: "green", label: "Green Track", desc: "Low Grip", dot: "bg-emerald-500" },
                  { id: "damp", label: "Damp / Mixed", desc: "Slick Kerbs", dot: "bg-cyan-400" },
                  { id: "wet", label: "Heavy Wet", desc: "Standing Water", dot: "bg-blue-400" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetWeather(item.id as any)}
                    className={`p-2 rounded-md text-left border transition-colors ${
                      targetWeather === item.id
                        ? "bg-blue-600/20 border-blue-500 text-white"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    <div className="text-xs font-semibold flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
                      <span>{item.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Fuel Load / Stint Stint Slider */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-400" />
                  Stint Fuel Load:
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sm font-bold text-amber-300">{targetFuel} Litres</span>
                  <span className="text-[11px] text-slate-400">
                    ({deltaFuel > 0 ? `+${deltaFuel}L Heavy` : deltaFuel < 0 ? `${deltaFuel}L Light` : "Baseline"})
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={targetFuel}
                onChange={(e) => setTargetFuel(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>10L (Quali Shootout)</span>
                <span>35L (Sprint 25m)</span>
                <span>65L (1h Race)</span>
                <span>120L (Endurance Tank)</span>
              </div>
            </div>
          </div>

          {/* Live Diff Summary Banner */}
          <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <strong>Morph Adaptation Summary: </strong>
                <span>{morphResult.summaryNote}</span>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-300 text-xs font-mono font-bold whitespace-nowrap">
              {morphResult.totalChangesCount} PARAMETERS TUNED
            </div>
          </div>

          {/* Changed Parameters Live Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Calibrated Changes ({morphResult.diffs.length} items):</span>
              <span className="text-[10px] text-slate-500 font-sans">Real-time thermodynamic compensation</span>
            </h3>

            {morphResult.diffs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-white/[0.06] rounded-xl">
                No setup adjustments needed for these conditions. Move the sliders to test temperature and weather shifts.
              </div>
            ) : (
              <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0B0F19]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.04] text-[10px] uppercase font-mono text-slate-400 border-b border-white/[0.08]">
                      <th className="py-2.5 px-3">Setup Parameter</th>
                      <th className="py-2.5 px-3">Baseline</th>
                      <th className="py-2.5 px-3"></th>
                      <th className="py-2.5 px-3">Morphed Target</th>
                      <th className="py-2.5 px-3">Delta Offset</th>
                      <th className="py-2.5 px-3 hidden md:table-cell">Engineering Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {morphResult.diffs.map((diff, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-200">
                          <div>{diff.label}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{diff.category}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {diff.originalValue}
                        </td>
                        <td className="py-2 px-1 text-slate-600">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-white">
                          {diff.morphedValue}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            diff.changeDelta.startsWith("+")
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                          }`}>
                            {diff.changeDelta}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-400 hidden md:table-cell">
                          {diff.rationale}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-[#0E1320] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {appliedToast && (
              <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> Setup applied to current session!
              </span>
            )}
            {savedToVaultToast && (
              <span className="text-xs font-medium text-blue-400 flex items-center gap-1">
                <BookmarkPlus className="w-4 h-4" /> Saved to Setup Vault!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveToVault}
              className="px-3.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5"
              title="Save morphed variation as a separate setup in your Vault"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-blue-400" />
              <span>Save to Vault</span>
            </button>

            {onOpenExportModal && (
              <button
                type="button"
                onClick={handleExport}
                className="px-3.5 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5"
                title="Export morphed setup straight to Assetto Corsa or other sims"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export to Sim</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Morphed Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
