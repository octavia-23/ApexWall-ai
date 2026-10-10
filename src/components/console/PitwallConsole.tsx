"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { TelemetryAnalyzer } from "@/components/telemetry/TelemetryAnalyzer";
import { SetupGenerator } from "@/components/setup/SetupGenerator";
import { StrategyTools } from "@/components/tools/StrategyTools";
import { LiveTelemetryHUD } from "@/components/telemetry/LiveTelemetryHUD";
import { RaceEngineerChat } from "@/components/engineer/RaceEngineerChat";
import { SetupVaultModal } from "@/components/vault/SetupVaultModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { SavedSetupRecord, getSavedSetups } from "@/lib/setup-vault";
import { SetupExportContext } from "@/lib/setup-exporter";
import { TelemetryAnalysisResult, ParsedTelemetryFile } from "@/types/telemetry";
import { ACT_CSS, THEMES, AgentConsolePalette } from "@/components/ui/agent-console-template";
import { parseTelemetryCSV } from "@/lib/telemetry-parser";

export type PitwallTab = "telemetry" | "setup" | "strategy" | "live" | "engineer";

export interface StintSession {
  id: string;
  title: string;
  car: string;
  track: string;
  lapTime: string;
  tag: string;
  active?: boolean;
  samplePath?: string;
  parsedData?: ParsedTelemetryFile;
}

const PRESET_STINTS: StintSession[] = [
  {
    id: "spa-blanchimont",
    title: "Spa Quali Stint 2",
    car: "Ferrari 296 GT3",
    track: "Circuit de Spa-Francorchamps",
    lapTime: "2:16.842",
    tag: "High-Speed Oversteer",
    samplePath: "/sample-telemetry/spa-gt3-motec.csv",
    active: true,
  },
  {
    id: "monza-quali",
    title: "Monza T1 Braking Test",
    car: "Porsche 992 GT3 R",
    track: "Autodromo Nazionale Monza",
    lapTime: "1:46.312",
    tag: "Trail-Brake Lockup",
    samplePath: "/sample-telemetry/monza-gt3-motec.csv",
  },
  {
    id: "nurburgring-damp",
    title: "Nürburgring 24h Baseline",
    car: "BMW M4 GT3",
    track: "Nürburgring Nordschleife",
    lapTime: "8:04.190",
    tag: "Kerb Compliance",
    samplePath: "/sample-telemetry/nordschleife-gt3.csv",
  },
  {
    id: "silverstone-endurance",
    title: "Silverstone 1h Stint 1",
    car: "Aston Martin Vantage GT3",
    track: "Silverstone Circuit",
    lapTime: "1:58.420",
    tag: "Tyre Degradation",
    samplePath: "/sample-telemetry/silverstone-f1.csv",
  },
];

