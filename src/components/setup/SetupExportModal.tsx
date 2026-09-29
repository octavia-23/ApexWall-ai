"use client";

import React, { useState, useEffect } from "react";
import {
  SetupExportContext,
  generateACCJson,
  generateAssettoCorsaINI,
  generateACEvoINI,
  generateRFactorSVM,
  generateIRacingText,
  generateF1SetupJson,
  generateAMS2SVM,
  generateBeamNGPC,
  generateRaceRoomXML,
  generateForzaGTText,
  openPrintableRunSheet,
  downloadFile,
} from "@/lib/setup-exporter";
import { DirectSetupInjector } from "./DirectSetupInjector";
import { sanitizeSlug, normalizeTrackSlug } from "@/lib/sim-injector";

interface SetupExportModalProps {
  context: SetupExportContext;
  buttonLabel?: string;
  className?: string;
  defaultOpen?: boolean;
}

export const SetupExportModal: React.FC<SetupExportModalProps> = ({
  context,
  buttonLabel = "EXPORT / INJECT SETUP",
  className = "",
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [downloadNotice, setDownloadNotice] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const baseFilename = `${sanitizeSlug(context.car)}_${normalizeTrackSlug(context.track, "acc")}_ApexWall`;

  const handleExportACC = () => {
    const jsonStr = generateACCJson(context);
    downloadFile(jsonStr, `${baseFilename}.json`, "application/json");
    notify("Exported ACC .json setup file");
  };

  const handleExportAC = () => {
    const iniStr = generateAssettoCorsaINI(context);
    downloadFile(iniStr, `${baseFilename}.ini`, "text/plain");
    notify("Exported Assetto Corsa .ini setup file");
  };

  const handleExportACEvo = () => {
    const iniStr = generateACEvoINI(context);
    downloadFile(iniStr, `${baseFilename}_ace.ini`, "text/plain");
    notify("Exported Assetto Corsa Evo .ini setup file");
  };

  const handleExportIRacing = () => {
    const txtStr = generateIRacingText(context);
    downloadFile(txtStr, `${baseFilename}.sto.txt`, "text/plain");
    notify("Exported iRacing setup specification");
  };

  const handleExportRFactor = () => {
    const svmStr = generateRFactorSVM(context);
    downloadFile(svmStr, `${baseFilename}.svm`, "text/plain");
    notify("Exported rFactor 2 / LMU .svm setup file");
  };

  const handleExportAMS2 = () => {
    const svmStr = generateAMS2SVM(context);
    downloadFile(svmStr, `${baseFilename}_ams2.svm`, "text/plain");
    notify("Exported Automobilista 2 .svm setup file");
  };

  const handleExportF1 = () => {
    const f1Str = generateF1SetupJson(context);
    downloadFile(f1Str, `${baseFilename}_f1.json`, "application/json");
    notify("Exported EA Sports F1 setup specification");
  };

  const handleExportBeamNG = () => {
    const pcStr = generateBeamNGPC(context);
    downloadFile(pcStr, `${baseFilename}.pc`, "application/json");
    notify("Exported BeamNG.drive tuning configuration");
  };

  const handleExportRaceRoom = () => {
    const xmlStr = generateRaceRoomXML(context);
    downloadFile(xmlStr, `${baseFilename}.xml`, "application/xml");
    notify("Exported RaceRoom .xml setup file");
  };

  const handleExportForzaGT = () => {
    const txtStr = generateForzaGTText(context);
    downloadFile(txtStr, `${baseFilename}_tuning.txt`, "text/plain");
    notify("Exported Forza & Gran Turismo 7 tuning guide");
  };

  const handlePrint = () => {
    openPrintableRunSheet(context);
  };

  const notify = (msg: string) => {
    setDownloadNotice(msg);
    setTimeout(() => {
      setDownloadNotice("");
    }, 2500);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        className="action-btn action-btn-accent flex items-center gap-1.5"
        onClick={() => setIsOpen(true)}
        title="Direct inject setup into sim or export native setup files"
      >
        <span className="text-blue-400 font-bold">⚡</span>
        <span>{buttonLabel}</span>
      </button>

      {/* Modal Backdrop & Container */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-3xl bg-[#090C14] border border-blue-500/30 rounded-2xl shadow-2xl overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Direct Setup Injector Engine */}
            <div className="p-1">
              <DirectSetupInjector
                context={context}
                onClose={() => setIsOpen(false)}
              />
            </div>

            {/* Quick Standalone File Downloads Section */}
            <div className="px-6 py-4 bg-[#07090F] border-t border-white/10">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  Direct File Downloads (Standalone Native Files):
                </span>
                {downloadNotice && (
                  <span className="text-emerald-400 font-sans text-xs font-semibold animate-pulse">
                    ✓ {downloadNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {/* Assetto Corsa (Original AC) */}
                <button
                  type="button"
                  onClick={handleExportAC}
                  className="px-2.5 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-white group-hover:text-blue-300">
                      Assetto Corsa
                    </span>
                    <span className="text-[9px] font-mono bg-blue-500/30 text-blue-200 px-1 py-0.2 rounded font-bold">
                      .INI
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Kunos / Content Mgr</div>
                </button>

                {/* Assetto Corsa Evo */}
                <button
                  type="button"
                  onClick={handleExportACEvo}
                  className="px-2.5 py-2 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-teal-200 group-hover:text-teal-100">
                      AC Evo
                    </span>
                    <span className="text-[9px] font-mono bg-teal-500/30 text-teal-200 px-1 py-0.2 rounded font-bold">
                      .INI
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Kunos 2025</div>
                </button>

                {/* ACC */}
                <button
                  type="button"
                  onClick={handleExportACC}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      ACC
                    </span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded">
                      .JSON
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">GT World Challenge</div>
                </button>

                {/* iRacing */}
                <button
                  type="button"
                  onClick={handleExportIRacing}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      iRacing
                    </span>
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded">
                      .STO
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Garage Sheet</div>
                </button>

                {/* LMU / rFactor 2 */}
                <button
                  type="button"
                  onClick={handleExportRFactor}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      LMU / rF2
                    </span>
                    <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded">
                      .SVM
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Le Mans Ultimate</div>
                </button>

                {/* Automobilista 2 */}
                <button
                  type="button"
                  onClick={handleExportAMS2}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      AMS2
                    </span>
                    <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded">
                      .SVM
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Madness Engine</div>
                </button>

                {/* EA Sports F1 */}
                <button
                  type="button"
                  onClick={handleExportF1}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      EA Sports F1
                    </span>
                    <span className="text-[9px] font-mono bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded">
                      .JSON
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">F1 23 / 24 / 25</div>
                </button>

                {/* BeamNG.drive */}
                <button
                  type="button"
                  onClick={handleExportBeamNG}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      BeamNG
                    </span>
                    <span className="text-[9px] font-mono bg-orange-500/20 text-orange-300 px-1 py-0.2 rounded">
                      .PC
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Vehicle Tuning</div>
                </button>

                {/* RaceRoom */}
                <button
                  type="button"
                  onClick={handleExportRaceRoom}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      RaceRoom
                    </span>
                    <span className="text-[9px] font-mono bg-indigo-500/20 text-indigo-300 px-1 py-0.2 rounded">
                      .XML
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Sector3 CarSetups</div>
                </button>

                {/* Forza & GT7 */}
                <button
                  type="button"
                  onClick={handleExportForzaGT}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Forza / GT7
                    </span>
                    <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded">
                      .TXT
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">In-Game Click Guide</div>
                </button>

                {/* Printable Run Sheet */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-2.5 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-white">
                      Print Sheet
                    </span>
                    <span className="text-[9px] font-mono bg-slate-500/20 text-slate-300 px-1 py-0.2 rounded">
                      PDF
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Pit Wall Document</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
