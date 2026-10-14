"use client";

import React, { useState } from "react";
import {
  DynamicAeroMapAnalysis,
  AeroRideHeightPoint,
} from "@/types/telemetry";

interface DynamicAeroMapViewerProps {
  data: DynamicAeroMapAnalysis;
}

export const DynamicAeroMapViewer: React.FC<DynamicAeroMapViewerProps> = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState<AeroRideHeightPoint | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "windtunnel">("profile");

  const sampled = data.sampledProfile;
  const maxDownforce = Math.max(10, ...sampled.map((s) => s.downforceKg));
  const maxDist = sampled.length > 0 ? sampled[sampled.length - 1].dist : 1;

  // Visual chart bounds
  const minRh = Math.max(0, Math.min(20, data.minFrontRideHeightMm - 10));
  const maxRh = Math.max(90, data.maxRearRideHeightMm + 15);
  const chartHeight = 160;

  return (
    <div className="dynamic-aero-map-card glass-card-nested rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#d4a373] font-semibold">
              Ground Effect & Aerodynamics
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] text-zinc-300">
              {data.carArchetype}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-1">
            Dynamic Ride Height & Aero Balance Mapper
          </h3>
        </div>

        {/* View Switcher & Efficiency Badge */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-[#d4a373]/30 bg-[#d4a373]/10 px-3 py-1 text-xs text-[#d4a373] font-medium">
            Aero Efficiency Score: <strong className="text-white">{data.aerodynamicEfficiencyScore}/100</strong>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`px-3 py-1.5 text-xs rounded transition-colors font-medium ${
                activeTab === "profile"
                  ? "bg-[#d4a373] text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              Lap Ride Height Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("windtunnel")}
              className={`px-3 py-1.5 text-xs rounded transition-colors font-medium ${
                activeTab === "windtunnel"
                  ? "bg-[#d4a373] text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              Speed-Bin Aero Matrix
            </button>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
            Peak Downforce
          </span>
          <div className="text-lg font-bold text-white mt-1">
            {data.peakDownforceKg} <span className="text-xs font-normal text-zinc-400">kg @ {data.topSpeedKmh} km/h</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            Aerodynamic load at terminal velocity
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
            Aero Balance (% Front)
          </span>
          <div className="text-lg font-bold text-[#d4a373] mt-1">
            {data.averageAeroBalanceFrontPct}%
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            Static: {data.staticAeroBalancePct}% (Δ{Number((data.averageAeroBalanceFrontPct - data.staticAeroBalancePct).toFixed(1))}% dynamic migration)
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
            Splitter Clearance
          </span>
          <div className={`text-lg font-bold mt-1 ${
            data.groundingEvents.length > 0 ? "text-amber-400" : "text-sky-300"
          }`}>
            {data.minFrontRideHeightMm} <span className="text-xs font-normal text-zinc-400">mm min</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {data.groundingEvents.length === 0
              ? "Zero floor ground-strikes"
              : `${data.groundingEvents.length} splitter strike event(s)`}
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
            Porpoising Status
          </span>
          <div className={`text-lg font-bold mt-1 ${
            data.porpoising.isDetected ? "text-rose-400" : "text-zinc-200"
          }`}>
            {data.porpoising.isDetected ? "Oscillation Detected" : "Platform Stable"}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {data.porpoising.isDetected
              ? `${data.porpoising.maxOscillationMm}mm @ ${data.porpoising.peakFrequencyHz} Hz`
              : "No high-speed heave bounce"}
          </div>
        </div>
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-3">
          {/* Main Ride Height SVG Trace */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span className="font-semibold text-white">Dynamic Ride Heights & Floor Grounding Trace</span>
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-1 rounded-sm bg-sky-400"></span>
                  <span>Front Ride Height (Splitter)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-1 rounded-sm bg-[#d4a373]"></span>
                  <span>Rear Ride Height (Diffuser)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-2 rounded-sm bg-amber-500/30 border border-amber-500/50"></span>
                  <span>Dynamic Rake Throat</span>
                </div>
              </div>
            </div>

            <div className="relative w-full overflow-hidden select-none">
              <svg
                viewBox={`0 0 600 ${chartHeight}`}
                className="w-full h-auto block select-none"
                preserveAspectRatio="none"
              >
                {/* Horizontal reference grid */}
                {[0.25, 0.5, 0.75].map((frac, idx) => (
                  <line
                    key={idx}
                    x1="0"
                    y1={chartHeight * frac}
                    x2="600"
                    y2={chartHeight * frac}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                ))}

                {/* Shaded Area between Front and Rear = Rake Envelope */}
                {sampled.length > 1 && (
                  <polygon
                    points={
                      sampled
                        .map((s) => {
                          const x = (s.dist / maxDist) * 600;
                          const yFront = chartHeight - ((s.frontRideHeightMm - minRh) / (maxRh - minRh)) * chartHeight;
                          return `${x},${yFront}`;
                        })
                        .join(" ") +
                      " " +
                      sampled
                        .slice()
                        .reverse()
                        .map((s) => {
                          const x = (s.dist / maxDist) * 600;
                          const yRear = chartHeight - ((s.rearRideHeightMm - minRh) / (maxRh - minRh)) * chartHeight;
                          return `${x},${yRear}`;
                        })
                        .join(" ")
                    }
                    fill="rgba(212, 163, 115, 0.12)"
                  />
                )}

                {/* Front Ride Height Path (Sky Blue) */}
                {sampled.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                    points={sampled
                      .map((s) => {
                        const x = (s.dist / maxDist) * 600;
                        const y = chartHeight - ((s.frontRideHeightMm - minRh) / (maxRh - minRh)) * chartHeight;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                )}

                {/* Rear Ride Height Path (Locode Golden Sand) */}
                {sampled.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#d4a373"
                    strokeWidth="1.8"
                    points={sampled
                      .map((s) => {
                        const x = (s.dist / maxDist) * 600;
                        const y = chartHeight - ((s.rearRideHeightMm - minRh) / (maxRh - minRh)) * chartHeight;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                )}

                {/* Grounding Spike Markers */}
                {data.groundingEvents.map((g, idx) => {
                  const x = (g.dist / maxDist) * 600;
                  return (
                    <line
                      key={idx}
                      x1={x}
                      y1="0"
                      x2={x}
                      y2={chartHeight}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                      opacity={0.8}
                    />
                  );
                })}

                {/* Interactive cursor line */}
                {hoveredPoint && (
                  <line
                    x1={(hoveredPoint.dist / maxDist) * 600}
                    y1="0"
                    x2={(hoveredPoint.dist / maxDist) * 600}
                    y2={chartHeight}
                    stroke="rgba(255, 255, 255, 0.6)"
                    strokeWidth="1"
                  />
                )}
              </svg>

              {/* Invisible interactive hover slices */}
              <div
                className="absolute inset-0 flex cursor-crosshair"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {sampled.map((pt, idx) => (
                  <div
                    key={idx}
                    className="flex-1 h-full"
                    onMouseEnter={() => setHoveredPoint(pt)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1 font-sans">
              <span>0 m</span>
              <span>{Math.round(maxDist / 2)} m</span>
              <span>{maxDist} m</span>
            </div>
          </div>

          {/* Interactive Inspector Ribbon */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs">
            {hoveredPoint ? (
              <div className="flex flex-wrap items-center gap-4 text-zinc-300">
                <span className="text-white font-semibold">
                  @{hoveredPoint.dist}m ({hoveredPoint.speed} km/h):
                </span>
                <span>
                  Front RH: <strong className="text-sky-300">{hoveredPoint.frontRideHeightMm} mm</strong>
                </span>
                <span>
                  Rear RH: <strong className="text-[#d4a373]">{hoveredPoint.rearRideHeightMm} mm</strong>
                </span>
                <span>
                  Rake: <strong className="text-white">{hoveredPoint.dynamicRakeMm} mm</strong>
                </span>
                <span>
                  Aero Balance: <strong className="text-[#d4a373]">{hoveredPoint.aeroBalanceFrontPct}% Front</strong>
                </span>
                <span>
                  Downforce: <strong className="text-white">{hoveredPoint.downforceKg} kg</strong>
                </span>
                {hoveredPoint.isSplitterGrounding && (
                  <span className="text-amber-400 font-semibold">[Splitter Scrape]</span>
                )}
                {hoveredPoint.isDiffuserStalling && (
                  <span className="text-rose-400 font-semibold">[Diffuser Separation]</span>
                )}
              </div>
            ) : (
              <div className="text-zinc-400">
                Hover anywhere over the lap profile to inspect exact dynamic ride heights, rake angle, and aerodynamic balance.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Speed-Binned Aero Matrix ("Wind Tunnel" Table) */
        <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="p-3 border-b border-white/10 text-xs font-semibold text-white">
            Wind Tunnel Speed-Bin Mapping Matrix
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] text-zinc-400 uppercase tracking-wider">
                  <th className="px-3.5 py-2.5">Speed Bracket</th>
                  <th className="px-3.5 py-2.5">Front Ride Height</th>
                  <th className="px-3.5 py-2.5">Rear Ride Height</th>
                  <th className="px-3.5 py-2.5">Dynamic Rake</th>
                  <th className="px-3.5 py-2.5">Aero Balance (%F)</th>
                  <th className="px-3.5 py-2.5">Downforce</th>
                  <th className="px-3.5 py-2.5">Lift-to-Drag (L/D)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.speedBins.map((b, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3.5 py-2.5 font-medium text-white">
                      {b.speedRange} km/h
                    </td>
                    <td className="px-3.5 py-2.5 text-sky-300">
                      {b.avgFrontRideHeightMm} mm
                    </td>
                    <td className="px-3.5 py-2.5 text-[#d4a373]">
                      {b.avgRearRideHeightMm} mm
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-200">
                      {b.avgDynamicRakeMm} mm
                    </td>
                    <td className="px-3.5 py-2.5 text-[#d4a373] font-semibold">
                      {b.avgAeroBalancePct}%
                    </td>
                    <td className="px-3.5 py-2.5 text-white">
                      {b.avgDownforceKg} kg
                    </td>
                    <td className="px-3.5 py-2.5 text-zinc-300">
                      {b.liftToDragRatio} : 1
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Discrete Grounding & Diffuser Events Ribbon (if any) */}
      {(data.groundingEvents.length > 0 || data.diffuserStallEvents.length > 0) && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Detected Ground Effect Anomalies
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {data.groundingEvents.map((g, idx) => (
              <div
                key={idx}
                className="rounded border border-amber-500/20 bg-amber-500/5 p-2.5 text-amber-200/90"
              >
                <div className="flex items-center justify-between font-semibold mb-0.5">
                  <span>Front Splitter Grounding</span>
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30">
                    {g.severity}
                  </span>
                </div>
                <div>{g.locationDescription}</div>
              </div>
            ))}
            {data.diffuserStallEvents.map((d, idx) => (
              <div
                key={idx}
                className="rounded border border-rose-500/20 bg-rose-500/5 p-2.5 text-rose-200/90"
              >
                <div className="flex items-center justify-between font-semibold mb-0.5">
                  <span>Diffuser Boundary Layer Stall</span>
                  <span className="uppercase text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30">
                    Flow Separation
                  </span>
                </div>
                <div>{d.locationDescription}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pitch Sensitivity & Recommendations Box */}
      <div className="mt-4 rounded-lg border border-[#d4a373]/30 bg-[#d4a373]/[0.04] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wider text-[#d4a373] font-semibold">
            Chief Aerodynamicist Diagnostics
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded border border-[#d4a373]/20 bg-[#d4a373]/10 text-[#d4a373]">
            Platform Stability
          </span>
        </div>
        <p className="text-sm text-zinc-200 mb-2">{data.overallVerdict}</p>
        <p className="text-xs text-zinc-400 mb-3">{data.pitchSensitivityVerdict}</p>

        {/* Actionable Setup Click Recommendations */}
        <div className="space-y-2 border-t border-[#d4a373]/15 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#d4a373]">
            Actionable Aero & Third Spring Recommendations:
          </div>
          <ul className="space-y-1.5">
            {data.setupRecommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                <span className="text-[#d4a373] font-bold">›</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
