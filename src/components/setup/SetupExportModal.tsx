"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  SetupExportContext,
  generateACCJson,
  generateRFactorSVM,
  generateIRacingText,
  openPrintableRunSheet,
  downloadFile,
} from "@/lib/setup-exporter";

interface SetupExportModalProps {
  context: SetupExportContext;
  buttonLabel?: string;
  className?: string;
}

export const SetupExportModal: React.FC<SetupExportModalProps> = ({
  context,
  buttonLabel = "EXPORT SETUP",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState("");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const baseFilename = `${context.car.replace(/[^a-zA-Z0-9]/g, "_")}_${context.track.replace(/[^a-zA-Z0-9]/g, "_")}_ApexWall`;

  const handleExportACC = () => {
    const jsonStr = generateACCJson(context);
    downloadFile(jsonStr, `${baseFilename}.json`, "application/json");
    notify("Exported ACC .json setup file");
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

  const handlePrint = () => {
    openPrintableRunSheet(context);
    setIsOpen(false);
  };

  const notify = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => {
      setCopiedNotification("");
      setIsOpen(false);
    }, 1800);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className="action-btn action-btn-accent flex items-center gap-1.5"
        onClick={() => setIsOpen(!isOpen)}
        title="Export native simulation setup file"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-72 bg-[#121622] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden text-left p-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-white/5">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-300">
              Export Sim Setup File
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Native format ready for simulator setup folders
            </div>
          </div>

          <div className="py-1 flex flex-col gap-0.5">
            {/* ACC JSON */}
            <button
              type="button"
              className="w-full px-3 py-2 text-left rounded-md hover:bg-white/5 transition-colors flex flex-col group"
              onClick={handleExportACC}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  Assetto Corsa Competizione
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  .JSON
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 mt-0.5">
                Drop into Documents/ACC/Setups folder
              </span>
            </button>

            {/* rFactor 2 / LMU SVM */}
            <button
              type="button"
              className="w-full px-3 py-2 text-left rounded-md hover:bg-white/5 transition-colors flex flex-col group"
              onClick={handleExportRFactor}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  rFactor 2 & Le Mans Ultimate
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  .SVM
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 mt-0.5">
                Native rF2 / LMU physics setup file
              </span>
            </button>

            {/* iRacing Text */}
            <button
              type="button"
              className="w-full px-3 py-2 text-left rounded-md hover:bg-white/5 transition-colors flex flex-col group"
              onClick={handleExportIRacing}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  iRacing Specification
                </span>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                  .TXT
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 mt-0.5">
                Formatted garage parameter sheet
              </span>
            </button>

            <div className="my-1 border-t border-white/5"></div>

            {/* Printable Pit Wall Run Sheet */}
            <button
              type="button"
              className="w-full px-3 py-2 text-left rounded-md hover:bg-white/5 transition-colors flex flex-col group"
              onClick={handlePrint}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400">
                  Printable Run Sheet
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">
                  PDF / PRINT
                </span>
              </div>
              <span className="text-[10.5px] text-slate-400 mt-0.5">
                Trackside mechanic spec sheet
              </span>
            </button>
          </div>

          {copiedNotification && (
            <div className="px-3 py-1.5 bg-emerald-500/15 border-t border-emerald-500/30 text-[11px] font-mono text-emerald-300 text-center">
              ✓ {copiedNotification}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
