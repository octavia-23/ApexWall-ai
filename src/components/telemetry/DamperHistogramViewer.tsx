"use client";

import React, { useState } from "react";
import {
  DamperHistogramAnalysis,
  DamperCorner,
  CornerDamperStats,
  DamperVelocityBin,
} from "@/types/telemetry";

interface DamperHistogramViewerProps {
  data: DamperHistogramAnalysis;
}

const CORNER_NAMES: Record<DamperCorner, string> = {
  FL: "Front Left",
  FR: "Front Right",
  RL: "Rear Left",
  RR: "Rear Right",
};

export const DamperHistogramViewer: React.FC<DamperHistogramViewerProps> = ({ data }) => {
  const [selectedCorner, setSelectedCorner] = useState<"ALL" | DamperCorner>("ALL");
  const [hoveredBin, setHoveredBin] = useState<{
    corner: DamperCorner;
    bin: DamperVelocityBin;
  } | null>(null);

  const corners: DamperCorner[] = ["FL", "FR", "RL", "RR"];

  return (
    <div className="damper-histogram-card glass-card-nested rounded-xl border border-white/10 bg-black/40 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#d4a373] font-semibold">
              Suspension Dynamics
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.04] text-zinc-300">
              {data.isSynthesized
                ? "Kinematic Inertial Model (Pitch/Roll/Heave)"
                : "Authentic Suspension Potentiometers"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-1">
            MoTeC-Grade Damper Velocity Histograms
          </h3>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-1">
          <button
            type="button"
            onClick={() => setSelectedCorner("ALL")}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium ${
              selectedCorner === "ALL"
                ? "bg-[#d4a373] text-black font-semibold shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            4-Corner Matrix
          </button>
          {corners.map((corner) => (
            <button
              key={corner}
              type="button"
              onClick={() => setSelectedCorner(corner)}
              className={`px-2.5 py-1.5 text-xs rounded transition-colors font-medium ${
                selectedCorner === corner
                  ? "bg-[#d4a373] text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {corner}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {selectedCorner === "ALL" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {corners.map((corner) => (
            <CornerHistogramCard
              key={corner}
              corner={corner}
              stats={data.corners[corner]}
              onHoverBin={(bin) => setHoveredBin(bin ? { corner, bin } : null)}
              onSelect={() => setSelectedCorner(corner)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <CornerHistogramCard
            corner={selectedCorner}
            stats={data.corners[selectedCorner]}
            detailed
            onHoverBin={(bin) => setHoveredBin(bin ? { corner: selectedCorner, bin } : null)}
          />
        </div>
      )}

      {/* Live Tooltip / Inspector Ribbon */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs">
        {hoveredBin ? (
          <div className="flex flex-wrap items-center gap-4 text-zinc-300">
            <span className="text-[#d4a373] font-semibold">
              {hoveredBin.corner} ({CORNER_NAMES[hoveredBin.corner]}):
            </span>
            <span>
              Velocity:{" "}
              <strong className="text-white">
                {hoveredBin.bin.minVelocity} to {hoveredBin.bin.maxVelocity} mm/s
              </strong>
            </span>
            <span>
              Regime:{" "}
              <strong className="text-white capitalize">
                {hoveredBin.bin.regime.replace("_", " ")}
              </strong>
            </span>
            <span>
              Distribution:{" "}
              <strong className="text-[#d4a373]">
                {hoveredBin.bin.percentage.toFixed(2)}%
              </strong>{" "}
              ({hoveredBin.bin.count} samples)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Hover over any histogram bar to inspect exact shaft velocity distribution and sample count.</span>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-blue-600"></span>
            <span>High Bump (&lt;-50 mm/s)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-sky-400"></span>
            <span>Low Bump (-50 to 0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-[#d4a373]"></span>
            <span>Low Rebound (0 to +50)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2.5 rounded-sm bg-amber-600"></span>
            <span>High Rebound (&gt;+50 mm/s)</span>
          </div>
        </div>
      </div>

      {/* Front/Rear Low-Speed Transient Platform Balance */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400 uppercase tracking-wider font-semibold">
              Front Axle Low-Speed Energy
            </span>
            <span className="text-white font-semibold">
              {data.frontRearLowSpeedBalance.frontPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-sky-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, data.frontRearLowSpeedBalance.frontPct)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            Transient chassis platform support under braking and turn-in load.
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400 uppercase tracking-wider font-semibold">
              Rear Axle Low-Speed Energy
            </span>
            <span className="text-white font-semibold">
              {data.frontRearLowSpeedBalance.rearPct}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-[#d4a373] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, data.frontRearLowSpeedBalance.rearPct)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            Transient pitch and rotation resistance during corner apex and power exit.
          </div>
        </div>
      </div>

      {/* Chief Race Engineer Damping Verdict & Click Adjustments */}
      <div className="mt-4 rounded-lg border border-[#d4a373]/30 bg-[#d4a373]/[0.04] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wider text-[#d4a373] font-semibold">
            Race Engineer Damping Diagnostics
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded border border-[#d4a373]/20 bg-[#d4a373]/10 text-[#d4a373]">
            {data.frontRearLowSpeedBalance.verdict}
          </span>
        </div>
        <p className="text-sm text-zinc-200 mb-3">{data.overallVerdict}</p>

        {/* Actionable Click Fixes */}
        <div className="space-y-2 border-t border-[#d4a373]/15 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#d4a373]">
            Actionable Setup Click Recommendations:
          </div>
          <ul className="space-y-1.5">
            {data.engineerRecommendations.map((rec, idx) => (
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

interface CornerHistogramCardProps {
  corner: DamperCorner;
  stats: CornerDamperStats;
  detailed?: boolean;
  onHoverBin?: (bin: DamperVelocityBin | null) => void;
  onSelect?: () => void;
}

const CornerHistogramCard: React.FC<CornerHistogramCardProps> = ({
  corner,
  stats,
  detailed = false,
  onHoverBin,
  onSelect,
}) => {
  const maxPct = Math.max(12, ...stats.bins.map((b) => b.percentage));
  const height = detailed ? 180 : 130;
  const numBins = stats.bins.length;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-white/20">
      {/* Corner Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white tracking-wide">
            {corner}
          </span>
          <span className="text-xs text-zinc-400">
            {CORNER_NAMES[corner]}
          </span>
          {stats.isPackingDown && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 text-rose-300 font-medium">
              Packing Down
            </span>
          )}
          {stats.isOverstiffLowSpeed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium">
              Overstiff Low-Speed
            </span>
          )}
        </div>

        {onSelect && (
          <button
            type="button"
            onClick={onSelect}
            className="text-[11px] text-[#d4a373] hover:underline"
          >
            Zoom In
          </button>
        )}
      </div>

      {/* Symmetrical SVG Histogram */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 480 ${height}`}
          className="w-full h-auto block select-none"
          preserveAspectRatio="none"
        >
          {/* Background grid horizontal lines */}
          {[0.25, 0.5, 0.75].map((fraction, i) => (
            <line
              key={i}
              x1="0"
              y1={height * (1 - fraction)}
              x2="480"
              y2={height * (1 - fraction)}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          ))}

          {/* Center Zero Line (Axis) */}
          <line
            x1="240"
            y1="0"
            x2="240"
            y2={height}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1"
          />

          {/* Low Speed / High Speed Threshold Lines (+/- 50 mm/s) */}
          {/* Total range is -300 to +300 = 600 mm/s width. -50 is at (250/600)*480 = 200px. +50 is at (350/600)*480 = 280px */}
          <line
            x1="200"
            y1="0"
            x2="200"
            y2={height}
            stroke="rgba(212, 163, 115, 0.35)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />
          <line
            x1="280"
            y1="0"
            x2="280"
            y2={height}
            stroke="rgba(212, 163, 115, 0.35)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />

          {/* Histogram Bars */}
          {stats.bins.map((bin, idx) => {
            const barWidth = 480 / numBins - 1;
            const barX = idx * (480 / numBins) + 0.5;
            const barHeight = Math.max(1, (bin.percentage / maxPct) * (height - 18));
            const barY = height - barHeight;

            let fillColor = "#3b82f6"; // High Bump
            if (bin.regime === "low_bump") fillColor = "#38bdf8"; // Low Bump
            else if (bin.regime === "low_rebound") fillColor = "#d4a373"; // Low Rebound
            else if (bin.regime === "high_rebound") fillColor = "#d97706"; // High Rebound

            return (
              <rect
                key={idx}
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                fill={fillColor}
                opacity={0.88}
                rx={1}
                className="transition-all hover:opacity-100 hover:brightness-125 cursor-pointer"
                onMouseEnter={() => onHoverBin?.(bin)}
                onMouseLeave={() => onHoverBin?.(null)}
              />
            );
          })}
        </svg>

        {/* Axis Labels */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1.5 px-1 font-sans">
          <span>-300 mm/s</span>
          <span className="text-sky-400/80 font-medium">-50 (Bump)</span>
          <span className="text-zinc-300 font-medium">0</span>
          <span className="text-[#d4a373] font-medium">+50 (Reb)</span>
          <span>+300 mm/s</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs">
        <div className="rounded bg-white/[0.02] p-2 border border-white/5">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Bump / Rebound</div>
          <div className="text-white font-medium mt-0.5">
            {stats.bumpPct}% / {stats.reboundPct}%
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Ratio: {stats.bumpReboundRatio}
          </div>
        </div>

        <div className="rounded bg-white/[0.02] p-2 border border-white/5">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Low / High Speed</div>
          <div className="text-white font-medium mt-0.5">
            {stats.lowSpeedTotalPct}% / {stats.highSpeedTotalPct}%
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Target: ~65% / 35%
          </div>
        </div>

        <div className="rounded bg-white/[0.02] p-2 border border-white/5">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Peak Compression</div>
          <div className="text-sky-300 font-medium mt-0.5">
            {stats.minRecordedVelocity} mm/s
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Low Bump: {stats.lowSpeedBumpPct}%
          </div>
        </div>

        <div className="rounded bg-white/[0.02] p-2 border border-white/5">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Peak Extension</div>
          <div className="text-[#d4a373] font-medium mt-0.5">
            +{stats.maxRecordedVelocity} mm/s
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">
            Low Reb: {stats.lowSpeedReboundPct}%
          </div>
        </div>
      </div>

      {/* Warnings / Anomaly Details */}
      {stats.anomalyFlags.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {stats.anomalyFlags.map((flag, i) => (
            <div
              key={i}
              className="text-[11px] text-amber-200/90 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1"
            >
              {flag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