export const PitwallConsole: React.FC = () => {
  // Navigation & Workspace State
  const [activeTab, setActiveTab] = useState<PitwallTab>("telemetry");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [inspectorView, setInspectorView] = useState<"engineer" | "store">("engineer");
  const [stints, setStints] = useState<StintSession[]>(PRESET_STINTS);
  const [activeStintId, setActiveStintId] = useState<string>("spa-blanchimont");
  const [stintSearch, setStintSearch] = useState("");

  // Modals
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [savedSetupsCount, setSavedSetupsCount] = useState(0);

  // Settings & Theme
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"apex" | "night" | "sage" | "paper" | "lilac">("apex");

  // Telemetry & Setup State
  const [sessionCar, setSessionCar] = useState("Ferrari 296 GT3");
  const [sessionTrack, setSessionTrack] = useState("Circuit de Spa-Francorchamps");
  const [sessionGame, setSessionGame] = useState("Assetto Corsa Competizione");

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
    telemetryContext?: any;
    baselineSetup?: any;
  } | undefined>(undefined);

  // Live Parameter Store (Observed vs Set vs Recommended)
  const [store, setStore] = useState<Record<string, { value: string | number; kind: "observed" | "set" | "agent" }>>({
    telemetryLapTime: { value: "2:16.842", kind: "observed" },
    trailBrakingScore: { value: "84%", kind: "observed" },
    maxLateralG: { value: "2.38 g", kind: "observed" },
    apexSpeedBlanchimont: { value: "238.4 km/h", kind: "observed" },
    carModel: { value: "Ferrari 296 GT3", kind: "set" },
    circuit: { value: "Circuit de Spa-Francorchamps", kind: "set" },
    trackTemp: { value: "28°C", kind: "set" },
    fuelLoad: { value: "48 L", kind: "set" },
    frontBrakeBias: { value: "55.2%", kind: "agent" },
    antiRollBarFront: { value: "Blade 4", kind: "agent" },
    antiRollBarRear: { value: "Blade 2", kind: "agent" },
    rearWingAngle: { value: "P7 (+1)", kind: "agent" },
    rearRideHeight: { value: "52 mm (+2mm)", kind: "agent" },
    differentialPreload: { value: "70 Nm (+15)", kind: "agent" },
    targetTyrePressureFL: { value: "26.4 psi", kind: "agent" },
    targetTyrePressureFR: { value: "26.6 psi", kind: "agent" },
  });

  const [editingStoreKey, setEditingStoreKey] = useState<string | null>(null);
  const [editStoreVal, setEditStoreVal] = useState<string>("");
  const [pulsingStoreKey, setPulsingStoreKey] = useState<string | null>(null);

  // Quick Engineer Question State for the right panel
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [copilotNotes, setCopilotNotes] = useState<Array<{ role: "driver" | "engineer"; text: string; action?: string }>>([
    {
      role: "engineer",
      text: "Radio check, telemetry synced for Spa Stint 2. We observed snap oversteer through Blanchimont apex (Turn 17) under compression.",
      action: "Raise rear ride height +2mm and stiffen diff preload to 70 Nm.",
    },
  ]);

  // Sync vault count
  useEffect(() => {
    const refreshVault = () => setSavedSetupsCount(getSavedSetups().length);
    refreshVault();
    window.addEventListener("simsetup_vault_updated", refreshVault);
    window.addEventListener("storage", refreshVault);
    return () => {
      window.removeEventListener("simsetup_vault_updated", refreshVault);
      window.removeEventListener("storage", refreshVault);
    };
  }, [isVaultOpen]);

  // Keyboard shortcuts (Cmd+\ for inspector, Cmd+B for sidebar, Cmd+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "\\") {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectStint = async (s: StintSession) => {
    setActiveStintId(s.id);
    setSessionCar(s.car);
    setSessionTrack(s.track);

    if (s.parsedData) {
      setLastTelemetryFile(s.parsedData);
    } else if (s.samplePath) {
      try {
        const res = await fetch(s.samplePath);
        if (res.ok) {
          const text = await res.text();
          const parsed = parseTelemetryCSV(text, s.samplePath.split("/").pop() || "sample.csv");
          s.parsedData = parsed;
          setLastTelemetryFile(parsed);
        }
      } catch (err) {
        console.warn("Could not load sample CSV:", err);
      }
    }

    setStore((prev) => ({
      ...prev,
      carModel: { value: s.car, kind: "set" },
      circuit: { value: s.track, kind: "set" },
      telemetryLapTime: { value: s.lapTime, kind: "observed" },
    }));
  };

  const handleFileIngest = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseTelemetryCSV(text, file.name);

      const newStint: StintSession = {
        id: "stint-" + Date.now(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        car: sessionCar,
        track: sessionTrack,
        lapTime: parsed.lapTime || "--:--.---",
        tag: parsed.detectedAnomalies && parsed.detectedAnomalies.length > 0 ? `${parsed.detectedAnomalies.length} Anomalies` : "Custom Ingest",
        parsedData: parsed,
        active: true,
      };

      setStints((prev) => [newStint, ...prev.map((s) => ({ ...s, active: false }))]);
      setActiveStintId(newStint.id);
      setLastTelemetryFile(parsed);
      setActiveTab("telemetry");

      setStore((prev) => ({
        ...prev,
        telemetryLapTime: { value: parsed.lapTime || "--:--.---", kind: "observed" },
        trailBrakingScore: { value: `${parsed.trailBrakingScore || 80}%`, kind: "observed" },
        maxLateralG: { value: `${parsed.maxLatG?.toFixed(2) || "2.20"} g`, kind: "observed" },
        apexSpeedBlanchimont: { value: `${parsed.minSpeed?.toFixed(1) || "120.0"} km/h`, kind: "observed" },
      }));

      setCopilotNotes((prev) => [
        ...prev,
        {
          role: "engineer",
          text: `Ingested ${file.name} successfully. Recorded lap time: ${parsed.lapTime}. 50Hz telemetry parsed.`,
          action: "Review speed and friction circle traces.",
        },
      ]);
    } catch (err: any) {
      alert(`Could not parse telemetry file: ${err.message}`);
    }
  };

  // Auto-load initial default stint telemetry
  useEffect(() => {
    const defaultStint = PRESET_STINTS[0];
    if (defaultStint?.samplePath && !lastTelemetryFile) {
      fetch(defaultStint.samplePath)
        .then((res) => (res.ok ? res.text() : null))
        .then((text) => {
          if (text) {
            const parsed = parseTelemetryCSV(text, defaultStint.samplePath!.split("/").pop() || "spa.csv");
            defaultStint.parsedData = parsed;
            setLastTelemetryFile(parsed);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleApplyToSetup = (setupContext: any) => {
    setSetupInitialValues(setupContext);
    if (setupContext.car) setSessionCar(setupContext.car);
    if (setupContext.track) setSessionTrack(setupContext.track);
    if (setupContext.game) setSessionGame(setupContext.game);
    setActiveTab("setup");
  };

  const handleApplyPressures = (pressures: { FL: number; FR: number; RL: number; RR: number }) => {
    setStore((prev) => ({
      ...prev,
      targetTyrePressureFL: { value: `${pressures.FL} psi`, kind: "agent" },
      targetTyrePressureFR: { value: `${pressures.FR} psi`, kind: "agent" },
    }));
    setActiveTab("setup");
  };

  const handleApplyFuel = (liters: number) => {
    setStore((prev) => ({
      ...prev,
      fuelLoad: { value: `${liters} L`, kind: "set" },
    }));
    setActiveTab("setup");
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
    setActiveTab("setup");
  };

  const handleAskCopilot = (text?: string) => {
    const q = (text || copilotQuestion).trim();
    if (!q) return;
    setCopilotNotes((prev) => [...prev, { role: "driver", text: q }]);
    setCopilotQuestion("");

    // Simulated authentic engineering diagnostic response
    setTimeout(() => {
      let response = "Understood driver. Telemetry shows weight transfer rate is too rapid.";
      let rec = "Soft rear anti-roll bar by 1 blade and reduce rear bump damping.";

      const lower = q.toLowerCase();
      if (lower.includes("oversteer") || lower.includes("snap")) {
        response = "Confirmed rear yaw angle exceeded 4.8° on Blanchimont apex kerb. The diffuser stalled under pitch.";
        rec = "Raise rear ride height by +2mm and increase diff preload to 70 Nm.";
        setStore((prev) => ({
          ...prev,
          rearRideHeight: { value: "52 mm (+2mm)", kind: "agent" },
          differentialPreload: { value: "70 Nm (+15)", kind: "agent" },
        }));
      } else if (lower.includes("understeer") || lower.includes("push") || lower.includes("turn-in")) {
        response = "Front tire scrub index reached 92% into corner entry. Front axle is saturated.";
        rec = "Soft front anti-roll bar by 1 blade and increase front negative camber by -0.2°.";
        setStore((prev) => ({
          ...prev,
          antiRollBarFront: { value: "Blade 3 (-1)", kind: "agent" },
        }));
      } else if (lower.includes("brake") || lower.includes("bias") || lower.includes("lock")) {
        response = "Deceleration spike 2.18g causing right-front lockup 35m before apex.";
        rec = "Shift brake bias rearward from 56.4% to 54.8% (-1.6%).";
        setStore((prev) => ({
          ...prev,
          frontBrakeBias: { value: "54.8% (-1.6%)", kind: "agent" },
        }));
      }

      setCopilotNotes((prev) => [...prev, { role: "engineer", text: response, action: rec }]);
    }, 600);
  };

  const handleApplyAdviceToSetup = (actionText: string) => {
    setSetupInitialValues((prev) => ({
      ...prev,
      handlingIssue: prev?.handlingIssue ? `${prev.handlingIssue}. Engineer: ${actionText}` : `Engineer: ${actionText}`,
    }));

    // Intelligently parse advice and update live parameter store
    const lower = actionText.toLowerCase();
    let updatedKey: string | null = null;

    if (lower.includes("anti-roll bar") || lower.includes("arb")) {
      if (lower.includes("front")) {
        const val = lower.includes("soft") || lower.includes("reduce") || lower.includes("-") ? "Blade 2 (-1)" : "Blade 5 (+1)";
        setStore((prev) => ({ ...prev, antiRollBarFront: { value: val, kind: "agent" } }));
        updatedKey = "antiRollBarFront";
      } else {
        const val = lower.includes("soft") || lower.includes("reduce") || lower.includes("-") ? "Blade 1 (-1)" : "Blade 3 (+1)";
        setStore((prev) => ({ ...prev, antiRollBarRear: { value: val, kind: "agent" } }));
        updatedKey = "antiRollBarRear";
      }
    } else if (lower.includes("ride height")) {
      const val = lower.includes("+") ? "54 mm (+2mm)" : "50 mm (-2mm)";
      setStore((prev) => ({ ...prev, rearRideHeight: { value: val, kind: "agent" } }));
      updatedKey = "rearRideHeight";
    } else if (lower.includes("diff") || lower.includes("preload")) {
      setStore((prev) => ({ ...prev, differentialPreload: { value: "70 Nm (+15)", kind: "agent" } }));
      updatedKey = "differentialPreload";
    } else if (lower.includes("brake bias")) {
      setStore((prev) => ({ ...prev, frontBrakeBias: { value: "54.8% (-1.6%)", kind: "agent" } }));
      updatedKey = "frontBrakeBias";
    } else if (lower.includes("wing")) {
      setStore((prev) => ({ ...prev, rearWingAngle: { value: "P8 (+1)", kind: "agent" } }));
      updatedKey = "rearWingAngle";
    }

    if (updatedKey) {
      setPulsingStoreKey(updatedKey);
      setTimeout(() => setPulsingStoreKey(null), 2500);
      setInspectorView("store");
      setIsInspectorOpen(true);
    } else {
      setActiveTab("setup");
    }
  };

  const handleSetupGenerated = (setup: any) => {
    setLastGeneratedSetup(setup);
    if (setup?.sections && Array.isArray(setup.sections)) {
      const updates: Record<string, { value: string | number; kind: "agent" }> = {};
      setup.sections.forEach((sec: any) => {
        (sec.items || []).forEach((item: any) => {
          const l = (item.label || "").toLowerCase();
          if (l.includes("front anti-roll") || l.includes("front arb")) updates.antiRollBarFront = { value: item.value, kind: "agent" };
          else if (l.includes("rear anti-roll") || l.includes("rear arb")) updates.antiRollBarRear = { value: item.value, kind: "agent" };
          else if (l.includes("brake bias")) updates.frontBrakeBias = { value: item.value, kind: "agent" };
          else if (l.includes("rear wing")) updates.rearWingAngle = { value: item.value, kind: "agent" };
          else if (l.includes("rear ride height")) updates.rearRideHeight = { value: item.value, kind: "agent" };
          else if (l.includes("differential preload") || l.includes("preload")) updates.differentialPreload = { value: item.value, kind: "agent" };
        });
      });

      if (Object.keys(updates).length > 0) {
        setStore((prev) => ({ ...prev, ...updates }));
        const firstKey = Object.keys(updates)[0];
        setPulsingStoreKey(firstKey);
        setTimeout(() => setPulsingStoreKey(null), 2500);
      }
    }

    setCopilotNotes((prev) => [
      ...prev,
      {
        role: "engineer",
        text: `Calibrated baseline setup for ${setup.car || sessionCar} @ ${setup.track || sessionTrack}. Vehicle store calibrated.`,
        action: "Review garage matrix before installing on car.",
      },
    ]);
  };

  const filteredStints = stints.filter(
    (s) =>
      s.title.toLowerCase().includes(stintSearch.toLowerCase()) ||
      s.car.toLowerCase().includes(stintSearch.toLowerCase()) ||
      s.track.toLowerCase().includes(stintSearch.toLowerCase())
  );

  const pal: AgentConsolePalette = THEMES[theme] ?? THEMES.apex;
  const vars = {
    "--act-h": "100svh",
    "--act-minh": "560px",
    "--act-surface": pal.surface,
    "--act-raised": pal.raised,
    "--act-sunk": pal.sunk,
    "--act-node": pal.node,
    "--act-ink": pal.ink,
    "--act-muted": pal.muted,
    "--act-faint": pal.faint,
    "--act-rule": pal.rule,
    "--act-warn": pal.warn,
    "--act-ok": pal.ok,
    "--act-crew": pal.crew,
    "--act-crew-fill": pal.crewFill,
  } as React.CSSProperties;

  return (
    <div
      className={`act-root act-ready ${isSidebarOpen ? "act-sb-on" : ""} ${isInspectorOpen ? "act-pn-on" : ""}`}
      style={vars}
    >
      <style>{`
        ${ACT_CSS}
        @keyframes act-pulse-param {
          0%, 100% {
            outline: 2px solid var(--act-ok);
            box-shadow: 0 0 0 2px var(--act-ok);
          }
          50% {
            outline: 2px solid var(--act-warn);
            box-shadow: 0 0 12px 2px color-mix(in srgb, var(--act-ok) 60%, transparent);
          }
        }
        .act-param-pulsing {
          animation: act-pulse-param 1.2s ease-in-out infinite !important;
          background: color-mix(in srgb, var(--act-ok) 18%, var(--act-raised)) !important;
          position: relative;
          z-index: 2;
        }
      `}</style>
      {/* =========================================================================
          TOP TITLE BAR
          ========================================================================= */}
      <header className="act-bar" style={{ borderBottom: "1px solid var(--act-rule)" }}>
        {/* Sidebar Toggle */}
        <button
          type="button"
          className="act-iconbtn"
          aria-label={isSidebarOpen ? "Collapse Stints" : "Expand Stints"}
          title="Toggle Stints Sidebar (⌘B)"
          onClick={() => setIsSidebarOpen((prev) => !prev)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>

        {/* Brand & Active Car/Track Lockup */}
        <div className="act-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 19L11 5L15 12L21 19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11" cy="5" r="2" fill="var(--act-warn, #d97706)" />
            <circle cx="21" cy="19" r="1.5" fill="var(--act-ok, #10b981)" />
          </svg>
          <b style={{ letterSpacing: "0.12em" }}>APEXWALL</b>
          <i>/</i>
          <span style={{ color: "var(--act-ink)", fontWeight: 700 }}>
            {sessionCar} <span style={{ opacity: 0.5 }}>•</span> {sessionTrack.split(" ")[0]}
          </span>
        </div>

        {/* Center Workspace Mode Switcher */}
        <div className="act-bar-center" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "telemetry"}
            data-active={activeTab === "telemetry"}
            className="act-pill-btn"
            onClick={() => setActiveTab("telemetry")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
            <span>Telemetry</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "setup"}
            data-active={activeTab === "setup"}
            className="act-pill-btn"
            onClick={() => setActiveTab("setup")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
            <span>Garage Matrix</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "strategy"}
            data-active={activeTab === "strategy"}
            className="act-pill-btn"
            onClick={() => setActiveTab("strategy")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Pit Strategy</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "live"}
            data-active={activeTab === "live"}
            className="act-pill-btn"
            onClick={() => setActiveTab("live")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"></path>
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"></path>
              <circle cx="12" cy="12" r="2"></circle>
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"></path>
              <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"></path>
            </svg>
            <span>Live HUD</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "engineer"}
            data-active={activeTab === "engineer"}
            className="act-pill-btn"
            onClick={() => setActiveTab("engineer")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
              <line x1="6" y1="6" x2="6.01" y2="6"></line>
              <line x1="6" y1="18" x2="6.01" y2="18"></line>
            </svg>
            <span>Chief Engineer</span>
          </button>
        </div>

        <div className="act-grow" />

        {/* Right Action Buttons */}
        <div className="act-bar-right">
          {/* External Rig DDU / HUD link */}
          <Link
            href="/dash"
            target="_blank"
            rel="noopener noreferrer"
            className="act-action-pill"
            title="Open Rig Cockpit DDU in a separate window or mobile screen"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
              <line x1="4" y1="22" x2="4" y2="15"></line>
            </svg>
            <span>Cockpit DDU ↗</span>
          </Link>

          {/* Bridge agent download link */}
          <Link
            href="/download"
            className="act-action-pill"
            title="Download Local UDP Hardware Bridge Agent"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Bridge Agent</span>
          </Link>

          <button
            type="button"
            className="act-action-pill"
            onClick={() => setIsVaultOpen(true)}
            title="Setup Vault & Diff Viewer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>Vault ({savedSetupsCount})</span>
          </button>

          <button
            type="button"
            className="act-action-pill"
            onClick={() => setIsAuthOpen(true)}
            title="Driver Profile & Telemetry Sync"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Driver</span>
          </button>

          {/* Inspector Toggle */}
          <button
            type="button"
            className="act-iconbtn act-panelbtn"
            aria-label="Toggle Race Engineer & Parameter Store"
            aria-pressed={isInspectorOpen}
            title="Toggle Engineer & Store (⌘\)"
            onClick={() => setIsInspectorOpen((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>

          {/* Settings / Theme Popover */}
          <button
            type="button"
            className="act-iconbtn act-tweakbtn"
            aria-label="Settings"
            aria-expanded={isSettingsOpen}
            title="Theme & Preferences"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line>
              <line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* Settings Dialog */}
      {isSettingsOpen && (
        <div
          className="act-pop"
          style={{ position: "fixed", top: "54px", right: "12px", zIndex: 90 }}
          role="dialog"
          aria-label="Console Settings"
        >
          <span className="act-cap">Palette & Theme</span>
          <div className="act-swatches">
            {(["apex", "night", "sage", "paper", "lilac"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className="act-sw"
                aria-pressed={theme === t}
                onClick={() => {
                  setTheme(t);
                  setIsSettingsOpen(false);
                }}
              >
                <i></i>
                {t}
              </button>
            ))}
          </div>
          <span className="act-cap" style={{ marginTop: "12px" }}>Keyboard Shortcuts</span>
          <div className="act-keys">
            <kbd>⌘B</kbd>
            <span>Toggle Stints Rail</span>
            <kbd>⌘\</kbd>
            <span>Toggle Engineer Inspector</span>
            <kbd>⌘K</kbd>
            <span>Search Stints</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          BODY (3-COLUMN WORKBENCH)
          ========================================================================= */}
      <div className="act-body" style={{ flex: 1, minHeight: 0 }}>
        {/* -----------------------------------------------------------------------
            LEFT RAIL: STINTS & TELEMETRY SESSIONS
            ----------------------------------------------------------------------- */}
        <aside className="act-side" aria-label="Stints & Telemetry Ingest">
          <div className="act-side-in">
            <div className="act-side-head">
              <span className="act-cap">Telemetry Stints</span>
              <button
                type="button"
                className="act-iconbtn"
                title="Add Stint / Upload Telemetry"
                onClick={() => {
                  const title = prompt("New Stint / Session Title:", "Stint " + (stints.length + 1));
                  if (title) {
                    const newS: StintSession = {
                      id: "stint-" + Date.now(),
                      title,
                      car: sessionCar,
                      track: sessionTrack,
                      lapTime: "--:--.---",
                      tag: "Baseline Run",
                    };
                    setStints([newS, ...stints]);
                    setActiveStintId(newS.id);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>

            {/* Stint Search */}
            <div className="act-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="search"
                value={stintSearch}
                placeholder="Search stints (⌘K)"
                onChange={(e) => setStintSearch(e.target.value)}
              />
            </div>

            {/* Drag & Drop Telemetry Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileIngest(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                margin: "4px 12px 10px",
                padding: "10px",
                borderRadius: "8px",
                border: isDragging ? "1.5px dashed var(--act-ink)" : "1px dashed var(--act-rule)",
                background: isDragging
                  ? "color-mix(in srgb, var(--act-raised) 90%, white 5%)"
                  : "color-mix(in srgb, var(--act-sunk) 40%, transparent)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Drag & drop MoTeC CSV, iRacing, or ACC telemetry export"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ld,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileIngest(e.target.files[0]);
                    e.target.value = "";
                  }
                }}
                style={{ display: "none" }}
              />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--act-faint)" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span style={{ fontSize: "11px", fontFamily: "var(--act-mono)", color: "var(--act-ink)", fontWeight: 600 }}>
                {isDragging ? "Drop Telemetry Lap" : "+ Ingest MoTeC / CSV"}
              </span>
              <span style={{ fontSize: "10px", color: "var(--act-faint)" }}>
                Drop .csv or click to browse
              </span>
            </div>

            {/* Stint List */}
            <ul className="act-sessions" style={{ flex: 1 }}>
              {filteredStints.map((s) => {
                const isActive = s.id === activeStintId;
                return (
                  <li key={s.id} className={`act-sess ${isActive ? "act-sess-on" : ""}`}>
                    <button
                      type="button"
                      className="act-sess-btn"
                      onClick={() => handleSelectStint(s)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span className="act-sess-title" style={{ fontWeight: isActive ? 800 : 600 }}>{s.title}</span>
                        <span style={{ fontFamily: "var(--act-mono)", fontSize: "11px", color: "var(--act-ink)" }}>
                          {s.lapTime}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                        <span className="act-chip" style={{ fontSize: "10px" }}>{s.tag}</span>
                        <span style={{ fontSize: "11px", color: "var(--act-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.car.split(" ")[0]}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Pitwall Engineering Crew Badge */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--act-rule)", background: "color-mix(in srgb, var(--act-sunk) 40%, transparent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--act-ok)" }}></span>
                <span className="act-cap" style={{ color: "var(--act-ink)" }}>Pitwall Live</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--act-muted)", lineHeight: 1.4 }}>
                Chief Engineer & Aerodynamicist active. MoTeC telemetry bridge standing by.
              </p>
            </div>
          </div>
        </aside>

        {/* -----------------------------------------------------------------------
            CENTER MAIN STAGE: THE WORKBENCH
            ----------------------------------------------------------------------- */}
        <main className="act-main" style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
          <div className="act-custom-workspace" style={{ padding: "14px 18px" }}>
            {activeTab === "telemetry" && (
              <TelemetryAnalyzer
                initialParsedTelemetry={lastTelemetryFile}
                onLoadingChange={() => {}}
                onApplyToSetup={handleApplyToSetup}
                onTelemetryAnalyzed={(res, file) => {
                  setLastTelemetryResult(res);
                  setLastTelemetryFile(file);
                  if (res.lapComparison?.driverLapTime) {
                    setStore((prev) => ({
                      ...prev,
                      telemetryLapTime: { value: res.lapComparison.driverLapTime, kind: "observed" },
                    }));
                  }
                }}
                onDiscussWithEngineer={() => {
                  setIsInspectorOpen(true);
                  setInspectorView("engineer");
                }}
                onSessionChange={(s) => {
                  if (s.car) setSessionCar(s.car);
                  if (s.track) setSessionTrack(s.track);
                  if (s.game) setSessionGame(s.game);
                }}
              />
            )}

            {activeTab === "setup" && (
              <SetupGenerator
                initialValues={setupInitialValues}
                telemetryContext={
                  setupInitialValues?.telemetryContext ||
                  (lastTelemetryFile
                    ? {
                        hasTelemetry: true,
                        trailBrakingScore: lastTelemetryFile.trailBrakingScore,
                        throttleSmoothness: lastTelemetryFile.throttleSmoothness,
                        steeringScrub: lastTelemetryFile.steeringScrub,
                        maxLatG: lastTelemetryFile.maxLatG,
                        maxDecelG: lastTelemetryFile.maxDecelG,
                        topSpeed: lastTelemetryFile.topSpeed,
                        minSpeed: lastTelemetryFile.minSpeed,
                        lapTime: lastTelemetryFile.lapTime,
                        tyres: lastTelemetryFile.tyreStats,
                        phaseBalance: lastTelemetryFile.phaseBalance,
                        tyreOptimization: lastTelemetryFile.tyreOptimization,
                        driverVsCar: lastTelemetryFile.driverVsCar,
                        gripUtilization: lastTelemetryResult?.frictionCircle?.gripUtilizationPct,
                      }
                    : undefined)
                }
                baselineSetup={lastGeneratedSetup ? { sections: lastGeneratedSetup.sections } : undefined}
                onLoadingChange={() => {}}
                onSetupGenerated={handleSetupGenerated}
                onDiscussWithEngineer={() => {
                  setIsInspectorOpen(true);
                  setInspectorView("engineer");
                }}
                onSessionChange={(s) => {
                  if (s.car) setSessionCar(s.car);
                  if (s.track) setSessionTrack(s.track);
                  if (s.game) setSessionGame(s.game);
                }}
              />
            )}

            {activeTab === "strategy" && (
              <StrategyTools
                onApplyPressuresToSetup={handleApplyPressures}
                onApplyFuelToSetup={handleApplyFuel}
                activeCar={sessionCar || setupInitialValues?.car}
                activeTrack={sessionTrack || setupInitialValues?.track}
              />
            )}

            {activeTab === "live" && <LiveTelemetryHUD />}

            {activeTab === "engineer" && (
              <div style={{ height: "calc(100svh - 90px)" }}>
                <RaceEngineerChat
                  currentSetup={lastGeneratedSetup}
                  telemetryResult={lastTelemetryResult}
                  parsedTelemetry={lastTelemetryFile}
                  activeCar={sessionCar || setupInitialValues?.car}
                  activeTrack={sessionTrack || setupInitialValues?.track}
                  onApplyAdjustmentToSetup={(advice) => handleApplyAdviceToSetup(advice)}
                  onSwitchToSetup={() => setActiveTab("setup")}
                />
              </div>
            )}
          </div>
        </main>

        {/* -----------------------------------------------------------------------
            RIGHT RAIL: RACE ENGINEER COPILOT & PARAMETER STORE
            ----------------------------------------------------------------------- */}
        <aside className="act-panel" aria-label="Race Engineer & Parameter Store">
          <div className="act-panel-in" style={{ padding: 0 }}>
            {/* Inspector Header & Sub-Tabs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: "1px solid var(--act-rule)",
                background: "var(--act-raised)",
              }}
            >
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className={`act-pill-btn ${inspectorView === "engineer" ? "act-sess-on" : ""}`}
                  data-active={inspectorView === "engineer"}
                  onClick={() => setInspectorView("engineer")}
                >
                  <span>AI Engineer</span>
                </button>
                <button
                  type="button"
                  className={`act-pill-btn ${inspectorView === "store" ? "act-sess-on" : ""}`}
                  data-active={inspectorView === "store"}
                  onClick={() => setInspectorView("store")}
                >
                  <span>Live Store</span>
                </button>
              </div>

              <button
                type="button"
                className="act-iconbtn"
                aria-label="Close Inspector"
                title="Collapse Panel (⌘\)"
                onClick={() => setIsInspectorOpen(false)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* TAB 1: AI ENGINEER COPILOT */}
            {inspectorView === "engineer" && (
              <div style={{ display: "flex", flexDirection: "column", height: "calc(100% - 45px)" }}>
                {/* Dialogue Feed */}
                <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                  {copilotNotes.map((note, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: "12px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        background: note.role === "driver" ? "var(--act-sunk)" : "var(--act-raised)",
                        border: "1px solid var(--act-rule)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span className="act-cap" style={{ color: note.role === "driver" ? "var(--act-ink)" : "var(--act-warn)" }}>
                          {note.role === "driver" ? "Driver Feedback" : "Chief Race Engineer"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.5, color: "var(--act-ink)" }}>
                        {note.text}
                      </p>
                      {note.action && (
                        <div
                          style={{
                            marginTop: "8px",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: "color-mix(in srgb, var(--act-ok) 12%, transparent)",
                            border: "1px solid color-mix(in srgb, var(--act-ok) 30%, transparent)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: "11px", fontFamily: "var(--act-mono)", color: "var(--act-ok)" }}>
                            {note.action}
                          </span>
                          <button
                            type="button"
                            className="act-link"
                            style={{ fontSize: "11px", color: "var(--act-ink)", marginLeft: "8px", flexShrink: 0 }}
                            onClick={() => handleApplyAdviceToSetup(note.action!)}
                          >
                            Apply →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick Symptom Chips */}
                <div style={{ padding: "8px 12px", borderTop: "1px solid var(--act-rule)", background: "var(--act-raised)" }}>
                  <span className="act-cap" style={{ display: "block", marginBottom: "6px" }}>Quick Diagnostics</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {[
                      "Snap oversteer at apex",
                      "Entry understeer",
                      "Braking lockup into T1",
                      "Tyre pressure overheating",
                    ].map((symptom) => (
                      <button
                        key={symptom}
                        type="button"
                        className="act-chip"
                        style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                        onClick={() => handleAskCopilot(symptom)}
                      >
                        {symptom}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Copilot Input */}
                <div style={{ padding: "10px 12px", borderTop: "1px solid var(--act-rule)", background: "var(--act-surface)" }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAskCopilot();
                    }}
                    style={{ display: "flex", gap: "6px" }}
                  >
                    <input
                      type="text"
                      value={copilotQuestion}
                      placeholder="Ask race engineer..."
                      onChange={(e) => setCopilotQuestion(e.target.value)}
                      style={{
                        flex: 1,
                        background: "var(--act-sunk)",
                        border: "1px solid var(--act-rule)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        color: "var(--act-ink)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      className="act-iconbtn"
                      style={{ background: "var(--act-ink)", color: "var(--act-surface)" }}
                      disabled={!copilotQuestion.trim()}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE PARAMETER STORE */}
            {inspectorView === "store" && (
              <div style={{ padding: "12px 14px", overflowY: "auto", height: "calc(100% - 45px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                  <span className="act-cap">Live Vehicle Store</span>
                  <span className="act-cap act-faintc">Double-click to edit</span>
                </div>

                {/* Categorized Store Rows */}
                {(["observed", "set", "agent"] as const).map((kind) => {
                  const filtered = Object.entries(store).filter(([_, item]) => item.kind === kind);
                  const title = kind === "observed" ? "Telemetry Observed" : kind === "set" ? "Session & Car Spec" : "Calibrated Setup (Agent)";
                  const titleColor = kind === "agent" ? "var(--act-ok)" : kind === "observed" ? "var(--act-warn)" : "var(--act-faint)";

                  return (
                    <div key={kind} style={{ marginBottom: "16px" }}>
                      <span className="act-cap" style={{ color: titleColor, marginBottom: "6px", display: "block" }}>
                        {title} ({filtered.length})
                      </span>
                      <ul style={{ border: "1px solid var(--act-rule)", borderRadius: "8px", overflow: "hidden" }}>
                        {filtered.map(([key, item]) => {
                          const isEditing = editingStoreKey === key;
                          const isPulsing = pulsingStoreKey === key;
                          return (
                            <li
                              key={key}
                              className={isPulsing ? "act-param-pulsing" : ""}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "6px 10px",
                                borderBottom: "1px solid var(--act-rule)",
                                background: isEditing ? "var(--act-sunk)" : "var(--act-raised)",
                                fontSize: "12px",
                                transition: "all 0.2s ease",
                              }}
                            >
                              <code className="act-chip" style={{ fontSize: "11px" }}>{key}</code>
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editStoreVal}
                                  onChange={(e) => setEditStoreVal(e.target.value)}
                                  onBlur={() => {
                                    if (editStoreVal.trim()) {
                                      setStore((prev) => ({
                                        ...prev,
                                        [key]: { ...prev[key], value: editStoreVal.trim() },
                                      }));
                                    }
                                    setEditingStoreKey(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (editStoreVal.trim()) {
                                        setStore((prev) => ({
                                          ...prev,
                                          [key]: { ...prev[key], value: editStoreVal.trim() },
                                        }));
                                      }
                                      setEditingStoreKey(null);
                                    } else if (e.key === "Escape") {
                                      setEditingStoreKey(null);
                                    }
                                  }}
                                  style={{
                                    maxWidth: "140px",
                                    padding: "2px 6px",
                                    fontSize: "11px",
                                    fontFamily: "var(--act-mono)",
                                    background: "var(--act-surface)",
                                    border: "1px solid var(--act-ink)",
                                    borderRadius: "4px",
                                    color: "var(--act-ink)",
                                  }}
                                />
                              ) : (
                                <span
                                  onDoubleClick={() => {
                                    setEditingStoreKey(key);
                                    setEditStoreVal(String(item.value));
                                  }}
                                  title="Double-click to edit parameter"
                                  style={{
                                    fontFamily: "var(--act-mono)",
                                    color: "var(--act-ink)",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                  }}
                                >
                                  {String(item.value)}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* =========================================================================
          MODALS
          ========================================================================= */}
      <SetupVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onLoadSetup={handleLoadFromVault}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
};
