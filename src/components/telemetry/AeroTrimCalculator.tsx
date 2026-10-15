"use client";

import React, { useState, useMemo } from "react";
import { AeroTrimParameters, AeroTrimResult } from "@/types/telemetry";
import { computeAeroTrim } from "@/lib/aero-trim-calculator";

interface AeroTrimCalculatorProps {
  initialParams?: Partial<AeroTrimParameters>;
  carArchetype?: string;
}

export const AeroTrimCalculator: React.FC<AeroTrimCalculatorProps> = ({
  initialParams,
  carArchetype = "GT3",
}) => {
  const [frontHeight, setFrontHeight] = useState<number>(
    initialParams?.frontRideHeightMm ?? 52
  );
  const [rearHeight, setRearHeight] = useState<number>(
    initialParams?.rearRideHeightMm ?? 72
  );
  const [wingAngle, setWingAngle] = useState<number>(
    initialParams?.rearWingAngleDeg ?? 8
  );
  const [targetSpeed, setTargetSpeed] = useState<number>(
    initialParams?.speedKmh ?? 250
  );

  const trimResult: AeroTrimResult = useMemo(() => {
    return computeAeroTrim(
      {
        frontRideHeightMm: frontHeight,
        rearRideHeightMm: rearHeight,
        rearWingAngleDeg: wingAngle,
        speedKmh: targetSpeed,
      },
      carArchetype
    );
  }, [frontHeight, rearHeight, wingAngle, targetSpeed, carArchetype]);

  const applyPreset = (preset: "monza" | "spa" | "monaco") => {
    if (preset === "monza") {
      setFrontHeight(55);
      setRearHeight(68);
      setWingAngle(3);
    } else if (preset === "spa") {
      setFrontHeight(52);
      setRearHeight(74);
      setWingAngle(8);
    } else if (preset === "monaco") {
      setFrontHeight(48);
      setRearHeight(80);
      setWingAngle(13);
    }
  };

  const isBottoming = trimResult.dynamicFrontRideHeight250Mm < 8.0;

  return (
    <div className="glass-card-nested mb-6 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-md">
      {/* Header Strip */}
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 items-center rounded-md border border-sky-500/40 bg-sky-500/15 px-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                Aero Matrix HUD
              </span>
              <h3 className="text-base font-semibold text-white font-sans">
                Aerodynamic Rake &amp; Wing Trim Simulator
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400 font-sans">
              CFD ground-effect suction, aerodynamic rake angle, dynamic pitch heave, and top speed projection.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900/80 p-1">
            <button
              type="button"
              onClick={() => applyPreset("monza")}
              className="rounded px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition font-sans"
            >
              Low Drag (Monza)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("spa")}
              className="rounded px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition font-sans"
            >
              Balanced (Spa)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("monaco")}
              className="rounded px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-white transition font-sans"
            >
              High DF (Monaco)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5">
        {/* Sliders Column */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
              Mechanical Chassis Geometry
            </h4>

            {/* Front Ride Height */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-sans">
                <span className="text-slate-400 font-medium">Front Ride Height (Static)</span>
                <span className="text-sky-400 font-bold">{frontHeight} mm</span>
              </div>
              <input
                type="range"
                min="42"
                max="75"
                step="1"
                value={frontHeight}
                onChange={(e) => setFrontHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#d4a373]"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-sans">
                <span>42 mm (Low / Stiff)</span>
                <span>Optimal Splitter: 48-52mm</span>
                <span>75 mm (High)</span>
              </div>
            </div>

            {/* Rear Ride Height */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-sans">
                <span className="text-slate-400 font-medium">Rear Ride Height (Static)</span>
                <span className="text-[#d4a373] font-bold">{rearHeight} mm</span>
              </div>
              <input
                type="range"
                min="55"
                max="105"
                step="1"
                value={rearHeight}
                onChange={(e) => setRearHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#d4a373]"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-sans">
                <span>55 mm (Flat Rake)</span>
                <span>Diffuser Window: 70-80mm</span>
                <span>105 mm (High Rake)</span>
              </div>
            </div>

            {/* Rear Wing Angle */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-sans">
                <span className="text-slate-400 font-medium">Rear Wing Trim Angle</span>
                <span className="text-emerald-400 font-bold">{wingAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="16"
                step="1"
                value={wingAngle}
                onChange={(e) => setWingAngle(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-sans">
                <span>0° (Slick Trim)</span>
                <span>GT3 Default: 7-9°</span>
                <span>16° (Max Downforce)</span>
              </div>
            </div>

            {/* Target Speed Slider */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex justify-between items-center text-xs mb-1.5 font-sans">
                <span className="text-slate-400 font-medium">Evaluation Velocity</span>
                <span className="text-white font-bold">{targetSpeed} km/h</span>
              </div>
              <input
                type="range"
                min="100"
                max="300"
                step="10"
                value={targetSpeed}
                onChange={(e) => setTargetSpeed(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>
          </div>

          {/* Dynamic Aero Clearance HUD Card */}
          <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans">
                Dynamic Clearance @ 250 km/h
              </h4>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider font-sans ${
                  isBottoming
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {isBottoming ? "Bottoming Risk" : "Clearance Safe"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-sans">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[11px]">Dynamic Front</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {trimResult.dynamicFrontRideHeight250Mm} mm
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Δ -{(frontHeight - trimResult.dynamicFrontRideHeight250Mm).toFixed(1)}mm aero heave
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <div className="text-slate-400 text-[11px]">Dynamic Rear</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {trimResult.dynamicRearRideHeight250Mm} mm
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Δ -{(rearHeight - trimResult.dynamicRearRideHeight250Mm).toFixed(1)}mm aero squat
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calculated Results Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Aero Balance Proportion Bar */}
          <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-bold uppercase tracking-wider text-slate-300">
                Aero Balance Split
              </span>
              <span className="text-[#d4a373] font-bold">
                Front {trimResult.frontAeroBalancePct}% / Rear {trimResult.rearAeroBalancePct}%
              </span>
            </div>

            {/* Split Bar */}
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-zinc-800 p-0.5 flex">
              <div
                style={{ width: `${trimResult.frontAeroBalancePct}%` }}
                className="h-full rounded-l-full bg-sky-500 transition-all duration-300"
              />
              <div
                style={{ width: `${trimResult.rearAeroBalancePct}%` }}
                className="h-full rounded-r-full bg-[#d4a373] transition-all duration-300"
              />
              {/* Neutral Center Reference Marker */}
              <div
                style={{ left: "40%" }}
                className="absolute top-0 bottom-0 w-0.5 bg-white/40 pointer-events-none"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-sans">
              <span className="text-sky-400 font-medium">Front Splitter &amp; Floor ({trimResult.frontAeroBalancePct}%)</span>
              <span className="text-slate-500">Neutral Target ~39-41%</span>
              <span className="text-[#d4a373] font-medium">Diffuser &amp; Wing ({trimResult.rearAeroBalancePct}%)</span>
            </div>
          </div>

          {/* Key Output Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <div className="text-[11px] text-slate-400 font-sans">Aerodynamic Rake</div>
              <div className="mt-1 text-lg font-bold text-white font-sans">
                +{trimResult.rakeHeightMm} mm
              </div>
              <div className="text-[10px] text-[#d4a373] font-sans">
                {trimResult.rakeAngleDeg}° pitch inclination
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <div className="text-[11px] text-slate-400 font-sans">Downforce @ 250</div>
              <div className="mt-1 text-lg font-bold text-sky-400 font-sans">
                {trimResult.totalDownforceKg250} kgf
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                @ 150 km/h: {trimResult.totalDownforceKg150} kgf
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <div className="text-[11px] text-slate-400 font-sans">Aerodynamic Drag</div>
              <div className="mt-1 text-lg font-bold text-amber-400 font-sans">
                {trimResult.totalDragKg250} kgf
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                L/D Ratio: <span className="text-emerald-400 font-bold">{trimResult.liftToDragRatio}:1</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <div className="text-[11px] text-slate-400 font-sans">Projected Top Speed</div>
              <div className="mt-1 text-lg font-bold text-white font-sans">
                {trimResult.projectedTopSpeedKmh} km/h
              </div>
              <div className="text-[10px] text-slate-500 font-sans">
                Terminal Straight Speed
              </div>
            </div>
          </div>

          {/* Aerodynamic Pitch Migration & High Speed vs Low Speed Shift */}
          <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-semibold text-white">Velocity Sensitivity &amp; High-Speed Balance Shift</span>
              <span className="text-sky-400 font-medium">Δ Balance: +{trimResult.highSpeedBalanceShiftPct}% Front</span>
            </div>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              As speed increases from 150 km/h to 250 km/h, aero suction on the front splitter increases downforce, shifting aero balance forward by {trimResult.highSpeedBalanceShiftPct}%. Ensure high-speed entry stability is supported by appropriate front bump stop packers.
            </p>
          </div>

          {/* Race Engineer Advice */}
          <div className="rounded-xl border border-[#d4a373]/30 bg-[#d4a373]/10 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#d4a373] text-[10px] font-bold text-black">
                ENG
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#d4a373] font-sans">
                Chief Race Engineer Recommendation
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-300 font-sans leading-relaxed">
              {trimResult.engineerAdvice}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
