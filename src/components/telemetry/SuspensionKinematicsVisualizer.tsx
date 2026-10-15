"use client";

import React, { useState, useMemo } from "react";
import {
  computeSuspensionKinematics,
  KinematicsOptions,
} from "@/lib/suspension-kinematics-calculator";
import { SuspensionKinematicsAnalysis } from "@/types/telemetry";

interface SuspensionKinematicsVisualizerProps {
  initialArchetype?: "gt3" | "formula_modern" | "prototype" | "cup_gt4";
  onApplyCamberToSetup?: (camberDeg: number, axle: "front" | "rear") => void;
}

export const SuspensionKinematicsVisualizer: React.FC<SuspensionKinematicsVisualizerProps> = ({
  initialArchetype = "gt3",
  onApplyCamberToSetup,
}) => {
  const [archetype, setArchetype] = useState<"gt3" | "formula_modern" | "prototype" | "cup_gt4">(
    initialArchetype
  );
  const [activeAxle, setActiveAxle] = useState<"front" | "rear">("front");
  const [lateralG, setLateralG] = useState<number>(1.75);
  const [heaveMm, setHeaveMm] = useState<number>(0);
  const [staticCamberFront, setStaticCamberFront] = useState<number>(-3.4);
  const [staticCamberRear, setStaticCamberRear] = useState<number>(-2.8);
  const [rollStiffnessFront, setRollStiffnessFront] = useState<number>(1950);
  const [rollStiffnessRear, setRollStiffnessRear] = useState<number>(1550);

  const kinematics: SuspensionKinematicsAnalysis = useMemo(() => {
    return computeSuspensionKinematics({
      carArchetype: archetype,
      lateralAccG: lateralG,
      heaveMm,
      customStaticCamberFrontDeg: staticCamberFront,
      customStaticCamberRearDeg: staticCamberRear,
      customRollStiffnessFrontNmDeg: rollStiffnessFront,
      customRollStiffnessRearNmDeg: rollStiffnessRear,
    });
  }, [
    archetype,
    lateralG,
    heaveMm,
    staticCamberFront,
    staticCamberRear,
    rollStiffnessFront,
    rollStiffnessRear,
  ]);

  const axleData = activeAxle === "front" ? kinematics.front : kinematics.rear;

  // SVG Coordinate Transformation:
  // Mathematical coordinates: y = 0 to 1200 mm lateral, z = 0 to 600 mm vertical.
  // SVG ViewBox: width = 850, height = 420.
  // Origin (y=0, z=0) mapped to SVG (x=100, y=360).
  const scale = 0.52;
  const originX = 120;
  const originY = 360;

  const toSvgX = (y: number) => originX + y * scale;
  const toSvgY = (z: number) => originY - z * scale;

  const hp = axleData.hardpoints;
  const ic = axleData.instantCenter;
  const rc = axleData.dynamicRollCenter;

  const uInX = toSvgX(hp.upperInboard.y);
  const uInY = toSvgY(hp.upperInboard.z);
  const uOutX = toSvgX(hp.upperOutboard.y);
  const uOutY = toSvgY(hp.upperOutboard.z);

  const lInX = toSvgX(hp.lowerInboard.y);
  const lInY = toSvgY(hp.lowerInboard.z);
  const lOutX = toSvgX(hp.lowerOutboard.y);
  const lOutY = toSvgY(hp.lowerOutboard.z);

  const cpX = toSvgX(hp.contactPatch.y);
  const cpY = toSvgY(hp.contactPatch.z);
  const wcX = toSvgX(hp.wheelCenter.y);
  const wcY = toSvgY(hp.wheelCenter.z);

  // Clamp instant center for SVG rendering
  const clampedIcy = Math.max(-1500, Math.min(2500, ic.y));
  const icX = toSvgX(clampedIcy);
  const icY = toSvgY(ic.z);

  const rcX = toSvgX(0);
  const rcY = toSvgY(axleData.staticRollCenterHeightMm);

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Chassis Archetype:
          </span>
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5">
            {[
              { id: "gt3", label: "GT3 / GTE" },
              { id: "formula_modern", label: "Formula Modern" },
              { id: "prototype", label: "Hypercar / LMP" },
              { id: "cup_gt4", label: "Cup GT4" },
            ].map((arch) => (
              <button
                key={arch.id}
                type="button"
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  archetype === arch.id
                    ? "bg-red-600 text-white shadow-lg shadow-red-900/40"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setArchetype(arch.id as any)}
              >
                {arch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Axle:</span>
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-lg border border-white/5">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeAxle === "front"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setActiveAxle("front")}
            >
              Front Axle
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                activeAxle === "rear"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setActiveAxle("rear")}
            >
              Rear Axle
            </button>
          </div>
        </div>
      </div>

      {/* Main 2D Suspension Kinematics Diagram */}
      <div className="p-6 rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Interactive 2D Roll Center & Kinematic Geometry Visualizer ({activeAxle.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant Center (IC) and Kinematic Roll Center (RC) intersection solved from double-wishbone CAD vectors
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-mono rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Roll Center: {axleData.staticRollCenterHeightMm} mm
            </span>
            <span className="px-2.5 py-1 text-xs font-mono rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Camber Gain: {axleData.camberGainDegPerMm}°/mm
            </span>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="relative w-full aspect-[21/9] bg-slate-950 rounded-lg border border-white/5 overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 820 380" className="w-full h-full select-none">
            {/* Grid Lines */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Ground Plane (z = 0) */}
            <line x1="20" y1={originY} x2="800" y2={originY} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" strokeDasharray="4 2" />
            <text x="30" y={originY + 16} fill="rgba(255, 255, 255, 0.4)" fontSize="10" fontFamily="monospace">
              GROUND PLANE (Z = 0)
            </text>

            {/* Vehicle Centerline (y = 0) */}
            <line x1={originX} y1="20" x2={originX} y2="370" stroke="rgba(239, 68, 68, 0.5)" strokeWidth="1.5" strokeDasharray="6 4" />
            <text x={originX + 6} y="35" fill="rgba(239, 68, 68, 0.8)" fontSize="10" fontFamily="monospace">
              CENTERLINE (Y = 0)
            </text>

            {/* Chassis Sprung Body Silhouette */}
            <path
              d={`M ${originX} ${toSvgY(axleData.staticRollCenterHeightMm + 240)} 
                 L ${toSvgX(440)} ${toSvgY(axleData.staticRollCenterHeightMm + 240)}
                 L ${toSvgX(450)} ${toSvgY(axleData.staticRollCenterHeightMm + 120)}
                 L ${originX} ${toSvgY(axleData.staticRollCenterHeightMm + 120)} Z`}
              fill="rgba(30, 41, 59, 0.7)"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1.5"
            />
            <text x={originX + 15} y={toSvgY(axleData.staticRollCenterHeightMm + 180)} fill="rgba(148, 163, 184, 0.6)" fontSize="10" fontFamily="sans-serif">
              CHASSIS MONOCOQUE
            </text>

            {/* Control Arm Lines (Upper & Lower) */}
            {/* Upper Wishbone */}
            <line x1={uInX} y1={uInY} x2={uOutX} y2={uOutY} stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            {/* Lower Wishbone */}
            <line x1={lInX} y1={lInY} x2={lOutX} y2={lOutY} stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />

            {/* Projection Extension Lines to Instant Center */}
            <line x1={uOutX} y1={uOutY} x2={icX} y2={icY} stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1={lOutX} y1={lOutY} x2={icX} y2={icY} stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Line from Contact Patch to Instant Center (Roll Center Line) */}
            <line x1={cpX} y1={cpY} x2={icX} y2={icY} stroke="rgba(168, 85, 247, 0.7)" strokeWidth="2" strokeDasharray="5 3" />

            {/* Suspension Upright / Knuckle */}
            <line x1={uOutX} y1={uOutY} x2={lOutX} y2={lOutY} stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />

            {/* Tire Cross-Section with Dynamic Camber Angle */}
            <g transform={`rotate(${axleData.dynamicCamberOutsideDeg}, ${wcX}, ${wcY})`}>
              <rect
                x={wcX - 35}
                y={wcY - (axleData.axle === "front" ? 170 : 170) * scale}
                width="70"
                height={340 * scale}
                rx="6"
                fill="rgba(15, 23, 42, 0.95)"
                stroke="#22c55e"
                strokeWidth="2.5"
              />
              {/* Wheel Rim Center */}
              <circle cx={wcX} cy={wcY} r="8" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
            </g>

            {/* Inboard Pivot Joints */}
            <circle cx={uInX} cy={uInY} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx={lInX} cy={lInY} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />

            {/* Outboard Ball Joints */}
            <circle cx={uOutX} cy={uOutY} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx={lOutX} cy={lOutY} r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />

            {/* Instant Center (IC) Marker */}
            <circle cx={icX} cy={icY} r="6" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
            <text x={icX + 10} y={icY + 4} fill="#ec4899" fontSize="11" fontWeight="bold" fontFamily="monospace">
              IC ({ic.y}, {ic.z}mm)
            </text>

            {/* Kinematic Roll Center (RC) Marker on Centerline */}
            <circle cx={rcX} cy={rcY} r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
            <text x={rcX + 12} y={rcY - 4} fill="#ef4444" fontSize="12" fontWeight="bold" fontFamily="monospace">
              RC ({axleData.staticRollCenterHeightMm} mm)
            </text>

            {/* Contact Patch Center */}
            <circle cx={cpX} cy={cpY} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
            <text x={cpX - 25} y={cpY + 16} fill="#22c55e" fontSize="10" fontFamily="monospace">
              CP ({Math.round(hp.contactPatch.y)}mm)
            </text>
          </svg>
        </div>

        {/* Interactive Dynamics Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-black/30 rounded-lg border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Lateral Cornering Load:</span>
              <span className="font-mono text-amber-400 font-semibold">{lateralG.toFixed(2)} G</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="2.5"
              step="0.05"
              value={lateralG}
              onChange={(e) => setLateralG(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.0G (Straight)</span>
              <span>1.8G (GT3 Peak)</span>
              <span>2.5G</span>
            </div>
          </div>

          <div className="p-3 bg-black/30 rounded-lg border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Heave / Downforce Squat:</span>
              <span className="font-mono text-cyan-400 font-semibold">{heaveMm > 0 ? `+${heaveMm}` : heaveMm} mm</span>
            </div>
            <input
              type="range"
              min="-30"
              max="30"
              step="1"
              value={heaveMm}
              onChange={(e) => setHeaveMm(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-30mm (Rebound)</span>
              <span>0mm (Static)</span>
              <span>+30mm (Squat)</span>
            </div>
          </div>

          <div className="p-3 bg-black/30 rounded-lg border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{activeAxle === "front" ? "Front" : "Rear"} Static Camber:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {activeAxle === "front" ? staticCamberFront.toFixed(1) : staticCamberRear.toFixed(1)}°
              </span>
            </div>
            <input
              type="range"
              min="-4.5"
              max="-1.5"
              step="0.1"
              value={activeAxle === "front" ? staticCamberFront : staticCamberRear}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (activeAxle === "front") setStaticCamberFront(val);
                else setStaticCamberRear(val);
              }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-4.5° (Aggressive)</span>
              <span>-3.0°</span>
              <span>-1.5° (Mild)</span>
            </div>
          </div>

          <div className="p-3 bg-black/30 rounded-lg border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{activeAxle === "front" ? "Front" : "Rear"} Roll Stiffness:</span>
              <span className="font-mono text-purple-400 font-semibold">
                {activeAxle === "front" ? rollStiffnessFront : rollStiffnessRear} Nm/°
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="3500"
              step="50"
              value={activeAxle === "front" ? rollStiffnessFront : rollStiffnessRear}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (activeAxle === "front") setRollStiffnessFront(val);
                else setRollStiffnessRear(val);
              }}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1000 (Soft ARB)</span>
              <span>2000</span>
              <span>3500 (Stiff)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kinematics Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Static Roll Center Height
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {axleData.staticRollCenterHeightMm}{" "}
            <span className="text-xs text-slate-400 font-normal">mm</span>
          </div>
          <div className="text-xs text-slate-400">
            Jacking Force Ratio: <span className="font-mono text-amber-400">{axleData.jackingForceRatio}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Camber Gain Rate
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {axleData.camberGainDegPerMm}{" "}
            <span className="text-xs text-slate-400 font-normal">°/mm</span>
          </div>
          <div className="text-xs text-slate-400">
            Swing Arm: <span className="font-mono text-slate-200">{axleData.virtualSwingArmLengthMm} mm</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Dynamic Road Camber
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {axleData.dynamicCamberOutsideDeg}°
          </div>
          <div className="text-xs text-slate-400">
            Grip Efficiency:{" "}
            <span
              className={`font-mono font-semibold ${
                axleData.contactPatchGripEfficiencyPct >= 92 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {axleData.contactPatchGripEfficiencyPct}%
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md space-y-1">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Chassis Body Roll Angle
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400">
            {kinematics.rollAngleDeg}°
          </div>
          <div className="text-xs text-slate-400">
            Front Roll Dist:{" "}
            <span className="font-mono text-slate-200">{kinematics.frontRollStiffnessDistributionPct}%</span>
          </div>
        </div>
      </div>

      {/* Race Engineer Kinematics Diagnosis Card */}
      <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-950/20 backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
            <h4 className="text-xs font-mono uppercase tracking-wider text-blue-400 font-semibold">
              Chief Race Engineer Kinematics Synthesis
            </h4>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Roll Axis Inclination: +{kinematics.rollAxisInclinationAngleDeg}°
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-slate-300">
          <p className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>{kinematics.camberRecoveryVerdict}</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-blue-400 font-bold">ℹ</span>
            <span>{kinematics.rollCenterStabilityVerdict}</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">⚡</span>
            <span>{kinematics.raceEngineerRecommendation}</span>
          </p>
        </div>

        {onApplyCamberToSetup && (
          <div className="pt-2 border-t border-white/5 flex justify-end">
            <button
              type="button"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
              onClick={() => onApplyCamberToSetup(axleData.dynamicCamberOutsideDeg, activeAxle)}
            >
              Apply Kinematic Camber to Active Setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
