"use client";

import React, { useState, useRef } from "react";
import { parseAssettoCorsaModZip, parseACSetupINI, AssettoCorsaModData, ACModSlider } from "@/lib/ac-mod-parser";

interface ACModIngestorProps {
  onModParsed: (modData: AssettoCorsaModData) => void;
  onClearMod: () => void;
  currentMod: AssettoCorsaModData | null;
  currentCar?: string;
  currentTrack?: string;
}

export const ACModIngestor: React.FC<ACModIngestorProps> = ({
  onModParsed,
  onClearMod,
  currentMod,
  currentCar,
  currentTrack,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);
  const [showSlidersDrawer, setShowSlidersDrawer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const isZip = file.name.toLowerCase().endsWith(".zip");
    const isIni = file.name.toLowerCase().endsWith(".ini");

    if (!isZip && !isIni) {
      setError("Please upload an Assetto Corsa mod archive (.zip) or setup file (.ini, e.g. setup.ini or last.ini).");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDetectStatus(null);

    try {
      const startTime = performance.now();
      let modData: AssettoCorsaModData;

      if (isIni) {
        const text = await file.text();
        modData = parseACSetupINI(text, file.name);
        if (modData.sliders.length === 0) {
          throw new Error("No setup parameters or slider values found in this .ini file.");
        }
      } else {
        modData = await parseAssettoCorsaModZip(file);
        if (modData.sliders.length === 0 && !modData.hasAcdOnly && !modData.weightKg) {
          throw new Error(
            "No Assetto Corsa physics files (setup.ini, car.ini, or ui_car.json) were found in this ZIP archive."
          );
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      console.log(`[ACModIngestor] Parsed in ${elapsed}ms:`, modData);
      onModParsed(modData);
    } catch (err: any) {
      console.error("Mod ingestion error:", err);
      setError(err?.message || "Failed to parse Assetto Corsa setup file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoDetect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDetecting(true);
    setError(null);
    setDetectStatus("Scanning local Assetto Corsa installation & Document setups...");

    try {
      const targetCar = currentCar || "ferrari 488 gt3";
      const targetTrack = currentTrack || "";
      const res = await fetch(
        `/api/sim-cars?action=inspect&car=${encodeURIComponent(targetCar)}&track=${encodeURIComponent(targetTrack)}`
      );
      const data = await res.json();

      if (!res.ok || !data.success || !data.carData) {
        throw new Error(
          data.error || `Could not find installed setups for "${targetCar}" in Documents/Assetto Corsa/setups.`
        );
      }

      onModParsed(data.carData);
      setDetectStatus(null);
    } catch (err: any) {
      console.error("Auto-detect error:", err);
      setError(err?.message || "Failed to auto-detect installed Assetto Corsa car setup.");
    } finally {
      setIsDetecting(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="ac-mod-ingestor-container my-3">
      {/* Upload / Ingest Zone when no mod loaded */}
      {!currentMod ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              : "border-slate-700/80 hover:border-cyan-500/50 bg-[#0E131F]/80 hover:bg-[#121826]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.ini"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              {isLoading || isDetecting ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-200 flex items-center justify-center">
                <span>Assetto Corsa Mod / Setup</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isLoading
                  ? "Reading vehicle dynamics in browser..."
                  : "Drag & drop car mod (.zip) or setup file (.ini: setup.ini, last.ini) — or auto-detect below"}
              </p>
            </div>

            {/* Direct 1-Click Auto-Detect Button */}
            <div className="mt-1 pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={isDetecting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold shadow-sm transition-all"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                {isDetecting ? "Scanning System..." : "Auto-Detect from Installed Assetto Corsa"}
              </button>
            </div>
          </div>

          {detectStatus && (
            <div className="mt-2 text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded p-1.5">
              {detectStatus}
            </div>
          )}

          {error && (
            <div className="mt-2 text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-1.5">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Mod Ingested Active Card */
        <div className="rounded-xl border border-cyan-500/30 bg-[#0E1524] p-3.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold text-xs flex-shrink-0">
                AC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100 tracking-tight">{currentMod.name}</span>
                  {currentMod.brand && (
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {currentMod.brand}
                    </span>
                  )}
                  {currentMod.author && (
                    <span className="text-[10px] text-slate-400 hidden sm:inline">by {currentMod.author}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 mt-1">
                  {currentMod.weightKg && (
                    <span className="text-slate-300">
                      ⚖️ {currentMod.weightKg} kg
                      {currentMod.frontWeightRatio
                        ? ` (${(currentMod.frontWeightRatio * 100).toFixed(0)}% F)`
                        : ""}
                    </span>
                  )}
                  {currentMod.idealTyrePressures?.front && (
                    <span className="text-slate-300">
                      🎯 Target: {currentMod.idealTyrePressures.front} psi
                    </span>
                  )}
                  <span className="text-cyan-400 font-semibold">
                    🎛️ {currentMod.sliders.length} Custom Garage Sliders
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowSlidersDrawer(!showSlidersDrawer)}
                className="text-[10.5px] font-mono py-1 px-2 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition-colors"
              >
                {showSlidersDrawer ? "Hide Sliders" : "Inspect Sliders"}
              </button>
              <button
                type="button"
                onClick={onClearMod}
                title="Remove mod and reset"
                className="text-[10.5px] font-mono py-1 px-2 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer: Detailed list of extracted setup.ini sliders */}
          {showSlidersDrawer && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 max-h-56 overflow-y-auto pr-1">
              <div className="text-[10px] font-mono text-slate-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Extracted setup.ini Garage Parameters</span>
                <span>[MIN &bull; MAX &bull; STEP]</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {currentMod.sliders.map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1 px-2 rounded bg-slate-900/60 border border-slate-800/70 text-[10.5px] font-mono"
                  >
                    <div className="truncate mr-2">
                      <span className="text-slate-500 mr-1.5">[{s.category}]</span>
                      <span className="text-slate-200">{s.name}</span>
                    </div>
                    <span className="text-cyan-300 flex-shrink-0 font-semibold">
                      {s.min}..{s.max} (Δ{s.step})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
