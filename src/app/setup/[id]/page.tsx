"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSetupById } from "@/lib/cloud-vault";
import { SavedSetupRecord, saveSetupToVault } from "@/lib/setup-vault";
import { SetupExportModal } from "@/components/setup/SetupExportModal";

export default function SharedSetupPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [setup, setSetup] = useState<SavedSetupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSetupById(id).then((res) => {
      setSetup(res);
      setLoading(false);
    });
  }, [id]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleSaveToVault = () => {
    if (!setup) return;
    saveSetupToVault({
      name: setup.name,
      game: setup.game,
      car: setup.car,
      track: setup.track,
      sessionType: setup.sessionType,
      weather: setup.weather,
      trackTemp: setup.trackTemp,
      airTemp: setup.airTemp,
      tyreCompound: setup.tyreCompound,
      fuelLoad: setup.fuelLoad,
      driverStyle: setup.driverStyle,
      summary: setup.summary,
      engineerNotes: setup.engineerNotes,
      sections: setup.sections,
    });
    setSavedToVault(true);
    setTimeout(() => setSavedToVault(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
        <div className="font-mono text-xs uppercase tracking-wider text-slate-400">
          Retrieving Shared Telemetry Setup...
        </div>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Setup Specification Not Found</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          This setup may have been removed or the share link has expired.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs uppercase tracking-wider transition-colors"
        >
          Return to ApexWall AI
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-[#0E131F]/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15l4-8 4 6 4-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-slate-100">ApexWall AI</span>
              <span className="text-[11px] font-mono text-slate-500 ml-1.5 hidden sm:inline">/ Shared Setup Sheet</span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{copiedLink ? "LINK COPIED ✓" : "COPY LINK"}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToVault}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{savedToVault ? "SAVED TO VAULT ✓" : "SAVE TO VAULT"}</span>
          </button>

          <SetupExportModal
            buttonLabel="EXPORT SIM SPEC"
            context={{
              game: setup.game,
              car: setup.car,
              track: setup.track,
              sessionType: setup.sessionType,
              weather: setup.weather,
              trackTemp: setup.trackTemp,
              airTemp: setup.airTemp,
              fuelLoad: setup.fuelLoad,
              tyreCompound: setup.tyreCompound,
              driverStyle: setup.driverStyle,
              summary: setup.summary,
              engineerNotes: setup.engineerNotes,
              sections: setup.sections,
            }}
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 py-8 w-full flex-1">
        {/* Header Hero */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-[#0D121F] to-[#0A0D14] border border-slate-800 shadow-xl">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded font-semibold">
              {setup.game}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              Verified Calibrated Spec
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
            {setup.name}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <div><span className="text-slate-500">CAR:</span> <span className="text-slate-200">{setup.car}</span></div>
            <div><span className="text-slate-500">CIRCUIT:</span> <span className="text-slate-200">{setup.track}</span></div>
            {setup.tyreCompound && <div><span className="text-slate-500">TYRES:</span> <span className="text-slate-200">{setup.tyreCompound}</span></div>}
            {setup.fuelLoad && <div><span className="text-slate-500">FUEL:</span> <span className="text-slate-200">{setup.fuelLoad}</span></div>}
            {setup.trackTemp && <div><span className="text-slate-500">TRACK TEMP:</span> <span className="text-slate-200">{setup.trackTemp}</span></div>}
          </div>
        </div>

        {/* Engineering Philosophy */}
        {setup.summary && (
          <div className="mb-6 p-5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 mb-2 text-xs font-mono font-semibold text-cyan-400">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>ENGINEERING PHILOSOPHY</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{setup.summary}</p>
          </div>
        )}

        {/* Setup Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {(setup.sections || []).map((sec, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                  {sec.title}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {sec.items?.length || 0} PARAMS
                </span>
              </div>
              <div className="space-y-2">
                {(sec.items || []).map((item, j) => (
                  <div key={j} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-0">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="font-mono font-medium text-cyan-300">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Team Radio Briefing */}
        {setup.engineerNotes && (
          <div className="p-5 rounded-xl bg-[#0D121F] border border-blue-500/20 mb-8">
            <div className="flex items-center justify-between text-xs font-mono mb-2 text-blue-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-bold">PIT WALL // RACE ENGINEER BRIEFING</span>
              </div>
              <span className="text-slate-500">RADIO CH 1 · SECURE</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-sans">{setup.engineerNotes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
