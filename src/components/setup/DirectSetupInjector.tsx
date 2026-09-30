"use client";

import React, { useState, useEffect } from "react";
import { SetupExportContext, downloadFile } from "@/lib/setup-exporter";
import {
  SUPPORTED_SIMS,
  SupportedSimConfig,
  resolveSimConfig,
  checkLocalBridgeHealth,
  injectViaLocalBridge,
  injectViaLocalApi,
  fetchLocalSimCars,
  injectViaFileSystemAccess,
  downloadBatchAutoInstaller,
  isFileSystemAccessSupported,
  sanitizeSlug,
  normalizeTrackSlug,
  resolveACCarId,
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
    genericPath?: string;
  } | null>(null);

  // Dynamic PC Path and Installed Cars State
  const [detectedSetupsRoot, setDetectedSetupsRoot] = useState<string | null>(null);
  const [installedCars, setInstalledCars] = useState<string[]>([]);
  const [isScanningCars, setIsScanningCars] = useState(false);
  const [matchedCarBadge, setMatchedCarBadge] = useState<string | null>(null);
  const [showCarDropdown, setShowCarDropdown] = useState(false);

  const [carFolder, setCarFolder] = useState(() =>
    selectedSim.id === "assetto-corsa" ? resolveACCarId(context.car) : sanitizeSlug(context.car)
  );
  const [trackFolder, setTrackFolder] = useState(() =>
    normalizeTrackSlug(context.track, selectedSim.id)
  );

  const defaultSetupName = `${carFolder}_${trackFolder}_ApexWall`;
  const [setupName, setSetupName] = useState(defaultSetupName);

  // Scan local PC for Assetto Corsa setups root and installed cars
  useEffect(() => {
    let mounted = true;
    if (selectedSim.id === "assetto-corsa") {
      setIsScanningCars(true);
      fetchLocalSimCars("assetto-corsa", context.car).then((res) => {
        if (!mounted) return;
        setIsScanningCars(false);
        if (res.success && res.setupsRoot) {
          setDetectedSetupsRoot(res.setupsRoot);
          if (res.cars && res.cars.length > 0) {
            setInstalledCars(res.cars);
          }
          if (res.matchedCar) {
            setCarFolder(res.matchedCar);
            setMatchedCarBadge(res.matchedCar);
            setSetupName(`${res.matchedCar}_${trackFolder}_ApexWall`);
          }
        }
      });
    } else {
      setDetectedSetupsRoot(null);
      setInstalledCars([]);
      setMatchedCarBadge(null);
    }
    return () => {
      mounted = false;
    };
  }, [selectedSim.id, context.car, trackFolder]);

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

  // Update setupName and folder targets if sim, car, or track changes
  useEffect(() => {
    const c = selectedSim.id === "assetto-corsa" ? (matchedCarBadge || resolveACCarId(context.car)) : sanitizeSlug(context.car);
    const t = normalizeTrackSlug(context.track, selectedSim.id);
    setCarFolder(c);
    setTrackFolder(t);
    setSetupName(`${c}_${t}_ApexWall`);
  }, [selectedSim, context.car, context.track, matchedCarBadge]);

  const targetFilename = `${setupName.trim() || "ApexWall_Setup"}${selectedSim.fileExtension}`;
  const targetDirWindows = selectedSim.getWindowsDirString(carFolder, trackFolder);
  const fullPreviewPath = detectedSetupsRoot && selectedSim.id === "assetto-corsa"
    ? `${detectedSetupsRoot}\\${carFolder}\\${trackFolder}\\${targetFilename}`
    : `%USERPROFILE%\\${targetDirWindows}\\${targetFilename}`;
  const genericPreviewPath =
    selectedSim.id === "assetto-corsa"
      ? (detectedSetupsRoot
          ? `${detectedSetupsRoot}\\${carFolder}\\generic\\${targetFilename}`
          : `%USERPROFILE%\\Documents\\Assetto Corsa\\setups\\${carFolder}\\generic\\${targetFilename}`)
      : null;

  const handleInject = async (forceFolderPick = false) => {
    setIsInjecting(true);
    setStatusMessage(null);

    const content = selectedSim.generateContent(context);

    // 1. Try Next.js local server API first if running locally and not forcing folder pick
    if (!forceFolderPick) {
      const apiRes = await injectViaLocalApi({
        simId: selectedSim.id,
        car: carFolder,
        track: trackFolder,
        filename: targetFilename,
        content,
        customCarFolder: carFolder,
      });

      if (apiRes.success) {
        setIsInjecting(false);
        setStatusMessage({
          type: "success",
          text: `Injected directly into ${selectedSim.shortName.toUpperCase()} setups!`,
          path: apiRes.savedPath,
          genericPath: apiRes.genericPath,
        });
        return;
      }
    }

    // 2. Try local bridge daemon if online and not forcing folder pick
    if (bridgeStatus === "online" && !forceFolderPick) {
      const bridgeRes = await injectViaLocalBridge({
        simId: selectedSim.id,
        car: carFolder,
        track: trackFolder,
        filename: targetFilename,
        content,
        customCarFolder: carFolder,
      });

      if (bridgeRes.success) {
        setIsInjecting(false);
        setStatusMessage({
          type: "success",
          text: `Injected via ApexWall Local Bridge into your simulator folder!`,
          path: bridgeRes.savedPath,
          genericPath: bridgeRes.genericPath,
        });
        return;
      }
    }

    // 3. Try browser File System Access API
    if (isFileSystemAccessSupported()) {
      const res = await injectViaFileSystemAccess({
        sim: selectedSim,
        car: carFolder,
        track: trackFolder,
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

    // 4. Fallback: Download 1-Click Auto-Installer bundle
    setIsInjecting(false);
    downloadBatchAutoInstaller({
      sim: selectedSim,
      car: carFolder,
      track: trackFolder,
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
      car: carFolder,
      track: trackFolder,
      setupName,
      content,
    });
  };

  return (
    <div className="sim-injector-card bg-transparent p-5 sm:p-6 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-base shadow-sm shrink-0">
            ⚡
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono flex items-center gap-2 tracking-wide uppercase">
              1-Click Direct Setup Injection
              <span className="text-[10px] font-sans font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded">
                All Sims
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Injects calibrated setups directly into your game&apos;s Documents directory
            </p>
          </div>
        </div>

        {/* Live Bridge / File API Status Indicator & Close Button */}
        <div className="flex items-center gap-2">
          {bridgeStatus === "online" ? (
            <div className="text-[11px] font-mono text-[#3fb37f] bg-[#3fb37f]/10 border border-[#3fb37f]/30 px-2.5 py-1 rounded-[4px]">
              Bridge active
            </div>
          ) : isFileSystemAccessSupported() ? (
            <div className="text-[11px] font-mono text-[#808690] bg-[#0f1012] border border-[#25282d] px-2.5 py-1 rounded-[4px]">
              Browser disk access ready
            </div>
          ) : (
            <div className="text-[11px] font-mono text-[#e0a83a] bg-[#e0a83a]/10 border border-[#e0a83a]/30 px-2.5 py-1 rounded-[4px]">
              Direct download + .bat
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-1"
              title="Close modal"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Simulator Selector Tabs */}
      <div className="mb-4">
        <label className="block text-[11px] font-mono text-[#808690] mb-1.5">
          Target simulator:
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
                className={`px-3 py-2 rounded-[4px] text-left transition-all border ${
                  isSelected
                    ? "bg-[#25282d] border-[#353941] text-[#d8dbdf] font-semibold"
                    : "bg-[#0f1012] border-[#25282d] text-[#808690] hover:bg-[#16181b] hover:text-[#c4c7cc]"
                }`}
              >
                <div className="text-xs font-semibold font-mono flex items-center justify-between">
                  <span>{sim.shortName}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded-[2px] font-mono ${
                      isSelected
                        ? "bg-[#353941] text-[#c4c7cc]"
                        : "bg-[#16181b] text-[#808690]"
                    }`}
                  >
                    {sim.fileExtension}
                  </span>
                </div>
                <div className="text-[10px] truncate text-[#808690] mt-0.5">
                  {sim.displayName.replace(/(\(.*?\))/g, "").trim()}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Setup Name & Target Path Specification */}
      <div className="bg-[#0f1012] border border-[#25282d] rounded-[4px] p-3.5 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-1">
            <label className="block text-[10.5px] font-mono text-[#808690] mb-1">
              Setup name in game:
            </label>
            <div className="flex items-center bg-[#16181b] border border-[#25282d] rounded-[4px] px-2.5 py-1.5">
              <input
                type="text"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full bg-transparent text-xs font-mono text-[#c4c7cc] focus:outline-none"
                placeholder="ApexWall_Setup"
              />
              <span className="text-[11px] font-mono text-[#808690] ml-1">
                {selectedSim.fileExtension}
              </span>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10.5px] font-mono text-[#808690] mb-1">
              Destination Windows path:
            </label>
            <div
              className="text-[11px] font-mono bg-[#16181b] border border-[#25282d] rounded-[4px] px-2.5 py-1.5 text-[#808690] truncate"
              title={fullPreviewPath}
            >
              {fullPreviewPath}
            </div>
            {genericPreviewPath && (
              <div
                className="text-[10px] font-mono bg-[#16181b]/50 border border-[#25282d] rounded-[4px] px-2.5 py-1 mt-1 text-[#3fb37f] truncate"
                title={genericPreviewPath}
              >
                + Generic: {genericPreviewPath}
              </div>
            )}
          </div>
        </div>

        {/* Simulator Directory Calibration for Assetto Corsa & Mods */}
        {selectedSim.id === "assetto-corsa" && (
          <div className="pt-3 border-t border-[#25282d] grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Detected PC Path Banner */}
            {detectedSetupsRoot && (
              <div className="sm:col-span-2 flex items-center justify-between bg-[#121818] border border-emerald-500/40 px-3 py-2 rounded-[4px]">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
                  <span className="text-[10.5px] font-mono text-emerald-400 font-semibold shrink-0">
                    PC Setups Folder Detected:
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 truncate" title={detectedSetupsRoot}>
                    {detectedSetupsRoot}
                  </span>
                </div>
                {installedCars.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-300 shrink-0 ml-2 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                    {installedCars.length} installed cars
                  </span>
                )}
              </div>
            )}

            {/* Car Folder ID with Auto-Match Badge & Dropdown */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono text-[#808690]">
                  AC Car Folder ID (Exact):
                </label>
                {installedCars.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCarDropdown(!showCarDropdown)}
                    className="text-[9.5px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                  >
                    {showCarDropdown ? "Close list ▲" : `Pick installed (${installedCars.length}) ▼`}
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={carFolder}
                  onChange={(e) => {
                    setCarFolder(e.target.value);
                    setMatchedCarBadge(null);
                  }}
                  className="w-full bg-[#16181b] border border-[#25282d] text-xs font-mono text-[#c4c7cc] px-2.5 py-1.5 rounded-[4px] focus:outline-none focus:border-cyan-500/50"
                  placeholder="rss_formula_hybrid_2021"
                />

                {/* Dropdown list of installed cars */}
                {showCarDropdown && installedCars.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-[#16181b] border border-[#353941] rounded shadow-xl p-1 font-mono text-xs">
                    <div className="px-2 py-1 text-[10px] text-slate-400 border-b border-[#25282d] sticky top-0 bg-[#16181b]">
                      Click an installed car to target:
                    </div>
                    {installedCars.map((carId) => (
                      <button
                        key={carId}
                        type="button"
                        onClick={() => {
                          setCarFolder(carId);
                          setMatchedCarBadge(carId);
                          setShowCarDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-[11px] truncate transition-colors flex items-center justify-between ${
                          carFolder === carId
                            ? "bg-cyan-500/20 text-cyan-300 font-semibold"
                            : "text-slate-300 hover:bg-[#25282d]"
                        }`}
                      >
                        <span className="truncate">{carId}</span>
                        {carFolder === carId && <span className="text-cyan-400 text-[10px]">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {matchedCarBadge && (
                <div className="mt-1 text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                  <span>✓ Auto-matched:</span>
                  <span className="font-semibold text-cyan-200">{matchedCarBadge}</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono text-[#808690]">
                  AC Track Folder:
                </label>
                <span className="text-[9.5px] font-mono text-cyan-400">
                  matches content/tracks/&lt;folder&gt;
                </span>
              </div>
              <input
                type="text"
                value={trackFolder}
                onChange={(e) => setTrackFolder(e.target.value)}
                className="w-full bg-[#16181b] border border-[#25282d] text-xs font-mono text-[#c4c7cc] px-2.5 py-1.5 rounded-[4px] focus:outline-none focus:border-cyan-500/50"
                placeholder="ks_silverstone"
              />
            </div>

            <div className="sm:col-span-2 text-[10.5px] text-[#808690] flex items-center gap-1.5 bg-[#16181b]/40 px-2.5 py-1.5 rounded-[4px]">
              <span className="text-[#3fb37f] font-bold">✓</span>
              <span>
                Dual injection active: File is automatically mirrored to both track folder &amp; car&apos;s <code className="text-slate-300">generic/</code> folder so it is always selectable in AC and Content Manager.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          disabled={isInjecting}
          onClick={() => handleInject(false)}
          className="flex-1 min-w-[200px] bg-[#2b3037] hover:bg-[#353b44] border border-[#3e444f] hover:border-[#4f5765] text-[#d8dbdf] hover:text-[#f0f2f5] font-semibold text-xs font-mono py-2.5 px-4 rounded-[4px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isInjecting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-[#808690] border-t-transparent rounded-full animate-spin"></span>
              <span>Injecting setup...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Inject setup into {selectedSim.shortName.toUpperCase()}</span>
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
              Track setup: {statusMessage.path}
            </div>
          )}
          {statusMessage.genericPath && (
            <div className="mt-0.5 text-[11px] text-emerald-400/90 truncate font-mono">
              Generic library: {statusMessage.genericPath}
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
