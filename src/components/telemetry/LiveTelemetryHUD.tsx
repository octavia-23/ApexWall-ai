"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getAuthenticTrackGeometry } from "@/lib/circuit-geometries";

export interface LiveTelemetryFrame {
  speed: number;        // km/h
  rpm: number;          // 0 - 9000
  maxRpm: number;       // 8500
  gear: number | string;// -1: R, 0: N, 1-8
  throttle: number;     // 0 - 100%
  brake: number;        // 0 - 100%
  steer: number;        // -180 to +180 deg
  latG: number;         // Lateral G (-3.5 to +3.5)
  longG: number;        // Longitudinal G (-4.5 to +1.8)
  lapDistance: number;  // meters
  totalDistance: number;// meters
  lapTime: number;      // seconds
  delta: number;        // delta vs reference lap (-0.5 to +0.5)
  tyreTemps: { FL: number; FR: number; RL: number; RR: number }; // deg C
  tyrePressures: { FL: number; FR: number; RL: number; RR: number }; // psi
}

export const LiveTelemetryHUD: React.FC = () => {
  const [activeSim, setActiveSim] = useState<"demo" | "bridge">("demo");
  const [selectedCircuit, setSelectedCircuit] = useState<"spa" | "monza" | "silverstone">("spa");
  const [speedUnit, setSpeedUnit] = useState<"kmh" | "mph">("kmh");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [bridgeStatus, setBridgeStatus] = useState<string>("Standby");

  // Live Telemetry State
  const [frame, setFrame] = useState<LiveTelemetryFrame>({
    speed: 0,
    rpm: 850,
    maxRpm: 8500,
    gear: "N",
    throttle: 0,
    brake: 0,
    steer: 0,
    latG: 0,
    longG: 0,
    lapDistance: 0,
    totalDistance: 7004,
    lapTime: 0,
    delta: -0.18,
    tyreTemps: { FL: 88, FR: 86, RL: 84, RR: 83 },
    tyrePressures: { FL: 26.9, FR: 27.1, RL: 26.8, RR: 27.0 },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number | null>(null);
  const simProgressRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frictionCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Circuit geometry
  const circuitGeo = useMemo(() => {
    return getAuthenticTrackGeometry(
      selectedCircuit === "spa"
        ? "Spa-Francorchamps GP"
        : selectedCircuit === "monza"
        ? "Monza GP"
        : "Silverstone GP"
    );
  }, [selectedCircuit]);

  // Demo Simulation Engine (High precision 60Hz loop)
  useEffect(() => {
    if (activeSim !== "demo") return;
    setIsConnected(true);
    setBridgeStatus("Simulated 60Hz Rig Stream");

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      simProgressRef.current = (simProgressRef.current + dt * 0.035) % 1;
      const progress = simProgressRef.current;

      // Realistic dynamics modulation based on progress through corners
      const cornerPhase = Math.sin(progress * Math.PI * 12);
      const isCorner = Math.abs(cornerPhase) > 0.45;
      const isBraking = Math.sin(progress * Math.PI * 6) < -0.3;

      const targetSpeed = isBraking
        ? 85 + Math.abs(cornerPhase) * 40
        : isCorner
        ? 140 + Math.cos(progress * 10) * 30
        : 265 + Math.sin(progress * 4) * 45;

      const gearNum = targetSpeed > 240 ? 6 : targetSpeed > 190 ? 5 : targetSpeed > 140 ? 4 : targetSpeed > 100 ? 3 : 2;
      const rpmVal = Math.min(8450, 4800 + (targetSpeed % 40) * 90);
      const thrVal = isBraking ? 0 : Math.min(100, Math.max(15, (targetSpeed / 310) * 100));
      const brkVal = isBraking ? Math.min(100, Math.max(30, 85 + Math.sin(currentTime * 0.01) * 15)) : 0;
      const steerVal = isCorner ? Math.sin(progress * 30) * 55 : (Math.sin(currentTime * 0.003) * 3);
      const latGVal = isCorner ? (steerVal / 55) * 2.8 : Math.sin(currentTime * 0.005) * 0.3;
      const longGVal = isBraking ? -3.4 : (thrVal / 100) * 1.2;

      setFrame({
        speed: Math.round(targetSpeed),
        rpm: Math.round(rpmVal),
        maxRpm: 8500,
        gear: gearNum,
        throttle: Math.round(thrVal),
        brake: Math.round(brkVal),
        steer: Math.round(steerVal * 10) / 10,
        latG: Math.round(latGVal * 100) / 100,
        longG: Math.round(longGVal * 100) / 100,
        lapDistance: Math.round(progress * 7004),
        totalDistance: 7004,
        lapTime: Math.round(progress * 137.4 * 10) / 10,
        delta: Math.round(Math.sin(progress * Math.PI * 4) * 0.35 * 100) / 100,
        tyreTemps: {
          FL: Math.round(88 + Math.abs(latGVal) * 4),
          FR: Math.round(86 + Math.abs(latGVal) * 3),
          RL: Math.round(84 + (thrVal > 80 ? 3 : 0)),
          RR: Math.round(83 + (thrVal > 80 ? 3 : 0)),
        },
        tyrePressures: {
          FL: 26.9,
          FR: 27.1,
          RL: 26.8,
          RR: 27.0,
        },
      });

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [activeSim, selectedCircuit]);

  // WebSocket Live Rig Connection
  useEffect(() => {
    if (activeSim !== "bridge") return;

    setBridgeStatus("Connecting to ws://localhost:9001...");
    const ws = new WebSocket("ws://localhost:9001");
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setBridgeStatus("Connected to Local Rig Bridge");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "telemetry_frame") {
          setFrame(data.payload);
        }
      } catch (err) {
        // Frame parse error
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
      setBridgeStatus("Bridge Offline (Run npm run telemetry-bridge:acevo)");
    };

    ws.onclose = () => {
      setIsConnected(false);
      setBridgeStatus("Disconnected from Bridge");
    };

    return () => {
      ws.close();
    };
  }, [activeSim]);

  // Render 2D Circuit with Live Dot
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !circuitGeo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = circuitGeo.points;
    if (!pts || pts.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 24;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;
    const scale = Math.min(drawW / rangeX, drawH / rangeY);
    const offsetX = (w - rangeX * scale) / 2;
    const offsetY = (h - rangeY * scale) / 2;

    const toScreen = (pt: { x: number; y: number }) => ({
      x: offsetX + (pt.x - minX) * scale,
      y: offsetY + (pt.y - minY) * scale,
    });

    // Draw track path
    ctx.beginPath();
    ctx.strokeStyle = "rgba(71, 85, 105, 0.45)";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    pts.forEach((pt, i) => {
      const sp = toScreen(pt);
      if (i === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw Live Car Position Dot
    const progress = frame.totalDistance > 0 ? (frame.lapDistance / frame.totalDistance) % 1 : 0;
    const idx = Math.floor(progress * (pts.length - 1));
    const carPos = toScreen(pts[idx] || pts[0]);

    // Outer glow
    ctx.beginPath();
    ctx.arc(carPos.x, carPos.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    ctx.fill();

    // Inner bright dot
    ctx.beginPath();
    ctx.arc(carPos.x, carPos.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#38BDF8";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [circuitGeo, frame.lapDistance, frame.totalDistance]);

  // Render Live G-G Friction Circle
  useEffect(() => {
    const canvas = frictionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 16;
    const maxG = 3.5;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mid circle (2.0 G)
    ctx.beginPath();
    ctx.arc(cx, cy, (2.0 / maxG) * radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshairs
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.stroke();

    // Current G dot
    const px = cx + (frame.latG / maxG) * radius;
    const py = cy - (frame.longG / maxG) * radius;

    // Vector line from origin
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Target dot
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#F43F5E";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [frame.latG, frame.longG]);

  // Shift Lights calculation (15 LEDs total)
  const rpmPct = frame.rpm / frame.maxRpm;
  const numActiveLeds = Math.min(15, Math.floor(rpmPct * 16));
  const isShiftPoint = rpmPct >= 0.94;

  const displaySpeed = speedUnit === "kmh" ? frame.speed : Math.round(frame.speed * 0.621371);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-4 space-y-6">
      {/* Cockpit Stream Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
              {bridgeStatus}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden md:block"></div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveSim("demo")}
              className={`px-2 py-0.5 rounded transition-colors ${activeSim === "demo" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
            >
              Demo Stream (60Hz)
            </button>
            <button
              type="button"
              onClick={() => setActiveSim("bridge")}
              className={`px-2 py-0.5 rounded transition-colors ${activeSim === "bridge" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400 hover:text-slate-200"}`}
            >
              Live Telemetry (UDP Bridge)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-500">CIRCUIT:</span>
            <select
              value={selectedCircuit}
              onChange={(e) => setSelectedCircuit(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none"
            >
              <option value="spa">Spa-Francorchamps</option>
              <option value="monza">Monza GP</option>
              <option value="silverstone">Silverstone GP</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 px-1 py-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setSpeedUnit("kmh")}
              className={`px-1.5 py-0.5 rounded ${speedUnit === "kmh" ? "bg-slate-800 text-white font-bold" : "text-slate-500"}`}
            >
              KM/H
            </button>
            <button
              type="button"
              onClick={() => setSpeedUnit("mph")}
              className={`px-1.5 py-0.5 rounded ${speedUnit === "mph" ? "bg-slate-800 text-white font-bold" : "text-slate-500"}`}
            >
              MPH
            </button>
          </div>
        </div>
      </div>

      {/* Primary Cockpit Dash Cluster */}
      <div className="p-5 md:p-6 rounded-lg bg-[#090C12] border border-slate-800 relative overflow-hidden">
        {/* Top Shift Lights (15 Sequential LEDs) */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {Array.from({ length: 15 }).map((_, i) => {
            const isActive = i < numActiveLeds;
            const isGreen = i < 5;
            const isRed = i >= 5 && i < 10;
            const isBlue = i >= 10;

            let colorClass = "bg-slate-800/80 border-slate-700/40";
            if (isActive) {
              if (isShiftPoint) colorClass = "bg-blue-400 border-white";
              else if (isBlue) colorClass = "bg-blue-500 border-blue-400";
              else if (isRed) colorClass = "bg-rose-500 border-rose-400";
              else if (isGreen) colorClass = "bg-emerald-500 border-emerald-400";
            }

            return (
              <div
                key={i}
                className={`w-3.5 md:w-5 h-2.5 rounded-sm border transition-colors duration-75 ${colorClass}`}
              ></div>
            );
          })}
        </div>

        {/* Center Main Cockpit Gauge Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
          {/* Left: Pedals & Steering Input */}
          <div className="flex items-center justify-around bg-slate-950/80 p-4 rounded-lg border border-slate-800">
            {/* Throttle Bar */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-emerald-400 mb-1 font-bold">THR</span>
              <div className="w-5 h-36 bg-slate-900 rounded-sm overflow-hidden relative border border-slate-800 flex flex-col justify-end">
                <div
                  className="w-full bg-emerald-500 transition-all duration-75 rounded-b-sm"
                  style={{ height: `${frame.throttle}%` }}
                ></div>
              </div>
              <span className="font-mono text-xs text-slate-200 mt-1 font-semibold">{frame.throttle}%</span>
            </div>

            {/* Brake Bar */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-rose-400 mb-1 font-bold">BRK</span>
              <div className="w-5 h-36 bg-slate-900 rounded-sm overflow-hidden relative border border-slate-800 flex flex-col justify-end">
                <div
                  className="w-full bg-rose-500 transition-all duration-75 rounded-b-sm"
                  style={{ height: `${frame.brake}%` }}
                ></div>
              </div>
              <span className="font-mono text-xs text-slate-200 mt-1 font-semibold">{frame.brake}%</span>
            </div>

            {/* Steering Wheel Graphic */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-mono text-cyan-400 mb-1 font-bold">STEER</span>
              <div className="w-20 h-40 flex flex-col items-center justify-center">
                <div
                  className="w-16 h-16 rounded-full border-4 border-slate-700 border-t-cyan-400 transition-transform duration-75 flex items-center justify-center relative"
                  style={{ transform: `rotate(${frame.steer}deg)` }}
                >
                  <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                </div>
                <span className="font-mono text-xs text-slate-200 mt-3 font-semibold">
                  {frame.steer > 0 ? `+${frame.steer}°` : `${frame.steer}°`}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Digital Speed & Gear Display */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center py-4 bg-slate-950/90 rounded-lg border border-slate-800">
            {/* Gear Indicator */}
            <div className="text-7xl md:text-9xl font-black font-mono tracking-tight text-white mb-1 select-none">
              {frame.gear}
            </div>

            {/* Speedometer */}
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl md:text-5xl font-bold font-mono tracking-tight text-cyan-400">
                {displaySpeed}
              </span>
              <span className="font-mono text-xs font-bold uppercase text-slate-500 tracking-wider">
                {speedUnit}
              </span>
            </div>

            {/* RPM Counter bar */}
            <div className="w-4/5 max-w-sm">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>{frame.rpm.toLocaleString()} RPM</span>
                <span className="text-slate-500">LIMIT {frame.maxRpm.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-sm overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-75 ${
                    isShiftPoint ? "bg-blue-400" : rpmPct > 0.8 ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${rpmPct * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Delta Split */}
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">LAP DELTA:</span>
              <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                frame.delta < 0 ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
              }`}>
                {frame.delta < 0 ? `${frame.delta}s` : `+${frame.delta}s`}
              </span>
            </div>
          </div>

          {/* Right: Live Friction Circle & G-Force Meter */}
          <div className="flex flex-col items-center justify-center bg-slate-950/80 p-4 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 mb-2 font-bold uppercase tracking-wider">
              G-G Kamm Friction Vector
            </span>
            <canvas
              ref={frictionCanvasRef}
              width={160}
              height={160}
              className="w-40 h-40"
            />
            <div className="flex items-center justify-between w-full mt-2 text-xs font-mono text-slate-300 px-2">
              <div><span className="text-slate-500">LAT:</span> {frame.latG > 0 ? `+${frame.latG}G` : `${frame.latG}G`}</div>
              <div><span className="text-slate-500">LONG:</span> {frame.longG > 0 ? `+${frame.longG}G` : `${frame.longG}G`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: 2D Live Track Map & 4-Corner Live Tyre Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2D Track Live Position Canvas */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Live 2D Track Position // {circuitGeo?.name || "Circuit"}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {frame.lapDistance}m / {frame.totalDistance}m
            </span>
          </div>
          <div className="w-full flex-1 flex items-center justify-center min-h-[260px]">
            <canvas
              ref={canvasRef}
              width={540}
              height={260}
              className="w-full max-w-lg h-auto"
            />
          </div>
        </div>

        {/* 4-Corner Live Tyre Status */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Live Tyre Pressures & Temps
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              OPTIMAL
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 py-2">
            {/* FL */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">FRONT LEFT</div>
              <div className="text-lg font-bold font-mono text-slate-100">{frame.tyrePressures.FL} psi</div>
              <div className="text-xs font-mono text-cyan-400">{frame.tyreTemps.FL}°C</div>
            </div>

            {/* FR */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">FRONT RIGHT</div>
              <div className="text-lg font-bold font-mono text-slate-100">{frame.tyrePressures.FR} psi</div>
              <div className="text-xs font-mono text-cyan-400">{frame.tyreTemps.FR}°C</div>
            </div>

            {/* RL */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">REAR LEFT</div>
              <div className="text-lg font-bold font-mono text-slate-100">{frame.tyrePressures.RL} psi</div>
              <div className="text-xs font-mono text-cyan-400">{frame.tyreTemps.RL}°C</div>
            </div>

            {/* RR */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500">REAR RIGHT</div>
              <div className="text-lg font-bold font-mono text-slate-100">{frame.tyrePressures.RR} psi</div>
              <div className="text-xs font-mono text-cyan-400">{frame.tyreTemps.RR}°C</div>
            </div>
          </div>

          <div className="mt-2 text-[10px] font-mono text-slate-500 text-center">
            Pressure Model Active
          </div>
        </div>
      </div>
    </div>
  );
};
