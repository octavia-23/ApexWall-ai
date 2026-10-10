"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, Radio, Activity, Volume2, VolumeX } from "lucide-react";

interface DDUFrame {
  speed: number;
  rpm: number;
  maxRpm: number;
  gear: number | string;
  throttle: number;
  brake: number;
  steer: number;
  latG: number;
  longG: number;
  lapDistance: number;
  totalDistance: number;
  lapTime: number;
  delta: number;
  tyreTemps: { FL: number; FR: number; RL: number; RR: number };
  tyrePressures: { FL: number; FR: number; RL: number; RR: number };
}

export default function CockpitDDUPage() {
  const [activeMode, setActiveMode] = useState<"live" | "demo">("live");
  const [isConnected, setIsConnected] = useState(false);
  const [activeGame, setActiveGame] = useState("Standby");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [speedUnit, setSpeedUnit] = useState<"kmh" | "mph">("kmh");

  const [frame, setFrame] = useState<DDUFrame>({
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
    totalDistance: 5793,
    lapTime: 0,
    delta: 0,
    tyreTemps: { FL: 88, FR: 86, RL: 84, RR: 83 },
    tyrePressures: { FL: 26.9, FR: 27.1, RL: 26.8, RR: 27.0 },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const animRef = useRef<number | null>(null);
  const demoProgressRef = useRef<number>(0);

  // Toggle Fullscreen API
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // WebSocket Live Connection
  useEffect(() => {
    if (activeMode !== "live") return;

    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket("ws://localhost:9001");
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "telemetry_frame" && data.payload) {
            setFrame(data.payload);
            if (data.payload.game) setActiveGame(data.payload.game);
          }
        } catch (_e) {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        setActiveGame("Standby");
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [activeMode]);

  // Demo Simulation Engine
  useEffect(() => {
    if (activeMode !== "demo") return;
    setIsConnected(true);
    setActiveGame("Synthetic 60Hz DDU Stream");

    let lastTime = performance.now();
    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      demoProgressRef.current = (demoProgressRef.current + dt * 0.04) % 1;
      const progress = demoProgressRef.current;

      const cornerPhase = Math.sin(progress * Math.PI * 12);
      const isCorner = Math.abs(cornerPhase) > 0.45;
      const isBraking = Math.sin(progress * Math.PI * 6) < -0.3;

      const targetSpeed = isBraking
        ? 82 + Math.abs(cornerPhase) * 35
        : isCorner
        ? 145 + Math.cos(progress * 10) * 25
        : 260 + Math.sin(progress * 4) * 45;

      const gearNum = targetSpeed > 235 ? 6 : targetSpeed > 185 ? 5 : targetSpeed > 135 ? 4 : targetSpeed > 95 ? 3 : 2;
      const rpmVal = Math.min(8450, 4800 + (targetSpeed % 38) * 95);
      const thrVal = isBraking ? 0 : Math.min(100, Math.max(10, (targetSpeed / 300) * 100));
      const brkVal = isBraking ? 85 + Math.sin(currentTime * 0.01) * 12 : 0;
      const steerVal = isCorner ? Math.sin(progress * 28) * 48 : 0;
      const latGVal = isCorner ? (steerVal / 48) * 2.6 : 0;
      const longGVal = isBraking ? -3.2 : (thrVal / 100) * 1.1;

      setFrame({
        speed: Math.round(targetSpeed),
        rpm: Math.round(rpmVal),
        maxRpm: 8500,
        gear: gearNum,
        throttle: Math.round(thrVal),
        brake: Math.round(brkVal),
        steer: Math.round(steerVal),
        latG: Math.round(latGVal * 100) / 100,
        longG: Math.round(longGVal * 100) / 100,
        lapDistance: Math.round(progress * 5793),
        totalDistance: 5793,
        lapTime: Math.round(progress * 108.4 * 10) / 10,
        delta: Math.round(Math.sin(progress * Math.PI * 4) * 0.28 * 100) / 100,
        tyreTemps: {
          FL: Math.round(89 + Math.abs(latGVal) * 3),
          FR: Math.round(87 + Math.abs(latGVal) * 2),
          RL: Math.round(85 + (thrVal > 80 ? 2 : 0)),
          RR: Math.round(84 + (thrVal > 80 ? 2 : 0)),
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
  }, [activeMode]);

  // Shift Lights (16 LEDs array: 4 Green, 4 Yellow, 4 Red, 4 Blue/Purple Flashing)
  const rpmPercent = Math.min(100, Math.max(0, (frame.rpm / (frame.maxRpm || 8500)) * 100));
  const ledCount = 16;
  const activeLeds = Math.round((rpmPercent / 100) * ledCount);
  const isShiftFlashing = rpmPercent > 95;

  const displaySpeed = speedUnit === "kmh" ? frame.speed : Math.round(frame.speed * 0.621371);

  // Format seconds to MM:SS.ms
  const formatTime = (sec: number) => {
    if (!sec || sec <= 0) return "00:00.0";
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
  };

  // Thermal color resolver
  const getTempColor = (t: number) => {
    if (t < 75) return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if (t > 102) return "text-red-400 bg-red-500/20 border-red-500/50 animate-pulse";
    if (t > 96) return "text-amber-400 bg-amber-500/15 border-amber-500/40";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  };

  return (
    <div className="min-h-screen bg-black text-white select-none flex flex-col justify-between overflow-hidden font-sans p-2 sm:p-4">
      {/* Top Header Bar */}
      <header className="h-10 flex items-center justify-between border-b border-white/10 px-2 sm:px-4 bg-[#05070a]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit DDU</span>
          </Link>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-xs font-mono text-slate-300 uppercase tracking-wider font-semibold">
              {activeGame}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Unit Toggle */}
          <button
            type="button"
            onClick={() => setSpeedUnit((u) => (u === "kmh" ? "mph" : "kmh"))}
            className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-slate-300 hover:text-white"
          >
            {speedUnit.toUpperCase()}
          </button>

          {/* Mode Toggle */}
          <button
            type="button"
            onClick={() => setActiveMode((m) => (m === "live" ? "demo" : "live"))}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
              activeMode === "live"
                ? "bg-blue-600/30 border-blue-500 text-blue-300"
                : "bg-white/5 border-white/10 text-slate-400"
            }`}
          >
            {activeMode === "live" ? "LIVE RIG" : "DEMO"}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main DDU Screen */}
      <div className="flex-1 flex flex-col justify-between py-2 sm:py-4 max-w-7xl w-full mx-auto">
        {/* 1. Shift Lights Array */}
        <div className="w-full flex items-center justify-between gap-1 sm:gap-2 px-2 py-1 mb-2 bg-[#0D0F12] rounded-lg border border-white/10">
          {Array.from({ length: ledCount }).map((_, i) => {
            const isLit = i < activeLeds;
            let ledColor = "bg-emerald-500 shadow-[0_0_8px_#10b981]";
            if (i >= 4 && i < 8) ledColor = "bg-amber-400 shadow-[0_0_8px_#fbbf24]";
            else if (i >= 8 && i < 12) ledColor = "bg-red-500 shadow-[0_0_8px_#ef4444]";
            else if (i >= 12) ledColor = "bg-purple-400 shadow-[0_0_12px_#c084fc]";

            return (
              <div
                key={i}
                className={`flex-1 h-3 sm:h-5 rounded-sm transition-all ${
                  isLit
                    ? isShiftFlashing && i >= 12
                      ? "bg-white shadow-[0_0_16px_#ffffff] animate-ping"
                      : ledColor
                    : "bg-white/[0.04]"
                }`}
              />
            );
          })}
        </div>

        {/* 2. Primary Instrument Cluster */}
        <div className="grid grid-cols-12 gap-2 sm:gap-4 flex-1 items-stretch">
          {/* LEFT: Gear & Speed */}
          <div className="col-span-4 bg-[#0D0F12] border border-white/10 rounded-xl p-3 sm:p-6 flex flex-col justify-between items-center relative overflow-hidden">
            <span className="text-[10px] sm:text-xs font-mono uppercase text-slate-500 font-bold tracking-widest self-start">
              Transmission
            </span>

            {/* Massive Gear Digit */}
            <div className="my-auto text-center">
              <span className="text-7xl sm:text-9xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                {frame.gear}
              </span>
            </div>

            {/* Speed readout */}
            <div className="w-full flex items-baseline justify-between border-t border-white/10 pt-2 sm:pt-3">
              <span className="text-3xl sm:text-5xl font-extrabold font-mono text-white">
                {displaySpeed}
              </span>
              <span className="text-xs sm:text-sm font-mono text-slate-400 uppercase font-semibold">
                {speedUnit}
              </span>
            </div>
          </div>

          {/* CENTER: Delta, Lap Times & Pedal Inputs */}
          <div className="col-span-4 bg-[#0D0F12] border border-white/10 rounded-xl p-3 sm:p-6 flex flex-col justify-between">
            {/* Live Delta vs Benchmark */}
            <div
              className={`w-full py-2 sm:py-3 rounded-lg border text-center font-mono font-black text-2xl sm:text-4xl transition-colors ${
                frame.delta <= 0
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  : "bg-red-500/20 border-red-500/50 text-red-400"
              }`}
            >
              <span>{frame.delta <= 0 ? "" : "+"}</span>
              <span>{frame.delta.toFixed(2)}</span>
            </div>

            {/* Lap Timer & Lap Counter */}
            <div className="text-center my-3 sm:my-4 space-y-1">
              <span className="text-[10px] sm:text-xs font-mono uppercase text-slate-500 font-bold tracking-widest block">
                Lap Time
              </span>
              <span className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white">
                {formatTime(frame.lapTime)}
              </span>
            </div>

            {/* Pedal Input Bars */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              {/* Throttle */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>THROTTLE</span>
                  <span>{frame.throttle}%</span>
                </div>
                <div className="w-full h-2.5 sm:h-3.5 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${frame.throttle}%` }}
                  />
                </div>
              </div>

              {/* Brake */}
              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                  <span>BRAKE</span>
                  <span>{frame.brake}%</span>
                </div>
                <div className="w-full h-2.5 sm:h-3.5 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-75"
                    style={{ width: `${frame.brake}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: 4-Corner Tyres & G-Forces */}
          <div className="col-span-4 bg-[#0D0F12] border border-white/10 rounded-xl p-3 sm:p-6 flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs font-mono uppercase text-slate-500 font-bold tracking-widest">
              Tyre Thermals & Pressure
            </span>

            {/* 4 Corners Grid */}
            <div className="grid grid-cols-2 gap-2 my-auto">
              {/* Front Left */}
              <div className={`p-2 rounded border font-mono ${getTempColor(frame.tyreTemps.FL)}`}>
                <div className="text-[9px] text-slate-400">FL</div>
                <div className="text-lg sm:text-2xl font-bold">{frame.tyreTemps.FL}°C</div>
                <div className="text-[10px] text-slate-400">{frame.tyrePressures.FL} psi</div>
              </div>

              {/* Front Right */}
              <div className={`p-2 rounded border font-mono ${getTempColor(frame.tyreTemps.FR)}`}>
                <div className="text-[9px] text-slate-400">FR</div>
                <div className="text-lg sm:text-2xl font-bold">{frame.tyreTemps.FR}°C</div>
                <div className="text-[10px] text-slate-400">{frame.tyrePressures.FR} psi</div>
              </div>

              {/* Rear Left */}
              <div className={`p-2 rounded border font-mono ${getTempColor(frame.tyreTemps.RL)}`}>
                <div className="text-[9px] text-slate-400">RL</div>
                <div className="text-lg sm:text-2xl font-bold">{frame.tyreTemps.RL}°C</div>
                <div className="text-[10px] text-slate-400">{frame.tyrePressures.RL} psi</div>
              </div>

              {/* Rear Right */}
              <div className={`p-2 rounded border font-mono ${getTempColor(frame.tyreTemps.RR)}`}>
                <div className="text-[9px] text-slate-400">RR</div>
                <div className="text-lg sm:text-2xl font-bold">{frame.tyreTemps.RR}°C</div>
                <div className="text-[10px] text-slate-400">{frame.tyrePressures.RR} psi</div>
              </div>
            </div>

            {/* G-Force Telemetry */}
            <div className="border-t border-white/10 pt-2 sm:pt-3 flex justify-between text-xs font-mono text-slate-300">
              <div>
                <span className="text-slate-500">LAT G: </span>
                <span className="font-bold">{frame.latG.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">LONG G: </span>
                <span className="font-bold">{frame.longG.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Status Bar */}
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 px-1">
          <span>APEXWALL DIGITAL DASH UNIT v2.1</span>
          <span>{frame.rpm} RPM / {frame.maxRpm} MAX</span>
          <span>DIST: {frame.lapDistance}m / {frame.totalDistance}m</span>
        </div>
      </div>
    </div>
  );
}
