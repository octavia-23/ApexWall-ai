"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { ModeNavigation, WorkspaceMode } from "@/components/ModeNavigation";
import { SetupGenerator } from "@/components/setup/SetupGenerator";
import { TelemetryAnalyzer } from "@/components/telemetry/TelemetryAnalyzer";
import { StrategyTools } from "@/components/tools/StrategyTools";
import { SetupVaultModal } from "@/components/vault/SetupVaultModal";
import { Footer } from "@/components/Footer";
import { SavedSetupRecord, getSavedSetups } from "@/lib/setup-vault";

export default function Home() {
  const [mode, setMode] = useState<WorkspaceMode>("telemetry");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [savedSetupsCount, setSavedSetupsCount] = useState<number>(0);

  const [setupInitialValues, setSetupInitialValues] = useState<{
    game?: string;
    car?: string;
    track?: string;
    sessionType?: string;
    weather?: string;
    trackTemp?: string;
    airTemp?: string;
    tyreCompound?: string;
    fuelLoad?: string;
    handlingIssue?: string;
    driverStyle?: string;
  } | undefined>(undefined);

  // Sync count of saved setups from local storage
  useEffect(() => {
    const refreshVaultCount = () => {
      const list = getSavedSetups();
      setSavedSetupsCount(list.length);
    };
    refreshVaultCount();
    window.addEventListener("simsetup_vault_updated", refreshVaultCount);
    window.addEventListener("storage", refreshVaultCount);
    return () => {
      window.removeEventListener("simsetup_vault_updated", refreshVaultCount);
      window.removeEventListener("storage", refreshVaultCount);
    };
  }, [isVaultOpen]);

  const handleApplyToSetup = (setupContext: {
    game: string;
    car: string;
    track: string;
    trackTemp: string;
    airTemp: string;
    tyreCompound: string;
    fuelLoad: string;
    handlingIssue: string;
  }) => {
    setSetupInitialValues(setupContext);
    setMode("setup");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleApplyPressures = (pressures: { FL: number; FR: number; RL: number; RR: number }) => {
    const pressureSummary = `Target Cold Pressures: FL ${pressures.FL}, FR ${pressures.FR}, RL ${pressures.RL}, RR ${pressures.RR} psi`;
    setSetupInitialValues((prev) => ({
      ...prev,
      handlingIssue: prev?.handlingIssue
        ? `${prev.handlingIssue}. Calibrated tyre pressures: FL ${pressures.FL}, FR ${pressures.FR}, RL ${pressures.RL}, RR ${pressures.RR}`
        : pressureSummary,
    }));
    setMode("setup");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleApplyFuel = (liters: number) => {
    setSetupInitialValues((prev) => ({
      ...prev,
      fuelLoad: `${liters} L`,
    }));
    setMode("setup");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLoadFromVault = (saved: SavedSetupRecord) => {
    setSetupInitialValues({
      game: saved.game,
      car: saved.car,
      track: saved.track,
      sessionType: saved.sessionType,
      weather: saved.weather,
      trackTemp: saved.trackTemp,
      airTemp: saved.airTemp,
      handlingIssue: saved.summary || "",
    });
    setMode("setup");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#0B0E14]">
      <div>
        <Header isLoading={isLoading} />

        {/* Contextual Workspace Header */}
        <div className="max-w-[1440px] mx-auto px-6 pt-6 pb-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
                Homologated Workspace
              </span>
              <span className="text-[11px] font-mono text-slate-500">v2.6.0</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
              Chassis & Telemetry Engineering Platform
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-0.5 max-w-2xl">
              MoTeC-grade telemetry diagnostics, real-time driver coaching, pit strategy calculators, and AI-synthesized car setups.
            </p>
          </div>

          <div className="flex-shrink-0">
            <ModeNavigation
              mode={mode}
              onChangeMode={setMode}
              onOpenVault={() => setIsVaultOpen(true)}
              savedSetupsCount={savedSetupsCount}
            />
          </div>
        </div>

        {/* Dynamic Workspace Container */}
        <main className="main-content">
          <div style={{ display: mode === "setup" ? "block" : "none" }}>
            <SetupGenerator
              initialValues={setupInitialValues}
              onLoadingChange={setIsLoading}
            />
          </div>

          <div style={{ display: mode === "telemetry" ? "block" : "none" }}>
            <TelemetryAnalyzer
              onLoadingChange={setIsLoading}
              onApplyToSetup={handleApplyToSetup}
            />
          </div>

          <div style={{ display: mode === "strategy" ? "block" : "none" }}>
            <StrategyTools
              onApplyPressuresToSetup={handleApplyPressures}
              onApplyFuelToSetup={handleApplyFuel}
            />
          </div>
        </main>
      </div>

      {/* Setup Vault & Diff Modal */}
      <SetupVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onLoadSetup={handleLoadFromVault}
      />

      <Footer />
    </div>
  );
}
