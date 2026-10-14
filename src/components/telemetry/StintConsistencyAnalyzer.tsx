"use client";

import React, { useState } from "react";
import { StintConsistencyAnalysis } from "@/types/telemetry";

interface StintConsistencyAnalyzerProps {
  data: StintConsistencyAnalysis;
}

export const StintConsistencyAnalyzer: React.FC<StintConsistencyAnalyzerProps> = ({ data }) => {
  const [selectedView, setSelectedView] = useState<"braking" | "paces">("braking");

  const {
    stintLapsAnalyzed,
    overallConsistencyRatingPct,
    lapTimeVarianceStdDev,
    bestLapTime,
    averageLapTime,
    thermalEquilibrium,
    brakingMigration,
    lapPaces,
    driverConsistencyVerdict,
  } = data;

  return (
    <div className="telemetry-consistency-module glass-card-nested">
      {/* Module Header */}
      <div className="module-header">
        <div className="module-title-group">
          <span className="module-title">Multi-Lap Consistency & Braking Point Drift</span>
          <span className="module-sub">
            Threshold Braking Migration, Tyre Thermal Equilibrium & Pace Variance
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-sans font-semibold px-2.5 py-1 rounded border"
            style={{
              background: "rgba(56, 189, 248, 0.12)",
              color: "#38bdf8",
              borderColor: "rgba(56, 189, 248, 0.3)",
            }}
          >
            {overallConsistencyRatingPct}% STINT CONSISTENCY
          </span>
          <span className="text-[11px] font-sans text-zinc-400 bg-white/[0.04] px-2 py-1 rounded border border-white/10">
            σ = ±{lapTimeVarianceStdDev}s
          </span>
        </div>
      </div>

      {/* Driver Consistency Debrief */}
      <div className="p-3.5 mx-3 mt-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-sky-400">
            Chief Race Engineer Stint Verdict
          </span>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed font-sans">{driverConsistencyVerdict}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        {/* Card 1: Stint Pace Variance */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mb-2">
              Stint Pace Variance
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                {overallConsistencyRatingPct}%
              </span>
              <span className="text-xs font-sans text-sky-400">
                {stintLapsAnalyzed} Laps Sampled
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Pace Std Dev (σ):</span>
                <span className="text-white font-medium">±{lapTimeVarianceStdDev}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Best Stint Lap:</span>
                <span className="text-[#d4a373] font-semibold">{bestLapTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Average Stint Lap:</span>
                <span className="text-zinc-200">{averageLapTime}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans">
            Rating: <strong className="text-zinc-200">{overallConsistencyRatingPct >= 95 ? "FIA Gold / Pro Grade" : "Club / Silver Grade"}</strong>
          </div>
        </div>

        {/* Card 2: Thermal Equilibrium Tracking */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mb-2">
              Tyre Thermal Equilibrium
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                Lap {thermalEquilibrium.plateauLap}
                <span className="text-xs font-normal text-zinc-400 ml-1">Plateau</span>
              </span>
              <span className="text-xs font-sans text-[#d4a373]">
                Laps {thermalEquilibrium.optimalWindowLapsStart}–{thermalEquilibrium.optimalWindowLapsEnd} Window
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Stabilized Front Pressure:</span>
                <span className="text-white font-medium">{thermalEquilibrium.stabilizedPressureFrontPsi} psi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Stabilized Rear Pressure:</span>
                <span className="text-white font-medium">{thermalEquilibrium.stabilizedPressureRearPsi} psi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Core Bulk Temp:</span>
                <span className="text-zinc-200">{thermalEquilibrium.stabilizedCoreTempC}°C</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans line-clamp-2">
            {thermalEquilibrium.verdict}
          </div>
        </div>

        {/* Card 3: Braking Migration Overview */}
        <div className="p-3.5 bg-zinc-900/50 rounded-lg border border-zinc-800/70 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-400 mb-2">
              Braking Migration Shift
            </div>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-2xl font-bold text-white font-sans">
                {brakingMigration.length}
                <span className="text-xs font-normal text-zinc-400 ml-1">Heavy Stops</span>
              </span>
              <span className="text-xs font-sans text-amber-400">
                Peak Decel {brakingMigration[0]?.decelerationPeakEarlyG || 2.2}G
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-zinc-300 font-sans">
              <div className="flex justify-between">
                <span className="text-zinc-400">Early Stop Migration:</span>
                <span className="text-amber-400 font-medium">Creeping early</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Average Shift:</span>
                <span className="text-zinc-200">-6.5m into apex</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Brake Fade Index:</span>
                <span className="text-sky-400">4.5% Decel Loss</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-400 font-sans">
            Primary Cause: Thermal tyre pressure drift reducing front bite.
          </div>
        </div>
      </div>

      {/* View Toggle Tabs: Braking Migration vs Stint Lap Paces */}
      <div className="px-3 pt-1 pb-2 border-t border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
              selectedView === "braking"
                ? "bg-[#d4a373] text-black font-semibold"
                : "bg-white/[0.05] text-zinc-400 hover:text-white"
            }`}
            onClick={() => setSelectedView("braking")}
          >
            Braking Migration Analysis
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-xs font-sans font-medium rounded transition-colors ${
              selectedView === "paces"
                ? "bg-[#d4a373] text-black font-semibold"
                : "bg-white/[0.05] text-zinc-400 hover:text-white"
            }`}
            onClick={() => setSelectedView("paces")}
          >
            Lap-by-Lap Stint Paces & Sectors ({lapPaces.length} Laps)
          </button>
        </div>
      </div>

      {/* Selected View Content */}
      <div className="p-3 pt-0">
        {selectedView === "braking" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {brakingMigration.map((bm, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-zinc-900/60 rounded-lg border border-zinc-800/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white font-sans">{bm.cornerName}</span>
                    <span
                      className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded border ${
                        bm.verdict === "rock_solid"
                          ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          : bm.verdict === "creeping_early"
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {bm.verdict === "rock_solid"
                        ? "ROCK SOLID"
                        : bm.verdict === "creeping_early"
                        ? `CREEPING EARLY (${bm.migrationDeltaMeters}m)`
                        : `DRIFTING DEEP (+${bm.migrationDeltaMeters}m)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-sans mb-2.5">
                    <div className="p-2 rounded bg-zinc-950/40 border border-zinc-800/50">
                      <div className="text-[10px] text-zinc-400 mb-0.5">Early Stint (L1–L4)</div>
                      <div className="text-sm font-semibold text-zinc-200">
                        {bm.earlyStintBrakeDistMeters}m <span className="text-[10px] text-zinc-400 font-normal">from apex</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Peak {bm.decelerationPeakEarlyG}G</div>
                    </div>

                    <div className="p-2 rounded bg-zinc-950/40 border border-zinc-800/50">
                      <div className="text-[10px] text-zinc-400 mb-0.5">Late Stint (L14–L18)</div>
                      <div className="text-sm font-semibold text-zinc-200">
                        {bm.lateStintBrakeDistMeters}m <span className="text-[10px] text-zinc-400 font-normal">from apex</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">Peak {bm.decelerationPeakLateG}G</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 font-sans leading-relaxed pt-2 border-t border-zinc-800/50">
                  {bm.analysisText}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-none rounded border border-zinc-800/70">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-zinc-900/80 text-[11px] text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-2 px-3">Lap</th>
                  <th className="py-2 px-3">Lap Time</th>
                  <th className="py-2 px-3">Delta to Best</th>
                  <th className="py-2 px-3">Sector 1</th>
                  <th className="py-2 px-3">Sector 2</th>
                  <th className="py-2 px-3">Sector 3</th>
                  <th className="py-2 px-3">Consistency Score</th>
                  <th className="py-2 px-3">Traffic Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {lapPaces.map((lp) => (
                  <tr
                    key={lp.lap}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      lp.deltaFromBestSeconds === 0 ? "bg-[#d4a373]/[0.08]" : ""
                    }`}
                  >
                    <td className="py-2 px-3 font-semibold text-zinc-300">
                      L{lp.lap}
                      {lp.deltaFromBestSeconds === 0 && (
                        <span className="ml-1.5 text-[9.5px] px-1.5 py-0.2 rounded bg-[#d4a373]/20 text-[#d4a373] font-medium">
                          PURPLE
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-sky-400 font-medium">{lp.lapTime}</td>
                    <td
                      className={`py-2 px-3 font-medium ${
                        lp.deltaFromBestSeconds === 0
                          ? "text-[#d4a373]"
                          : lp.deltaFromBestSeconds < 0.3
                          ? "text-zinc-300"
                          : "text-amber-400"
                      }`}
                    >
                      {lp.deltaFromBestSeconds === 0
                        ? "BEST"
                        : `+${lp.deltaFromBestSeconds.toFixed(3)}s`}
                    </td>
                    <td className="py-2 px-3 text-zinc-300">{lp.sector1Time}s</td>
                    <td className="py-2 px-3 text-zinc-300">{lp.sector2Time}s</td>
                    <td className="py-2 px-3 text-zinc-300">{lp.sector3Time}s</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${lp.consistencyScore}%` }}
                          />
                        </div>
                        <span className="text-zinc-400 text-[11px]">{lp.consistencyScore}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      {lp.hasTraffic ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Traffic Delay
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-[11px]">Clean Air</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
