'use client';

import React, { useState, useMemo } from 'react';
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
  Zap,
  FolderOpen
} from 'lucide-react';
import { SetupSection } from '@/types/telemetry';
import { SetupExportContext } from '@/lib/setup-exporter';
import { 
  morphSetupConditions, 
  MorphInputConditions, 
  MorphResult 
} from '@/lib/setup-morph-engine';
import { saveSetupToVault, getSavedSetups } from '@/lib/setup-vault';
import { SetupExportModal } from '../setup/SetupExportModal';

export const SetupMorphTool: React.FC = () => {
  const [car, setCar] = useState("Ferrari 296 GT3");
  const [track, setTrack] = useState("Spa-Francorchamps");
  const [game, setGame] = useState("Assetto Corsa");

  // Baseline conditions
  const [baseTrackTemp, setBaseTrackTemp] = useState<number>(28);
  const [baseAirTemp, setBaseAirTemp] = useState<number>(22);
  const [baseFuel, setBaseFuel] = useState<number>(35);
  const [baseWeather, setBaseWeather] = useState<"optimum" | "greasy" | "green" | "damp" | "wet">("optimum");

  // Target conditions
  const [targetTrackTemp, setTargetTrackTemp] = useState<number>(40);
  const [targetAirTemp, setTargetAirTemp] = useState<number>(30);
  const [targetFuel, setTargetFuel] = useState<number>(65);
  const [targetWeather, setTargetWeather] = useState<"optimum" | "greasy" | "green" | "damp" | "wet">("greasy");

  const [savedVaultNotice, setSavedVaultNotice] = useState(false);

  // Standard high-fidelity baseline GT3 / GT setup
  const [sections, setSections] = useState<SetupSection[]>([
    {
      title: "Tyres & Pressures",
      items: [
        { label: "Front Left Cold Pressure", value: "26.5 psi" },
        { label: "Front Right Cold Pressure", value: "26.8 psi" },
        { label: "Rear Left Cold Pressure", value: "26.2 psi" },
        { label: "Rear Right Cold Pressure", value: "26.4 psi" },
      ],
    },
    {
      title: "Aerodynamics & Brakes",
      items: [
        { label: "Front Ride Height", value: "52 mm" },
        { label: "Rear Ride Height", value: "68 mm" },
        { label: "Rear Wing Angle", value: "8°" },
        { label: "Front Brake Duct", value: "2" },
        { label: "Rear Brake Duct", value: "2" },
      ],
    },
    {
      title: "Suspension & Mechanical Balance",
      items: [
        { label: "Front Anti-Roll Bar", value: "3" },
        { label: "Rear Anti-Roll Bar", value: "3" },
        { label: "Brake Bias", value: "54.5%" },
      ],
    },
    {
      title: "Electronics & Drivetrain",
      items: [
        { label: "Traction Control (TC1)", value: "3" },
        { label: "ABS", value: "3" },
        { label: "Differential Preload", value: "60 Nm" },
      ],
    },
  ]);

  const morphResult: MorphResult = useMemo(() => {
    return morphSetupConditions(
      sections,
      {
        trackTemp: baseTrackTemp,
        airTemp: baseAirTemp,
        weather: baseWeather,
        fuelLiters: baseFuel,
      },
      {
        trackTemp: targetTrackTemp,
        airTemp: targetAirTemp,
        weather: targetWeather,
        fuelLiters: targetFuel,
      }
    );
  }, [sections, baseTrackTemp, baseAirTemp, baseWeather, baseFuel, targetTrackTemp, targetAirTemp, targetWeather, targetFuel]);

  const deltaTrack = targetTrackTemp - baseTrackTemp;
  const deltaFuel = targetFuel - baseFuel;

  const handleSaveToVault = () => {
    saveSetupToVault({
      name: `${car} - ${track} (Morphed: ${targetTrackTemp}°C ${targetWeather.toUpperCase()})`,
      game,
      car,
      track,
      sessionType: "Race",
      weather: targetWeather.toUpperCase(),
      trackTemp: `${targetTrackTemp}°C`,
      airTemp: `${targetAirTemp}°C`,
      tyreCompound: "Slick",
      fuelLoad: `${targetFuel} L`,
      driverStyle: "Balanced",
      summary: `Setup Morph Tool: Adapted from ${baseTrackTemp}°C to ${targetTrackTemp}°C (${targetWeather}). ${morphResult.summaryNote}`,
      engineerNotes: `Thermal adaptation offset: ΔTrack ${deltaTrack > 0 ? "+" : ""}${deltaTrack}°C. Adjusted ${morphResult.totalChangesCount} parameters.`,
      sections: morphResult.sections,
    });

    setSavedVaultNotice(true);
    setTimeout(() => setSavedVaultNotice(false), 2500);
  };

  const morphedExportContext: SetupExportContext = useMemo(() => ({
    game,
    car,
    track,
    sessionType: "Race Stint",
    weather: targetWeather.toUpperCase(),
    trackTemp: `${targetTrackTemp}°C`,
    airTemp: `${targetAirTemp}°C`,
    fuelLoad: `${targetFuel} L`,
    tyreCompound: "Slick",
    driverStyle: "Thermodynamic Morphed",
    summary: `Morphed Setup: ${morphResult.summaryNote}`,
    engineerNotes: `Adapted for ${targetTrackTemp}°C asphalt temperature and ${targetFuel}L fuel load.`,
    sections: morphResult.sections,
  }), [game, car, track, targetWeather, targetTrackTemp, targetAirTemp, targetFuel, morphResult]);

  return (
    <div className="setup-morph-workspace glass-card p-5 space-y-6">
      {/* Title & Philosophy */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Setup Morph Studio
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Weather & Temp Adaptation
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Recalibrate baseline setups for temperature shifts, wet weather, or race stint fuel loads.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveToVault}
            className="action-btn flex items-center gap-1.5 text-xs"
            title="Save this morphed setup to your Vault"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>{savedVaultNotice ? "SAVED TO VAULT ✓" : "SAVE TO VAULT"}</span>
          </button>

          <SetupExportModal
            buttonLabel="EXPORT MORPHED FILE"
            context={morphedExportContext}
          />
        </div>
      </div>

      {/* Main Grid: Condition Selectors (Left) & Live Morphed Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Interactive Condition Sliders (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-xl bg-[#0E1320] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-300 border-b border-white/[0.06] pb-2">
              <span>Target Session Conditions</span>
              <span className="text-blue-400 font-mono text-[10px]">Real-time physics</span>
            </div>

            {/* Target Track Temperature Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                  Target Track Temp:
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-sm font-bold text-white">{targetTrackTemp}°C</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    deltaTrack > 0 
                      ? "bg-rose-500/20 text-rose-300" 
                      : deltaTrack < 0 
                      ? "bg-sky-500/20 text-sky-300" 
                      : "bg-white/10 text-slate-400"
                  }`}>
                    {deltaTrack > 0 ? `+${deltaTrack}°C HOT` : deltaTrack < 0 ? `${deltaTrack}°C COLD` : "0°C"}
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
                <span>28°C (Base)</span>
                <span>52°C (Heatwave)</span>
              </div>
            </div>

            {/* Target Ambient Air Temperature */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  Target Air Temp:
                </span>
                <span className="font-mono text-xs font-bold text-white">{targetAirTemp}°C</span>
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
            </div>

            {/* Weather Condition Pills */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Track Grip & Climate State:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { id: "optimum", label: "Optimum Dry", dot: "bg-emerald-400" },
                  { id: "greasy", label: "Greasy Hot", dot: "bg-amber-400" },
                  { id: "green", label: "Green Track", dot: "bg-emerald-500" },
                  { id: "damp", label: "Damp Track", dot: "bg-cyan-400" },
                  { id: "wet", label: "Full Wet", dot: "bg-blue-400" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetWeather(item.id as any)}
                    className={`p-2 rounded-md text-left border transition-colors ${
                      targetWeather === item.id
                        ? "bg-blue-600/20 border-blue-500 text-white font-medium"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="text-xs flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></span>
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Stint Fuel Load Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  Stint Fuel Load:
                </span>
                <span className="font-mono text-xs font-bold text-amber-300">
                  {targetFuel} L {deltaFuel !== 0 && `(${deltaFuel > 0 ? "+" : ""}${deltaFuel}L)`}
                </span>
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
            </div>
          </div>
        </div>

        {/* Right: Live Morphed Diff Output Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Summary Banner */}
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="text-xs text-slate-300">
                {morphResult.summaryNote}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 whitespace-nowrap">
              {morphResult.totalChangesCount} TUNED
            </span>
          </div>

          {/* Diffs Table */}
          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#0A0D16]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/[0.04] text-[10px] uppercase font-mono text-slate-400 border-b border-white/[0.08]">
                  <th className="py-2.5 px-3">Setup Parameter</th>
                  <th className="py-2.5 px-3">Baseline</th>
                  <th className="py-2.5 px-3"></th>
                  <th className="py-2.5 px-3">Morphed Target</th>
                  <th className="py-2.5 px-3">Offset</th>
                  <th className="py-2.5 px-3 hidden sm:table-cell">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {morphResult.diffs.map((diff, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200">
                      <div>{diff.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{diff.category}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {diff.originalValue}
                    </td>
                    <td className="py-2.5 px-1 text-slate-600">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {diff.morphedValue}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        diff.changeDelta.startsWith("+")
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                      }`}>
                        {diff.changeDelta}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-400 hidden sm:table-cell">
                      {diff.rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
