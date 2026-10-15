"use client";

import React, { useState } from "react";
import { CornerLedgerAnalysis, CornerLedgerItem } from "@/types/telemetry";

interface CornerLedgerViewerProps {
  ledger?: CornerLedgerAnalysis;
  activeCornerId?: string | null;
  onSelectCorner?: (corner: CornerLedgerItem) => void;
}

export const CornerLedgerViewer: React.FC<CornerLedgerViewerProps> = ({
  ledger,
  activeCornerId,
  onSelectCorner,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<"all" | "loss" | "gain">("all");
  const [sortBy, setSortBy] = useState<"corner" | "netDelta" | "apexSpeed" | "braking">("corner");
  const [sortDesc, setSortDesc] = useState<boolean>(true);

  if (!ledger || !ledger.corners || ledger.corners.length === 0) {
    return (
      <div className="glass-card-nested p-6 text-center text-slate-400">
        <p className="text-sm font-sans">No corner ledger telemetry available. Upload or select a session to calculate corner performance.</p>
      </div>
    );
  }

  // Filter corners
  const filteredCorners = ledger.corners.filter((c) => {
    if (filterSeverity === "loss") return c.totalCornerTimeDeltaSeconds > 0.03;
    if (filterSeverity === "gain") return c.totalCornerTimeDeltaSeconds < -0.03;
    return true;
  });

  // Sort corners
  const sortedCorners = [...filteredCorners].sort((a, b) => {
    let diff = 0;
    if (sortBy === "corner") {
      diff = a.cornerNumber - b.cornerNumber;
    } else if (sortBy === "netDelta") {
      diff = a.totalCornerTimeDeltaSeconds - b.totalCornerTimeDeltaSeconds;
    } else if (sortBy === "apexSpeed") {
      diff = (a.apexSpeedDeltaKmh || 0) - (b.apexSpeedDeltaKmh || 0);
    } else if (sortBy === "braking") {
      diff = (a.brakeDeltaMeters || 0) - (b.brakeDeltaMeters || 0);
    }
    return sortDesc ? -diff : diff;
  });

  const handleSort = (field: "corner" | "netDelta" | "apexSpeed" | "braking") => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(field === "netDelta");
    }
  };

  const getVerdictStyle = (badge: string) => {
    if (badge.includes("Optimal") || badge.includes("Advantage")) {
      return "bg-emerald-950/40 border-emerald-500/30 text-emerald-400";
    }
    if (badge.includes("Early Braking") || badge.includes("Overslowed")) {
      return "bg-amber-950/40 border-amber-500/30 text-amber-400";
    }
    if (badge.includes("Late Braking") || badge.includes("Delayed") || badge.includes("Deficit")) {
      return "bg-rose-950/40 border-rose-500/30 text-rose-400";
    }
    return "bg-zinc-800/50 border-zinc-700/40 text-zinc-300";
  };

  return (
    <div className="glass-card-nested mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-md">
      {/* Header Strip */}
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 items-center rounded-md border border-[#d4a373]/40 bg-[#d4a373]/15 px-2 text-xs font-semibold uppercase tracking-wider text-[#d4a373]">
                Telemetry Engine 3.0
              </span>
              <h3 className="text-base font-semibold text-white font-sans">
                Corner Performance Ledger
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400 font-sans">
              Phase-by-phase time loss breakdown: Braking Entry, Apex Minimum Speed, and Throttle Exit.
            </p>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/80 p-1">
            <button
              type="button"
              onClick={() => setFilterSeverity("all")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition font-sans ${
                filterSeverity === "all"
                  ? "bg-[#d4a373] text-black shadow-sm font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Turns ({ledger.corners.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity("loss")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition font-sans ${
                filterSeverity === "loss"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "text-slate-400 hover:text-rose-300"
              }`}
            >
              Time Lost
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity("gain")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition font-sans ${
                filterSeverity === "gain"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-emerald-300"
              }`}
            >
              Time Gained
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Total Corner Loss</div>
            <div className={`mt-1 text-base font-bold font-sans ${ledger.totalTimeLostInCornersSeconds > 0 ? "text-rose-400" : "text-emerald-400"}`}>
              {ledger.totalTimeLostInCornersSeconds > 0 ? `+${ledger.totalTimeLostInCornersSeconds.toFixed(3)}s` : `${ledger.totalTimeLostInCornersSeconds.toFixed(3)}s`}
            </div>
            <div className="text-[10px] text-slate-500">Across full lap</div>
          </div>

          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Biggest Loss</div>
            <div className="mt-1 text-base font-bold text-rose-400 truncate font-sans">
              {ledger.biggestLossCorner}
            </div>
            <div className="text-[10px] text-slate-500">Priority setup focus</div>
          </div>

          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Strongest Corner</div>
            <div className="mt-1 text-base font-bold text-emerald-400 truncate font-sans">
              {ledger.biggestGainCorner}
            </div>
            <div className="text-[10px] text-slate-500">Best delta vs target</div>
          </div>

          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Avg Apex Speed Δ</div>
            <div className={`mt-1 text-base font-bold font-sans ${ledger.averageApexSpeedDeltaKmh >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {ledger.averageApexSpeedDeltaKmh >= 0 ? `+${ledger.averageApexSpeedDeltaKmh.toFixed(1)}` : ledger.averageApexSpeedDeltaKmh.toFixed(1)} km/h
            </div>
            <div className="text-[10px] text-slate-500">Mid-corner rolling speed</div>
          </div>

          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Brake Consistency</div>
            <div className="mt-1 text-base font-bold text-[#d4a373] font-sans">
              {ledger.brakingConsistencyScore}/100
            </div>
            <div className="text-[10px] text-slate-500">Decel repeatability</div>
          </div>

          <div className="rounded-lg border border-white/5 bg-zinc-900/50 p-3">
            <div className="text-[11px] font-medium text-slate-400 font-sans">Corner Efficiency</div>
            <div className="mt-1 text-base font-bold text-sky-400 font-sans">
              {ledger.overallCorneringEfficiencyPct}%
            </div>
            <div className="text-[10px] text-slate-500">Grip envelope utilization</div>
          </div>
        </div>
      </div>

      {/* Interactive Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-white/10 bg-zinc-900/90 text-[11px] uppercase tracking-wider text-slate-400 font-sans">
            <tr>
              <th
                onClick={() => handleSort("corner")}
                className="cursor-pointer py-3 pl-4 pr-3 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Turn / Name</span>
                  {sortBy === "corner" && <span>{sortDesc ? "▼" : "▲"}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort("braking")}
                className="cursor-pointer py-3 px-3 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Entry Phase (Brake &amp; Decel)</span>
                  {sortBy === "braking" && <span>{sortDesc ? "▼" : "▲"}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort("apexSpeed")}
                className="cursor-pointer py-3 px-3 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Apex Minimum Speed</span>
                  {sortBy === "apexSpeed" && <span>{sortDesc ? "▼" : "▲"}</span>}
                </div>
              </th>
              <th className="py-3 px-3">Exit Phase (Throttle Commit)</th>
              <th
                onClick={() => handleSort("netDelta")}
                className="cursor-pointer py-3 px-3 hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Phase Splits &amp; Net Δt</span>
                  {sortBy === "netDelta" && <span>{sortDesc ? "▼" : "▲"}</span>}
                </div>
              </th>
              <th className="py-3 pl-3 pr-4 text-right">Attribution &amp; Diagnosis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedCorners.map((item) => {
              const isSelected =
                activeCornerId === item.id ||
                activeCornerId === item.name ||
                activeCornerId === `T${item.cornerNumber}`;

              const delta = item.totalCornerTimeDeltaSeconds;
              const isGain = delta < -0.01;
              const isLoss = delta > 0.01;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectCorner?.(item)}
                  className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${
                    isSelected ? "bg-[#d4a373]/15 border-l-2 border-[#d4a373]" : ""
                  }`}
                >
                  {/* Corner Name & Dist */}
                  <td className="py-3.5 pl-4 pr-3">
                    <div className="font-semibold text-white flex items-center gap-2 font-sans">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-[#d4a373]">
                        {item.cornerNumber}
                      </span>
                      <span>{item.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-sans">
                      {Math.round(item.dist)} m
                    </div>
                  </td>

                  {/* Entry Phase */}
                  <td className="py-3 px-3">
                    <div className="text-slate-200 font-sans">
                      <span className="font-medium text-white">{item.entryPeakDecelG.toFixed(2)}G</span> peak decel
                    </div>
                    <div className="mt-0.5 text-[11px] font-sans">
                      {item.brakeDeltaMeters !== 0 ? (
                        item.brakeDeltaMeters > 3 ? (
                          <span className="text-amber-400">Braked {Math.round(item.brakeDeltaMeters)}m early</span>
                        ) : item.brakeDeltaMeters < -3 ? (
                          <span className="text-rose-400">Braked {Math.abs(Math.round(item.brakeDeltaMeters))}m late</span>
                        ) : (
                          <span className="text-slate-400">Braking point on target</span>
                        )
                      ) : (
                        <span className="text-slate-500">Start: {Math.round(item.brakeStartDistMeters)}m</span>
                      )}
                    </div>
                  </td>

                  {/* Apex Phase */}
                  <td className="py-3 px-3">
                    <div className="text-white font-medium font-sans">
                      {Math.round(item.driverApexSpeedKmh)} km/h
                      {item.apexSpeedDeltaKmh !== 0 && (
                        <span
                          className={`ml-1.5 text-xs font-semibold ${
                            item.apexSpeedDeltaKmh >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          ({item.apexSpeedDeltaKmh > 0 ? `+${item.apexSpeedDeltaKmh.toFixed(1)}` : item.apexSpeedDeltaKmh.toFixed(1)} km/h)
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 font-sans">
                      {item.apexLatG.toFixed(2)}G lateral load
                    </div>
                  </td>

                  {/* Exit Phase */}
                  <td className="py-3 px-3">
                    <div className="text-slate-200 font-sans">
                      Exit <span className="font-medium text-white">{Math.round(item.exitSpeedKmh)} km/h</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-sans">
                      {item.throttleCommitDeltaMeters !== 0 ? (
                        item.throttleCommitDeltaMeters < -5 ? (
                          <span className="text-rose-400">Throttle {Math.abs(Math.round(item.throttleCommitDeltaMeters))}m delayed</span>
                        ) : item.throttleCommitDeltaMeters > 5 ? (
                          <span className="text-emerald-400">Throttle {Math.round(item.throttleCommitDeltaMeters)}m early</span>
                        ) : (
                          <span className="text-slate-400">Throttle commit on target</span>
                        )
                      ) : (
                        <span className="text-slate-500">Full gas: {Math.round(item.throttleCommitDistMeters)}m</span>
                      )}
                    </div>
                  </td>

                  {/* Phase Splits & Net Time Delta */}
                  <td className="py-3 px-3">
                    <div
                      className={`text-sm font-bold font-sans ${
                        isLoss ? "text-rose-400" : isGain ? "text-emerald-400" : "text-slate-300"
                      }`}
                    >
                      {delta > 0 ? `+${delta.toFixed(3)}s` : `${delta.toFixed(3)}s`}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>E: {item.entryTimeDeltaSeconds > 0 ? `+${item.entryTimeDeltaSeconds.toFixed(2)}` : item.entryTimeDeltaSeconds.toFixed(2)}</span>
                      <span>&bull;</span>
                      <span>A: {item.apexTimeDeltaSeconds > 0 ? `+${item.apexTimeDeltaSeconds.toFixed(2)}` : item.apexTimeDeltaSeconds.toFixed(2)}</span>
                      <span>&bull;</span>
                      <span>X: {item.exitTimeDeltaSeconds > 0 ? `+${item.exitTimeDeltaSeconds.toFixed(2)}` : item.exitTimeDeltaSeconds.toFixed(2)}</span>
                    </div>
                  </td>

                  {/* Diagnosis Tag */}
                  <td className="py-3 pl-3 pr-4 text-right">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold font-sans ${getVerdictStyle(
                        item.verdictBadge
                      )}`}
                    >
                      {item.verdictBadge}
                    </span>
                    <div className="mt-1 text-[11px] text-slate-400 truncate max-w-xs ml-auto">
                      {item.coachingCue}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-white/5 bg-zinc-950/60 p-3 text-center text-xs text-slate-400 font-sans">
        Click any corner to lock and sync 2D track map coordinates, virtual ghost, and telemetry channel zoom.
      </div>
    </div>
  );
};
