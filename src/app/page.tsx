"use client";

import React, { useState, useEffect } from "react";
import { CockpitNavbar } from "@/components/CockpitNavbar";
import { WorkspaceMode } from "@/components/ModeNavigation";
import { SetupGenerator } from "@/components/setup/SetupGenerator";
import { TelemetryAnalyzer } from "@/components/telemetry/TelemetryAnalyzer";
import { LiveTelemetryHUD } from "@/components/telemetry/LiveTelemetryHUD";
import { StrategyTools } from "@/components/tools/StrategyTools";
import { SetupVaultModal } from "@/components/vault/SetupVaultModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { Footer } from "@/components/Footer";
import { SavedSetupRecord, getSavedSetups } from "@/lib/setup-vault";
import { RaceEngineerChat } from "@/components/engineer/RaceEngineerChat";
import { SetupExportContext } from "@/lib/setup-exporter";
import { TelemetryAnalysisResult, ParsedTelemetryFile } from "@/types/telemetry";

export default function Home() {
  const [mode, setMode] = useState<WorkspaceMode>("telemetry");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVaultOpen, setIsVaultOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [savedSetupsCount, setSavedSetupsCount] = useState<number>(0);
  const [sessionCar, setSessionCar] = useState<string>("");
  const [sessionTrack, setSessionTrack] = useState<string>("");
  const [sessionGame, setSessionGame] = useState<string>("");

  const handleSessionChange = (session: { car?: string; track?: string; game?: string }) => {
    if (session.car !== undefined) setSessionCar(session.car);
    if (session.track !== undefined) setSessionTrack(session.track);
    if (session.game !== undefined) setSessionGame(session.game);
  };

  const [lastGeneratedSetup, setLastGeneratedSetup] = useState<SetupExportContext | null>(null);
  const [lastTelemetryResult, setLastTelemetryResult] = useState<TelemetryAnalysisResult | null>(null);
  const [lastTelemetryFile, setLastTelemetryFile] = useState<ParsedTelemetryFile | null>(null);

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
    if (setupContext.car) setSessionCar(setupContext.car);
    if (setupContext.track) setSessionTrack(setupContext.track);
    if (setupContext.game) setSessionGame(setupContext.game);
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
    if (saved.car) setSessionCar(saved.car);
    if (saved.track) setSessionTrack(saved.track);
    if (saved.game) setSessionGame(saved.game);
    setMode("setup");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200">
      <div>
        <CockpitNavbar
          mode={mode}
          onChangeMode={setMode}
          onOpenVault={() => setIsVaultOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          savedSetupsCount={savedSetupsCount}
          isLoading={isLoading}
          activeCar={sessionCar || setupInitialValues?.car}
          activeTrack={sessionTrack || setupInitialValues?.track}
        />

        {/* Dynamic Workspace Container */}
        <main className="w-full max-w-[1780px] mx-auto px-3 sm:px-5 py-3">
          <div style={{ display: mode === "setup" ? "block" : "none" }}>
            <SetupGenerator
              initialValues={setupInitialValues}
              onLoadingChange={setIsLoading}
              onSetupGenerated={setLastGeneratedSetup}
              onDiscussWithEngineer={() => setMode("engineer")}
              onSessionChange={handleSessionChange}
            />
          </div>

          <div style={{ display: mode === "telemetry" ? "block" : "none" }}>
            <TelemetryAnalyzer
              onLoadingChange={setIsLoading}
              onApplyToSetup={handleApplyToSetup}
              onTelemetryAnalyzed={(res, file) => {
                setLastTelemetryResult(res);
                setLastTelemetryFile(file);
              }}
              onDiscussWithEngineer={() => setMode("engineer")}
              onSessionChange={handleSessionChange}
            />
          </div>

          <div style={{ display: mode === "engineer" ? "block" : "none" }}>
            <RaceEngineerChat
              currentSetup={lastGeneratedSetup}
              telemetryResult={lastTelemetryResult}
              parsedTelemetry={lastTelemetryFile}
              activeCar={sessionCar || setupInitialValues?.car}
              activeTrack={sessionTrack || setupInitialValues?.track}
              onApplyAdjustmentToSetup={(advice) => {
                setSetupInitialValues((prev) => ({
                  ...prev,
                  handlingIssue: prev?.handlingIssue
                    ? `${prev.handlingIssue}. Engineer guidance: ${advice.slice(0, 150)}`
                    : advice.slice(0, 180),
                }));
              }}
              onSwitchToSetup={() => setMode("setup")}
            />
          </div>

          <div style={{ display: mode === "strategy" ? "block" : "none" }}>
            <StrategyTools
              onApplyPressuresToSetup={handleApplyPressures}
              onApplyFuelToSetup={handleApplyFuel}
              activeCar={sessionCar || setupInitialValues?.car}
              activeTrack={sessionTrack || setupInitialValues?.track}
            />
          </div>

          <div style={{ display: mode === "live" ? "block" : "none" }}>
            <LiveTelemetryHUD />
          </div>
        </main>
      </div>

      {/* Setup Vault & Diff Modal */}
      <SetupVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onLoadSetup={handleLoadFromVault}
      />

      {/* Driver Authentication Modal (Google & Credentials) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <Footer />
    </div>
  );
}
