"use client";

import React, { useState } from "react";
import { EnduranceStrategyAnalysis } from "@/types/telemetry";

interface EndurancePitStrategistProps {
  data: EnduranceStrategyAnalysis;
}

export const EndurancePitStrategist: React.FC<EndurancePitStrategistProps> = ({ data }) => {
  const [selectedLapFilter, setSelectedLapFilter] = useState<"all" | "pit_window">("all");

  const { fuelWindow, tyreDegradation, liftAndCoast, stintForecast, executiveStrategyPlan } = data;

  const displayedLaps =
    selectedLapFilter === "pit_window"
      ? stintForecast.filter((l) => l.isPitWindow)
      : stintForecast;

  return (
    <div className="telemetry-endurance-module glass-card-nested">
      {/* Module Header */}
      <div className="module-header">
        <div className="module-title-group">
          <span className="module-title">Endurance Pit Strategist & Tyre Degradation</span>
          <span className="module-sub">
            Empirical Stint Fuel Burn, Tyre Thermal Drift & Lift-and-Coast Window
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-sans font-semibold px-2.5 py-1 rounded border"
            style={{
              background: "rgba(212, 163, 115, 0.12)",
              color: "#d4a373",
              borderColor: "rgba(212, 163, 115, 0.3)",
            }}
          >
            {fuelWindow.maxStintLaps} LAPS MAX STINT
          </span>
          <span className="text-[11px] font-sans text-zinc-400 bg-white/[0.04] px-2 py-1 rounded border border-white/10">
            {fuelWindow.burnRatePerLapLiters} L/LAP BURN
          </span>
        </div>
      </div>

      {/* Executive Strategy Banner */}
      <div className="p-3.5 mx-3 mt-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-[#d4a373]">
            Pit Wall Chief Strategist Directive
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">{executiveStrategyPlan}</p>
      </div>

      {/* KPI Trio Grid: Fuel Window, Lift-and-Coast, Tyre Deg */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        {/* Card 1: Fuel Window & Pit Cycles */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mb-2">
              Stint Fuel Window & Burn Rate
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                {fuelWindow.burnRatePerLapLiters}
                <span className="text-xs font-normal text-zinc-400 ml-1">L/lap</span>
              </span>
              <span className="text-xs font-sans text-sky-400">
                {fuelWindow.tankCapacityLiters}L Tank
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Undercut Window Opens:</span>
                <span className="text-[#d4a373] font-medium">Lap {fuelWindow.undercutLapStart}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Ideal Pit Stop Lap:</span>
                <span className="text-white font-semibold">Lap {fuelWindow.idealPitLap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Max Overcut (Empty):</span>
                <span className="text-rose-400 font-medium">Lap {fuelWindow.maxOvercutLap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stints Needed ({data.raceDurationMinutes}m):</span>
                <span className="text-zinc-200">{fuelWindow.stintsRequired} Stints</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans">
            Total Fuel to Finish: <strong className="text-zinc-200">{fuelWindow.fuelNeededToFinishLiters} L</strong>
          </div>
        </div>

        {/* Card 2: Lift-and-Coast Fuel Target */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-sans uppercase tracking-wider text-zinc-400">
                Lift-and-Coast Target
              </span>
              <span
                className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded border ${
                  liftAndCoast.isRecommended
                    ? "bg-[#d4a373]/15 text-[#d4a373] border-[#d4a373]/30"
                    : "bg-white/[0.05] text-zinc-400 border-white/10"
                }`}
              >
                {liftAndCoast.isRecommended ? "SPLASH STOP SAVED" : "MAX ATTACK"}
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                -{liftAndCoast.fuelSavedPerLapLiters}
                <span className="text-xs font-normal text-zinc-400 ml-1">L/lap</span>
              </span>
              <span className="text-xs font-sans text-amber-400">
                +{liftAndCoast.timeCostPerLapSeconds}s lap penalty
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Lift Distance:</span>
                <span className="text-zinc-200">{liftAndCoast.liftDistanceMeters}m before apex</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stint Laps Gained:</span>
                <span className="text-[#d4a373] font-semibold">+{liftAndCoast.stintLapsGained} Laps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Pit Stop Eliminated:</span>
                <span className={liftAndCoast.pitStopSaved ? "text-sky-400 font-medium" : "text-zinc-400"}>
                  {liftAndCoast.pitStopSaved ? "Yes (-38s)" : "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Net Race Time Delta:</span>
                <span
                  className={`font-semibold ${
                    liftAndCoast.netTimeSavedSeconds > 0 ? "text-sky-400" : "text-rose-400"
                  }`}
                >
                  {liftAndCoast.netTimeSavedSeconds > 0 ? `+${liftAndCoast.netTimeSavedSeconds}s` : `${liftAndCoast.netTimeSavedSeconds}s`}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans line-clamp-2">
            {liftAndCoast.verdict}
          </div>
        </div>

        {/* Card 3: Tyre Wear & Thermal Drift */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mb-2">
              Tyre Degradation & Thermal Drift
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                +{tyreDegradation.degradationRatePerLapSeconds}
                <span className="text-xs font-normal text-zinc-400 ml-1">s/lap</span>
              </span>
              <span className="text-xs font-sans text-rose-400 font-medium">
                {tyreDegradation.limitingTyreCorner} Limited
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Thermal Pressure Drift:</span>
                <span className="text-amber-400 font-medium">Lap {tyreDegradation.thermalDriftOnsetLap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Critical Grip Cliff:</span>
                <span className="text-rose-400 font-semibold">Lap {tyreDegradation.cliffLap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Wear Lifespan:</span>
                <span className="text-zinc-200">{tyreDegradation.wearLifespanLaps} Laps max</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Compound Status:</span>
                <span className="text-sky-400">Endurance Medium</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans line-clamp-2">
            {tyreDegradation.verdict}
          </div>
        </div>
      </div>

      {/* Stint Forecast Lap-by-Lap Table */}
      <div className="p-3 border-t border-zinc-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-200 font-sans">
              Stint Telemetry Forecast Matrix ({stintForecast.length} Laps)
            </span>
            <span className="text-[11px] text-zinc-400 font-sans">
              Lap-by-lap pace, fuel burn down, and 4-corner core pressures
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded transition-colors ${
                selectedLapFilter === "all"
                  ? "bg-[#d4a373] text-black font-semibold"
                  : "bg-white/[0.05] text-zinc-400 hover:text-white"
              }`}
              onClick={() => setSelectedLapFilter("all")}
            >
              All Laps
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 text-[11px] font-sans font-medium rounded transition-colors ${
                selectedLapFilter === "pit_window"
                  ? "bg-[#d4a373] text-black font-semibold"
                  : "bg-white/[0.05] text-zinc-400 hover:text-white"
              }`}
              onClick={() => setSelectedLapFilter("pit_window")}
            >
              Pit Window Only ({fuelWindow.undercutLapStart}–{fuelWindow.maxOvercutLap})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-none rounded border border-zinc-800/70">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-zinc-900/80 text-[11px] text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2 px-3">Lap</th>
                <th className="py-2 px-3">Projected Time</th>
                <th className="py-2 px-3">Fuel Rem.</th>
                <th className="py-2 px-3">Front Grip</th>
                <th className="py-2 px-3">Rear Grip</th>
                <th className="py-2 px-3">Press. FL/FR</th>
                <th className="py-2 px-3">Press. RL/RR</th>
                <th className="py-2 px-3">Stint Phase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {displayedLaps.map((l) => (
                <tr
                  key={l.lap}
                  className={`hover:bg-white/[0.02] transition-colors ${
                    l.isPitWindow ? "bg-[#d4a373]/[0.06]" : ""
                  }`}
                >
                  <td className="py-2 px-3 font-semibold text-zinc-300">
                    L{l.lap}
                    {l.isPitWindow && (
                      <span className="ml-1.5 text-[9.5px] px-1.5 py-0.2 rounded bg-[#d4a373]/20 text-[#d4a373] font-medium">
                        BOX
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-sky-400 font-medium">{l.lapTime}</td>
                  <td className="py-2 px-3 text-zinc-300">{l.fuelRemainingLiters} L</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{ width: `${l.tyreGripFrontPct}%` }}
                        />
                      </div>
                      <span className="text-zinc-400 text-[11px]">{l.tyreGripFrontPct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full"
                          style={{ width: `${l.tyreGripRearPct}%` }}
                        />
                      </div>
                      <span className="text-zinc-400 text-[11px]">{l.tyreGripRearPct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-zinc-300">
                    {l.pressureFL} / {l.pressureFR} psi
                  </td>
                  <td className="py-2 px-3 text-zinc-300">
                    {l.pressureRL} / {l.pressureRR} psi
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded border ${
                        l.status === "cold"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : l.status === "optimal"
                          ? "bg-zinc-800/60 text-zinc-300 border-zinc-700/60"
                          : l.status === "degraded"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}
                    >
                      {l.status === "cold"
                        ? "Warmup"
                        : l.status === "optimal"
                        ? "Peak Grip"
                        : l.status === "degraded"
                        ? "Thermal Drift"
                        : "Grip Cliff / Box"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
