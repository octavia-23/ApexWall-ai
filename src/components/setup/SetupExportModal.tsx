"use client";

import React, { useState, useEffect } from "react";
import {
  SetupExportContext,
  generateACCJson,
  generateAssettoCorsaINI,
  generateRFactorSVM,
  generateIRacingText,
  generateF1SetupJson,
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

  const handleExportRFactor = () => {
    const svmStr = generateRFactorSVM(context);
    downloadFile(svmStr, `${baseFilename}.svm`, "text/plain");
    notify("Exported rFactor 2 / LMU .svm setup file");
  };

  const handleExportIRacing = () => {
    const txtStr = generateIRacingText(context);
    downloadFile(txtStr, `${baseFilename}.sto.txt`, "text/plain");
    notify("Exported iRacing setup specification");
  };

  const handleExportF1 = () => {
    const f1Str = generateF1SetupJson(context);
    downloadFile(f1Str, `${baseFilename}_f1.json`, "application/json");
    notify("Exported EA Sports F1 setup specification");
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
        <span className="text-cyan-400 font-bold">⚡</span>
        <span>{buttonLabel}</span>
      </button>

      {/* Modal Backdrop & Container */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-2xl bg-[#0b0e14] border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden text-left"
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
            <div className="px-6 py-4 bg-black/40 border-t border-white/10">
              <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                <span>Direct File Downloads (Standalone):</span>
                {downloadNotice && (
                  <span className="text-emerald-400 font-sans text-xs">
                    ✓ {downloadNotice}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* ACC */}
                <button
                  type="button"
                  onClick={handleExportACC}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      ACC
                    </div>
                    <div className="text-[10px] text-slate-400">GT World Challenge</div>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                    .JSON
                  </span>
                </button>

                {/* Assetto Corsa */}
                <button
                  type="button"
                  onClick={handleExportAC}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      Assetto Corsa
                    </div>
                    <div className="text-[10px] text-slate-400">Kunos / CM</div>
                  </div>
                  <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">
                    .INI
                  </span>
                </button>

                {/* iRacing */}
                <button
                  type="button"
                  onClick={handleExportIRacing}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      iRacing
                    </div>
                    <div className="text-[10px] text-slate-400">Garage Sheet</div>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                    .STO.TXT
                  </span>
                </button>

                {/* LMU / rFactor 2 */}
                <button
                  type="button"
                  onClick={handleExportRFactor}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      LMU / rFactor 2
                    </div>
                    <div className="text-[10px] text-slate-400">Le Mans Ultimate</div>
                  </div>
                  <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                    .SVM
                  </span>
                </button>

                {/* EA Sports F1 */}
                <button
                  type="button"
                  onClick={handleExportF1}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      EA Sports F1
                    </div>
                    <div className="text-[10px] text-slate-400">F1 23 / 24 Spec</div>
                  </div>
                  <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                    .JSON
                  </span>
                </button>

                {/* Printable Run Sheet */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-left transition-colors flex items-center justify-between group"
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                      Printable Sheet
                    </div>
                    <div className="text-[10px] text-slate-400">PDF / Printout</div>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-500/20 text-slate-300 px-1.5 py-0.5 rounded">
                    PDF
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
