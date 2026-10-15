"use client";

import React, { useState } from "react";
import { TrailBrakingAnalysis, BrakingZoneProfile } from "@/types/telemetry";

interface TrailBrakingMasterProps {
  analysis?: TrailBrakingAnalysis;
  onSelectZone?: (zone: BrakingZoneProfile) => void;
}

export const TrailBrakingMaster: React.FC<TrailBrakingMasterProps> = ({
  analysis,
  onSelectZone,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  if (!analysis || !analysis.brakingZones || analysis.brakingZones.length === 0) {
    return (
      <div className="glass-card-nested p-6 text-center text-slate-400">
        <p className="text-sm font-sans">No discrete braking zones detected in current telemetry lap.</p>
      </div>
    );
  }

  const selectedZone =
    analysis.brakingZones.find((z) => z.id === selectedZoneId) ||
    analysis.brakingZones[0];

  const getReleaseShapeBadge = (shape: BrakingZoneProfile["releaseShape"]) => {
    switch (shape) {
      case "ideal_exponential":
        return { label: "Ideal Exponential", style: "bg-emerald-950/40 border-emerald-500/30 text-emerald-400" };
      case "progressive_linear":
        return { label: "Progressive Linear", style: "bg-sky-950/40 border-sky-500/30 text-sky-400" };
      case "stepped":
        return { label: "Stepped Release", style: "bg-amber-950/40 border-amber-500/30 text-amber-400" };
      case "abrupt_chop":
        return { label: "Abrupt Chop", style: "bg-rose-950/40 border-rose-500/30 text-rose-400" };
      default:
        return { label: shape, style: "bg-zinc-800 text-zinc-300" };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-emerald-400";
    if (score >= 70) return "text-[#d4a373]";
    return "text-amber-400";
  };

  return (
    <div className="glass-card-nested mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-md">
      {/* Header Strip */}
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 items-center rounded-md border border-[#d4a373]/40 bg-[#d4a373]/15 px-2 text-xs font-semibold uppercase tracking-wider text-[#d4a373]">
                Braking Master HUD
              </span>
              <h3 className="text-base font-semibold text-white font-sans">
                Trail-Braking &amp; Deceleration Envelope Profiler
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400 font-sans">
              Initial hit rate, pedal release decay curve, steering-brake transition overlap, and brake bias optimization.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-sans">Trail Technique Grade:</span>
            <span className="rounded-lg border border-[#d4a373]/30 bg-[#d4a373]/10 px-3 py-1 text-xs font-bold text-[#d4a373] font-sans">
              {analysis.overallTrailScore >= 85 ? "Pro Precision" : analysis.overallTrailScore >= 70 ? "Competent Clubman" : "Inconsistent Release"} ({analysis.overallTrailScore}/100)
            </span>
          </div>
        </div>

        {/* Brake Bias Recommendation Banner */}
        <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-950/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 font-bold text-xs">
                BIAS
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-sky-300 font-sans">
                  Mechanical Brake Bias Recommendation:{" "}
                  {analysis.recommendedBrakeBiasDeltaPct === 0 ? (
                    <span className="text-emerald-400">Current Setting Optimal</span>
                  ) : (
                    <span className="text-[#d4a373]">
                      {analysis.recommendedBrakeBiasDeltaPct > 0 ? `+${analysis.recommendedBrakeBiasDeltaPct.toFixed(1)}% Forward` : `${analysis.recommendedBrakeBiasDeltaPct.toFixed(1)}% Rearward`}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-300 font-sans mt-0.5">
                  {analysis.biasRecommendationRationale}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-sans">
              <div className="rounded-lg bg-black/40 border border-white/5 px-3 py-1.5 text-center">
                <div className="text-[10px] text-slate-400">Avg Peak Decel</div>
                <div className="text-sm font-bold text-white">{analysis.averagePeakDecelG.toFixed(2)}G</div>
              </div>
              <div className="rounded-lg bg-black/40 border border-white/5 px-3 py-1.5 text-center">
                <div className="text-[10px] text-slate-400">Ideal Release Rate</div>
                <div className="text-sm font-bold text-emerald-400">{analysis.idealReleasePct}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 space-y-6">
        {/* Selected Zone Deep Dive Card */}
        {selectedZone && (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-bold text-[#d4a373] font-sans">
                  {selectedZone.id}
                </span>
                <span className="text-sm font-bold text-white font-sans">{selectedZone.cornerName}</span>
                <span className="text-xs text-slate-400 font-sans">
                  ({Math.round(selectedZone.entrySpeedKmh)} km/h &rarr; {Math.round(selectedZone.minSpeedKmh)} km/h, &Delta; {Math.round(selectedZone.speedDropKmh)} km/h scrubbed)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const badge = getReleaseShapeBadge(selectedZone.releaseShape);
                  return (
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold font-sans ${badge.style}`}>
                      {badge.label}
                    </span>
                  );
                })()}
                <span className={`text-sm font-bold font-sans ${getScoreColor(selectedZone.trailBrakingScore)}`}>
                  Score: {selectedZone.trailBrakingScore}/100
                </span>
              </div>
            </div>

            {/* Metrics Breakdown for this zone */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
              <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                <div className="text-slate-400 text-[11px]">Braking Distance</div>
                <div className="text-base font-bold text-white mt-1">
                  {Math.round(selectedZone.lengthMeters)} m
                </div>
                <div className="text-[10px] text-slate-500">From {Math.round(selectedZone.startDist)}m to {Math.round(selectedZone.endDist)}m</div>
              </div>

              <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                <div className="text-slate-400 text-[11px]">Initial Pedal Hit</div>
                <div className="text-base font-bold text-sky-400 mt-1">
                  {selectedZone.peakDecelG.toFixed(2)}G
                </div>
                <div className="text-[10px] text-slate-500">Hit rate: {Math.round(selectedZone.initialHitRatePctPerSec)}%/s</div>
              </div>

              <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                <div className="text-slate-400 text-[11px]">Steering Overlap Blend</div>
                <div className="text-base font-bold text-[#d4a373] mt-1">
                  {selectedZone.steeringOverlapDeg.toFixed(1)}°
                </div>
                <div className="text-[10px] text-slate-500">Wheel angle while trailing</div>
              </div>

              <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                <div className="text-slate-400 text-[11px]">Balance Risks</div>
                <div className="text-sm font-bold mt-1">
                  {selectedZone.frontLockupRisk ? (
                    <span className="text-amber-400">Front Lockup</span>
                  ) : selectedZone.rearInstabilityRisk ? (
                    <span className="text-rose-400">Rear Instability</span>
                  ) : (
                    <span className="text-emerald-400">Clean Rotation</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">Axle load distribution</div>
              </div>
            </div>

            {/* Driver Coaching Recommendation */}
            <div className="mt-3 rounded-lg border border-white/5 bg-zinc-950/60 p-3 text-xs font-sans text-slate-300 leading-relaxed">
              <strong className="text-white">Engineering Verdict: </strong>
              {selectedZone.verdict}
            </div>
          </div>
        )}

        {/* Zones Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-zinc-900/90 text-[11px] uppercase tracking-wider text-slate-400 font-sans">
              <tr>
                <th className="py-3 pl-4 pr-3">Corner / Zone</th>
                <th className="py-3 px-3">Entry &rarr; Apex Speed</th>
                <th className="py-3 px-3">Braking Distance</th>
                <th className="py-3 px-3">Peak Decel G</th>
                <th className="py-3 px-3">Steering Overlap</th>
                <th className="py-3 px-3">Pedal Release Profile</th>
                <th className="py-3 px-3">Trail Score</th>
                <th className="py-3 pl-3 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analysis.brakingZones.map((zone) => {
                const isSelected = selectedZone?.id === zone.id;
                const shapeBadge = getReleaseShapeBadge(zone.releaseShape);
                return (
                  <tr
                    key={zone.id}
                    onClick={() => {
                      setSelectedZoneId(zone.id);
                      onSelectZone?.(zone);
                    }}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${
                      isSelected ? "bg-[#d4a373]/15 border-l-2 border-[#d4a373]" : ""
                    }`}
                  >
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="font-semibold text-white flex items-center gap-2 font-sans">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-[#d4a373]">
                          {zone.id}
                        </span>
                        <span>{zone.cornerName}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">
                        Apex: {Math.round(zone.endDist)}m
                      </div>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <span className="text-white">{Math.round(zone.entrySpeedKmh)}</span>
                      <span className="text-slate-500 mx-1">&rarr;</span>
                      <span className="text-white">{Math.round(zone.minSpeedKmh)}</span>
                      <span className="text-slate-400 text-[11px] ml-1.5">(-{Math.round(zone.speedDropKmh)} km/h)</span>
                    </td>

                    <td className="py-3 px-3 text-slate-300 font-sans">
                      <span className="font-medium text-white">{Math.round(zone.lengthMeters)}m</span>
                    </td>

                    <td className="py-3 px-3 font-sans">
                      <span className="font-bold text-sky-400">{zone.peakDecelG.toFixed(2)}G</span>
                    </td>

                    <td className="py-3 px-3 font-sans text-slate-300">
                      <span className="font-medium text-[#d4a373]">{zone.steeringOverlapDeg.toFixed(1)}°</span>
                      <span className="text-[11px] text-slate-500 ml-1">overlap</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium font-sans ${shapeBadge.style}`}>
                        {shapeBadge.label}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-sans font-bold">
                      <span className={getScoreColor(zone.trailBrakingScore)}>
                        {zone.trailBrakingScore}/100
                      </span>
                    </td>

                    <td className="py-3 pl-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedZoneId(zone.id);
                          onSelectZone?.(zone);
                        }}
                        className="rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition font-sans"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
