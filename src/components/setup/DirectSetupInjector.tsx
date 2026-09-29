"use client";

import React, { useState, useEffect } from "react";
import { SetupExportContext, downloadFile } from "@/lib/setup-exporter";
import {
  SUPPORTED_SIMS,
  SupportedSimConfig,
  resolveSimConfig,
  checkLocalBridgeHealth,
  injectViaLocalBridge,
  injectViaFileSystemAccess,
  downloadBatchAutoInstaller,
  isFileSystemAccessSupported,
  sanitizeSlug,
  normalizeTrackSlug,
} from "@/lib/sim-injector";

interface DirectSetupInjectorProps {
  context: SetupExportContext;
  onClose?: () => void;
}

export const DirectSetupInjector: React.FC<DirectSetupInjectorProps> = ({
  context,
  onClose,
}) => {
  const initialSim = resolveSimConfig(context.game);
  const [selectedSim, setSelectedSim] = useState<SupportedSimConfig>(initialSim);
  const [bridgeStatus, setBridgeStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isInjecting, setIsInjecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
    path?: string;
  } | null>(null);

  const defaultSetupName = `${sanitizeSlug(context.car)}_${normalizeTrackSlug(context.track, selectedSim.id)}_ApexWall`;
  const [setupName, setSetupName] = useState(defaultSetupName);

  // Check Local Bridge Health on mount
  useEffect(() => {
    let mounted = true;
    checkLocalBridgeHealth().then((health) => {
      if (!mounted) return;
      setBridgeStatus(health.online ? "online" : "offline");
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Update setupName if sim changes
  useEffect(() => {
    setSetupName(
      `${sanitizeSlug(context.car)}_${normalizeTrackSlug(context.track, selectedSim.id)}_ApexWall`
    );
  }, [selectedSim, context.car, context.track]);

  const targetFilename = `${setupName.trim() || "ApexWall_Setup"}${selectedSim.fileExtension}`;
  const targetDirWindows = selectedSim.getWindowsDirString(context.car, context.track);
  const fullPreviewPath = `%USERPROFILE%\\${targetDirWindows}\\${targetFilename}`;

  const handleInject = async (forceFolderPick = false) => {
    setIsInjecting(true);
    setStatusMessage(null);

    const content = selectedSim.generateContent(context);

    // 1. Try local bridge first if online and not forcing folder pick
    if (bridgeStatus === "online" && !forceFolderPick) {
      const res = await injectViaLocalBridge({
        simId: selectedSim.id,
        car: context.car,
        track: context.track,
        filename: targetFilename,
        content,
      });

      setIsInjecting(false);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Injected via ApexWall Local Bridge into your simulator folder!`,
          path: res.savedPath,
        });
        return;
      }
    }

    // 2. Try browser File System Access API
    if (isFileSystemAccessSupported()) {
      const res = await injectViaFileSystemAccess({
        sim: selectedSim,
        car: context.car,
        track: context.track,
        filename: targetFilename,
        content,
        forceFolderPick,
      });

      setIsInjecting(false);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Saved directly to your local sim directory!`,
          path: res.path,
        });
        return;
      } else if (res.message.includes("cancelled")) {
        setStatusMessage({
          type: "info",
          text: "Folder selection was cancelled.",
        });
        return;
      }
    }

    // 3. Fallback: Download 1-Click Auto-Installer bundle
    setIsInjecting(false);
    downloadBatchAutoInstaller({
      sim: selectedSim,
      car: context.car,
      track: context.track,
      setupName,
      content,
    });

    setStatusMessage({
      type: "info",
      text: `Downloaded setup file & 1-click installer. Run 'Install_${sanitizeSlug(setupName)}.bat' to place it into your game folder.`,
      path: fullPreviewPath,
    });
  };

  const handleDownloadOnly = () => {
    const content = selectedSim.generateContent(context);
    downloadFile(content, targetFilename, selectedSim.mimeType);
    setStatusMessage({
      type: "info",
      text: `Downloaded native ${selectedSim.fileExtension} setup file.`,
    });
  };

  const handleDownloadBatch = () => {
    const content = selectedSim.generateContent(context);
    downloadBatchAutoInstaller({
      sim: selectedSim,
      car: context.car,
      track: context.track,
      setupName,
      content,
    });
  };

  return (
    <div className="sim-injector-card bg-[#0E1320] border border-blue-500/30 rounded-xl p-5 shadow-2xl text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-sm">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide uppercase text-white font-mono flex items-center gap-2">
              1-Click Direct Setup Injection
              <span className="text-[10px] font-sans font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                ALL SIMS
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Injects calibrated setups directly into your game’s Documents directory
            </p>
          </div>
        </div>

        {/* Live Bridge / File API Status Indicator */}
        <div className="flex items-center gap-2">
          {bridgeStatus === "online" ? (
            <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              BRIDGE ACTIVE (0-CLICK)
            </div>
          ) : isFileSystemAccessSupported() ? (
            <div className="text-[11px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-full">
              BROWSER DISK ACCESS READY
            </div>
          ) : (
            <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full">
              DIRECT DOWNLOAD + .BAT
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Simulator Selector Tabs */}
      <div className="mb-4">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
          Select Target Simulator:
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
          {Object.values(SUPPORTED_SIMS).map((sim) => {
            const isSelected = selectedSim.id === sim.id;
            return (
              <button
                key={sim.id}
                type="button"
                onClick={() => {
                  setSelectedSim(sim);
                  setStatusMessage(null);
                }}
                className={`px-3 py-2 rounded-lg text-left transition-all border ${
                  isSelected
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 font-bold"
                    : "bg-white/[0.03] border-white/10 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                }`}
              >
                <div className="text-xs font-bold font-mono flex items-center justify-between">
                  <span>{sim.shortName}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {sim.fileExtension}
                  </span>
                </div>
                <div className="text-[10px] truncate text-slate-400 mt-0.5">
                  {sim.displayName.replace(/(\(.*?\))/g, "").trim()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Setup Name & Target Path Specification */}
      <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Setup Name in Game:
            </label>
            <div className="flex items-center bg-[#131924] border border-white/15 rounded px-2.5 py-1.5">
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-cyan-300 focus:outline-none"
                placeholder="ApexWall_Setup"
              />
              <span className="text-[11px] font-mono text-slate-500 ml-1">
                {selectedSim.fileExtension}
              </span>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10.5px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Destination Windows Path:
            </label>
            <div
              className="text-[11px] font-mono bg-[#131924] border border-white/10 rounded px-2.5 py-1.5 text-slate-300 truncate"
              title={fullPreviewPath}
            >
              {fullPreviewPath}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          disabled={isInjecting}
          onClick={() => handleInject(false)}
          className="flex-1 min-w-[200px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold text-xs font-mono py-2.5 px-4 rounded-lg shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isInjecting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>INJECTING SETUP...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>INJECT SETUP DIRECTLY INTO {selectedSim.shortName.toUpperCase()}</span>
            </>
          )}
        </button>

        {isFileSystemAccessSupported() && (
          <button
            type="button"
            onClick={() => handleInject(true)}
            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-xs font-mono text-slate-300 transition-colors flex items-center gap-1.5"
            title="Browse or select custom sim installation directory"
          >
            <span>📁</span>
            <span>Select Sim Folder</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDownloadOnly}
          className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-xs font-mono text-slate-300 transition-colors flex items-center gap-1.5"
          title="Direct download file without disk injection"
        >
          <span>💾</span>
          <span>Download {selectedSim.fileExtension}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadBatch}
          className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-xs font-mono text-slate-300 transition-colors flex items-center gap-1.5"
          title="Download setup file and a 1-click .bat auto-mover script"
        >
          <span>🚀</span>
          <span>1-Click .bat</span>
        </button>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-mono border transition-all ${
            statusMessage.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : statusMessage.type === "error"
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
              : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
          }`}
        >
          <div className="font-semibold flex items-center gap-2">
            {statusMessage.type === "success" ? "✓" : "ℹ"} {statusMessage.text}
          </div>
          {statusMessage.path && (
            <div className="mt-1 text-[11px] text-slate-300/80 truncate font-mono">
              Location: {statusMessage.path}
            </div>
          )}
          {statusMessage.type === "success" && (
            <div className="mt-2 pt-2 border-t border-emerald-500/20 text-[11px] text-emerald-200/90 font-sans">
              <strong>Next Step:</strong> Open {selectedSim.displayName} &gt; Go to Garage / Setup &gt; Select{" "}
              <strong>"{setupName}"</strong> and click Load!
            </div>
          )}
        </div>
      )}
    </div>
  );
};
