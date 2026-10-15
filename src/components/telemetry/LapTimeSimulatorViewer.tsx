"use client";

import React, { useState, useMemo } from "react";
import { computeLapSimulation, SimulationOptions } from "@/lib/lap-time-simulator";
import { VehicleSimParameters, LapSimulationResult } from "@/types/telemetry";

interface LapTimeSimulatorViewerProps {
  initialTrack?: string;
  onApplyTrimToSetup?: (sensitivity: string) => void;
}

export const LapTimeSimulatorViewer: React.FC<LapTimeSimulatorViewerProps> = ({
  initialTrack = "Autodromo Nazionale Monza",
  onApplyTrimToSetup,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<string>(initialTrack);
  const [powerBhp, setPowerBhp] = useState<number>(520);
  const [massKg, setMassKg] = useState<number>(1320);
  const [wingAngleOffsetDeg, setWingAngleOffsetDeg] = useState<number>(0);
  const [tireGripMultiplier, setTireGripMultiplier] = useState<number>(1.0);
  const [frontRideHeightOffsetMm, setFrontRideHeightOffsetMm] = useState<number>(0);

  const vehicleParams: Partial<VehicleSimParameters> = useMemo(() => {
    // Base GT3 CdA = 1.54, ClA = 5.25
    const deltaWingClA = wingAngleOffsetDeg * 0.16;
    const deltaWingCdA = wingAngleOffsetDeg * 0.044;

    // Ride height effect: lower front RH increases ClA by 0.055 per mm
    const deltaRhClA = -frontRideHeightOffsetMm * 0.055;

    return {
      enginePowerBhp: powerBhp,
      massKg,
      dragCdA: Math.max(1.0, 1.54 + deltaWingCdA),
      downforceClA: Math.max(2.5, 5.25 + deltaWingClA + deltaRhClA),
      tireMuX: 1.72 * tireGripMultiplier,
      tireMuY: 1.84 * tireGripMultiplier,
      aeroBalanceFrontPct: 42.5 - wingAngleOffsetDeg * 0.7 + (-frontRideHeightOffsetMm * 0.45),
    };
  }, [powerBhp, massKg, wingAngleOffsetDeg, tireGripMultiplier, frontRideHeightOffsetMm]);

  const simResult: LapSimulationResult = useMemo(() => {
    return computeLapSimulation({
      trackName: selectedTrack,
      vehicleParams,
    });
  }, [selectedTrack, vehicleParams]);

  // Compute baseline comparison for delta display
  const baselineSim: LapSimulationResult = useMemo(() => {
    return computeLapSimulation({
      trackName: selectedTrack,
    });
  }, [selectedTrack]);

  const netLapDeltaSeconds = Number((simResult.lapTimeSeconds - baselineSim.lapTimeSeconds).toFixed(3));

  // SVG Chart Dimensions
  const chartW = 800;
  const chartH = 220;
  const padLeft = 45;
  const padBottom = 25;
  const padTop = 15;
  const padRight = 15;

  const maxDist = simResult.trackLengthMeters;
  const maxSpeed = 320;

  const toChartX = (dist: number) => padLeft + (dist / maxDist) * (chartW - padLeft - padRight);
  const toChartY = (speed: number) => chartH - padBottom - (speed / maxSpeed) * (chartH - padBottom - padTop);

  // SVG speed path
  const speedPath = simResult.points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${toChartX(p.dist)} ${toChartY(p.speedKmh)}`)
    .join(" ");

  // Baseline speed path
  const baseSpeedPath = baselineSim.points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${toChartX(p.dist)} ${toChartY(p.speedKmh)}`)
    .join(" ");

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Circuit Layout:</span>
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="px-3 py-1.5 bg-black/50 border border-white/10 rounded-lg text-xs font-medium text-white focus:outline-none focus:border-red-500"
          >
            <option value="Autodromo Nazionale Monza">Monza GP (High Speed / Power)</option>
            <option value="Circuit de Spa-Francorchamps">Spa-Francorchamps (Medium Downforce)</option>
            <option value="Silverstone Circuit">Silverstone GP (High Lateral G)</option>
            <option value="Suzuka International Racing Course">Suzuka (High Aero / Technical)</option>
            <option value="Autódromo José Carlos Pace (Interlagos)">Interlagos (Balanced / Rolling)</option>
            <option value="Nürburgring GP">Nürburgring GP (Mechanical / Curbs)</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase text-slate-400">Projected Lap Time</div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {simResult.lapTimeFormatted}
              {netLapDeltaSeconds !== 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${
                    netLapDeltaSeconds < 0
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {netLapDeltaSeconds < 0 ? `${netLapDeltaSeconds}s` : `+${netLapDeltaSeconds}s`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Velocity Profile Chart */}
      <div className="p-6 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Quasi-Static Velocity Profile (Forward-Backward Solver)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Speed vs Distance solved via engine tractive force, aerodynamic drag, and Kamm friction envelope
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <span className="w-3 h-0.5 bg-emerald-400 rounded" />
              Active Setup
            </span>
            <span className="flex items-center gap-1.5 text-slate-400 font-mono">
              <span className="w-3 h-0.5 bg-slate-500 stroke-dasharray rounded" />
              Baseline Target
            </span>
          </div>
        </div>

        {/* SVG Speed vs Distance Chart */}
        <div className="w-full bg-slate-950 rounded-lg border border-white/5 p-2 overflow-hidden">
          <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto select-none">
            {/* Grid Lines */}
            {[50, 100, 150, 200, 250, 300].map((spd) => (
              <g key={spd}>
                <line
                  x1={padLeft}
                  y1={toChartY(spd)}
                  x2={chartW - padRight}
                  y2={toChartY(spd)}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                <text x={padLeft - 6} y={toChartY(spd) + 3} fill="rgba(148, 163, 184, 0.6)" fontSize="9" fontFamily="monospace" textAnchor="end">
                  {spd}
                </text>
              </g>
            ))}

            {/* Sector Division Shading */}
            <rect x={toChartX(0)} y={padTop} width={toChartX(maxDist * 0.33) - toChartX(0)} height={chartH - padBottom - padTop} fill="rgba(56, 189, 248, 0.02)" />
            <rect x={toChartX(maxDist * 0.33)} y={padTop} width={toChartX(maxDist * 0.67) - toChartX(maxDist * 0.33)} height={chartH - padBottom - padTop} fill="rgba(168, 85, 247, 0.02)" />
            <rect x={toChartX(maxDist * 0.67)} y={padTop} width={toChartX(maxDist) - toChartX(maxDist * 0.67)} height={chartH - padBottom - padTop} fill="rgba(245, 158, 11, 0.02)" />

            <text x={toChartX(maxDist * 0.16)} y={padTop + 14} fill="rgba(56, 189, 248, 0.5)" fontSize="10" fontFamily="monospace" textAnchor="middle">
              SECTOR 1 ({simResult.sectors[0]?.timeSeconds}s)
            </text>
            <text x={toChartX(maxDist * 0.50)} y={padTop + 14} fill="rgba(168, 85, 247, 0.5)" fontSize="10" fontFamily="monospace" textAnchor="middle">
              SECTOR 2 ({simResult.sectors[1]?.timeSeconds}s)
            </text>
            <text x={toChartX(maxDist * 0.83)} y={padTop + 14} fill="rgba(245, 158, 11, 0.5)" fontSize="10" fontFamily="monospace" textAnchor="middle">
              SECTOR 3 ({simResult.sectors[2]?.timeSeconds}s)
            </text>

            {/* Baseline Speed Curve */}
            <path d={baseSpeedPath} fill="none" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />

            {/* Active Setup Speed Curve */}
            <path d={speedPath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Live Setup Parameter Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Rear Wing Trim:</span>
              <span className="font-mono text-cyan-400 font-semibold">{wingAngleOffsetDeg > 0 ? `+${wingAngleOffsetDeg}` : wingAngleOffsetDeg}°</span>
            </div>
            <input
              type="range"
              min="-4"
              max="4"
              step="1"
              value={wingAngleOffsetDeg}
              onChange={(e) => setWingAngleOffsetDeg(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Front Ride Height:</span>
              <span className="font-mono text-blue-400 font-semibold">{frontRideHeightOffsetMm > 0 ? `+${frontRideHeightOffsetMm}` : frontRideHeightOffsetMm} mm</span>
            </div>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={frontRideHeightOffsetMm}
              onChange={(e) => setFrontRideHeightOffsetMm(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Chassis Mass:</span>
              <span className="font-mono text-amber-400 font-semibold">{massKg} kg</span>
            </div>
            <input
              type="range"
              min="1250"
              max="1420"
              step="10"
              value={massKg}
              onChange={(e) => setMassKg(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Engine Power:</span>
              <span className="font-mono text-red-400 font-semibold">{powerBhp} BHP</span>
            </div>
            <input
              type="range"
              min="480"
              max="580"
              step="5"
              value={powerBhp}
              onChange={(e) => setPowerBhp(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
          </div>

          <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Tire Grip (Mu):</span>
              <span className="font-mono text-emerald-400 font-semibold">{(tireGripMultiplier * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.92"
              max="1.10"
              step="0.01"
              value={tireGripMultiplier}
              onChange={(e) => setTireGripMultiplier(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Setup Sensitivity Ranking Matrix */}
      <div className="p-6 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
              Setup Sensitivity Matrix (Lap Time Derivatives)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Differential simulation runs showing exact tenth-of-a-second tradeoffs for each parameter perturbation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {simResult.sensitivities.map((sens, idx) => {
            const isFaster = sens.lapTimeDeltaSeconds < 0;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-white/5 bg-black/40 space-y-2 hover:border-white/10 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{sens.parameterName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      isFaster
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {isFaster ? `${sens.lapTimeDeltaSeconds}s` : `+${sens.lapTimeDeltaSeconds}s`}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {sens.verdict}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-white/5">
                  <span>Top Speed: {sens.topSpeedDeltaKmh > 0 ? `+${sens.topSpeedDeltaKmh}` : sens.topSpeedDeltaKmh} km/h</span>
                  <span>Apex Speed: {sens.minCornerSpeedDeltaKmh > 0 ? `+${sens.minCornerSpeedDeltaKmh}` : sens.minCornerSpeedDeltaKmh} km/h</span>
                </div>

                {onApplyTrimToSetup && (
                  <button
                    type="button"
                    className="w-full mt-1.5 py-1 text-[11px] font-medium rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-center"
                    onClick={() => onApplyTrimToSetup(sens.parameterName)}
                  >
                    Apply to Setup Engine
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
            Point-Mass Simulation Executive Conclusion
          </div>
          <p className="text-xs text-slate-300">
            {simResult.executiveSummary}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-mono uppercase text-slate-400">Mean Apex / Top Speed</div>
          <div className="text-sm font-bold font-mono text-white">
            {simResult.averageSpeedKmh} / {simResult.topSpeedKmh} km/h
          </div>
        </div>
      </div>
    </div>
  );
};
