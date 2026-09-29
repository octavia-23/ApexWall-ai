"use client";

import React, { useState, useEffect } from "react";
import { GeneratedSetupResult } from "@/types/telemetry";
import { SetupExportModal } from "./SetupExportModal";
import { SetupMorphModal } from "./SetupMorphModal";
import { saveSetupToVault } from "@/lib/setup-vault";
import { ACModIngestor } from "./ACModIngestor";
import { AssettoCorsaModData } from "@/lib/ac-mod-parser";

interface SetupGeneratorProps {
  initialValues?: {
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
  };
  onLoadingChange: (loading: boolean) => void;
  onSetupGenerated?: (setup: any) => void;
  onDiscussWithEngineer?: () => void;
}

const loadingMessages = [
  "Warming tyres…",
  "Reading track temp…",
  "Balancing the diff…",
  "Dialing in the aero…",
  "Checking the radio…",
  "Printing setup sheet…",
];

export const SetupGenerator: React.FC<SetupGeneratorProps> = ({
  initialValues,
  onLoadingChange,
  onSetupGenerated,
  onDiscussWithEngineer,
}) => {
  const [game, setGame] = useState("Assetto Corsa Competizione");
  const [car, setCar] = useState("Ferrari 296 GT3");
  const [track, setTrack] = useState("Spa-Francorchamps GP");
  const [sessionType, setSessionType] = useState("Practice");
  const [weather, setWeather] = useState("Dry");
  const [trackTemp, setTrackTemp] = useState("32°C");
  const [airTemp, setAirTemp] = useState("24°C");
  const [fuelLoad, setFuelLoad] = useState("45 L, 35 laps");
  const [tyreCompound, setTyreCompound] = useState("Medium Slick");
  const [skillLevel, setSkillLevel] = useState("Intermediate");
  const [driverStyle, setDriverStyle] = useState("Heavy trail-braker, relies on throttle-steering");
  const [handlingIssue, setHandlingIssue] = useState("Snap oversteer on corner exit under power, mid-corner understeer in slow chicanes");
  const [acModData, setAcModData] = useState<AssettoCorsaModData | null>(null);

  const handleModParsed = (mod: AssettoCorsaModData) => {
    setAcModData(mod);
    setGame("Assetto Corsa");
    if (mod.name) setCar(mod.name);
    if (mod.fuelTankCapacity) setFuelLoad(`${Math.round(mod.fuelTankCapacity * 0.7)} L`);
  };

  const handleClearMod = () => {
    setAcModData(null);
  };

  const [state, setState] = useState<"empty" | "loading" | "error" | "result">("empty");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<GeneratedSetupResult | null>(null);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [savedToVault, setSavedToVault] = useState(false);
  const [isMorphModalOpen, setIsMorphModalOpen] = useState(false);

  // Sync initial values when transferred from Telemetry Analyzer
  useEffect(() => {
    if (initialValues) {
      if (initialValues.game) setGame(initialValues.game);
      if (initialValues.car) setCar(initialValues.car);
      if (initialValues.track) setTrack(initialValues.track);
      if (initialValues.sessionType) setSessionType(initialValues.sessionType);
      if (initialValues.weather) setWeather(initialValues.weather);
      if (initialValues.trackTemp) setTrackTemp(initialValues.trackTemp);
      if (initialValues.airTemp) setAirTemp(initialValues.airTemp);
      if (initialValues.tyreCompound) setTyreCompound(initialValues.tyreCompound);
      if (initialValues.fuelLoad) setFuelLoad(initialValues.fuelLoad);
      if (initialValues.handlingIssue) setHandlingIssue(initialValues.handlingIssue);
      if (initialValues.driverStyle) setDriverStyle(initialValues.driverStyle);
    }
  }, [initialValues]);

  useEffect(() => {
    if (state !== "loading") return;
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    onLoadingChange(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/generate-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game,
          car,
          track,
          sessionType,
          weather,
          trackTemp,
          airTemp,
          fuelLoad,
          tyreCompound,
          driverStyle,
          handlingIssue,
          skillLevel,
          customModProfile: acModData,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate setup.");
      }

      setResult(data);
      setState("result");
      onSetupGenerated?.({
        game,
        car,
        track,
        sessionType,
        weather,
        trackTemp,
        airTemp,
        fuelLoad,
        tyreCompound,
        driverStyle,
        summary: data.summary,
        engineerNotes: data.engineerNotes,
        sections: data.sections || [],
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate setup.");
      setState("error");
    } finally {
      onLoadingChange(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    let text = `APEXWALL AI // ${car.toUpperCase()} @ ${track.toUpperCase()}\n`;
    text += `${"=".repeat(45)}\n\n`;
    if (result.summary) {
      text += `[ENGINEER PHILOSOPHY]\n${result.summary}\n\n`;
    }
    (result.sections || []).forEach((sec) => {
      text += `[${sec.title.toUpperCase()}]\n`;
      (sec.items || []).forEach((it) => {
        text += `  • ${it.label}: ${it.value}\n`;
      });
      text += `\n`;
    });
    if (result.engineerNotes) {
      text += `[TEAM RADIO / ENGINEER NOTES]\n${result.engineerNotes}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveToVault = () => {
    if (!result) return;
    saveSetupToVault({
      name: `${car} - ${track} (${sessionType})`,
      game,
      car,
      track,
      sessionType,
      weather,
      trackTemp,
      airTemp,
      tyreCompound,
      fuelLoad,
      driverStyle,
      summary: result.summary,
      engineerNotes: result.engineerNotes,
      sections: result.sections || [],
    });
    setSavedToVault(true);
    setTimeout(() => setSavedToVault(false), 2500);
  };

  const handleReset = () => {
    setState("empty");
    setResult(null);
  };

  return (
    <div className="layout">
      {/* FORM PANEL (INPUT BRIEF) */}
      <section className="panel form-panel glass-card">
        <div className="panel-header">
          <div className="panel-tag-group">
            <span className="panel-num">01</span>
            <div className="panel-label-group">
              <span className="panel-label">SESSION BRIEF</span>
              <span className="panel-sublabel">CHASSIS SPEC & CIRCUIT ENVIRONMENT</span>
            </div>
          </div>
          <div className="panel-telemetry-badge">
            <span className="badge-dot"></span> BASELINE BUILDER
          </div>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Section 1: Vehicle & Circuit */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 17h14M4 14l2-6h12l2 6M6 17a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            01 // PLATFORM & VEHICLE SPEC
          </div>

          <div className="field">
            <label htmlFor="game">
              <span>Sim title</span>
              <span className="field-hint">Physics simulation platform</span>
            </label>
            <div className="select-wrapper">
              <select id="game" value={game} onChange={(e) => setGame(e.target.value)} required>
                <option value="" disabled>Select simulator title</option>
                <option>Assetto Corsa Competizione</option>
                <option>iRacing</option>
                <option>Assetto Corsa</option>
                <option>rFactor 2</option>
                <option>Automobilista 2</option>
                <option>Le Mans Ultimate</option>
                <option>F1 24</option>
                <option>F1 25</option>
                <option>Gran Turismo 7</option>
                <option>RaceRoom Racing Experience</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          {/* Assetto Corsa Custom Mod Ingestor */}
          <ACModIngestor
            onModParsed={handleModParsed}
            onClearMod={handleClearMod}
            currentMod={acModData}
          />

          <div className="field-row">
            <div className="field">
              <label htmlFor="car">
                <span>Car / Class</span>
                <span className="field-hint">Vehicle model</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="car"
                  type="text"
                  value={car}
                  onChange={(e) => setCar(e.target.value)}
                  placeholder="e.g. Ferrari 296 GT3"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="track">
                <span>Track / Layout</span>
                <span className="field-hint">Circuit configuration</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="track"
                  type="text"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  placeholder="e.g. Spa-Francorchamps GP"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Session & Track Conditions */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            02 // METEOROLOGY & TRACK STATE
          </div>

          <div className="field">
            <label>
              <span>Session profile</span>
              <span className="field-hint">Fuel / run target</span>
            </label>
            <div className="segmented">
              {["Practice", "Qualifying", "Race"].map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`seg-btn ${sessionType === type ? "active" : ""}`}
                  onClick={() => setSessionType(type)}
                >
                  <span className="seg-indicator"></span>{type}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              <span>Track condition</span>
              <span className="field-hint">Surface grip level</span>
            </label>
            <div className="segmented">
              {[
                { val: "Dry", cls: "dry" },
                { val: "Damp", cls: "damp" },
                { val: "Wet", cls: "wet" },
              ].map((w) => (
                <button
                  key={w.val}
                  type="button"
                  className={`seg-btn ${weather === w.val ? "active" : ""}`}
                  onClick={() => setWeather(w.val)}
                >
                  <span className={`weather-indicator ${w.cls}`}></span>{w.val}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="trackTemp">
                <span>Track temp</span>
                <span className="field-hint">Asphalt surface</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="trackTemp"
                  type="text"
                  value={trackTemp}
                  onChange={(e) => setTrackTemp(e.target.value)}
                  placeholder="e.g. 32°C"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="airTemp">
                <span>Air temp</span>
                <span className="field-hint">Ambient temperature</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="airTemp"
                  type="text"
                  value={airTemp}
                  onChange={(e) => setAirTemp(e.target.value)}
                  placeholder="e.g. 24°C"
                />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="fuelLoad">
                <span>Fuel load</span>
                <span className="field-hint">Initial volume / stint</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="fuelLoad"
                  type="text"
                  value={fuelLoad}
                  onChange={(e) => setFuelLoad(e.target.value)}
                  placeholder="e.g. 45 L, 35 laps"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="tyreCompound">
                <span>Tyre compound</span>
                <span className="field-hint">Selected rubber</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="tyreCompound"
                  type="text"
                  value={tyreCompound}
                  onChange={(e) => setTyreCompound(e.target.value)}
                  placeholder="e.g. Medium Slick"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Driver & Handling Feedback */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2" strokeLinecap="round" />
            </svg>
            03 // CHASSIS BALANCE & DRIVER FEEDBACK
          </div>

          <div className="field">
            <label>
              <span>Driver confidence margin</span>
              <span className="field-hint">Setup balance forgiveness</span>
            </label>
            <div className="segmented">
              {[
                { val: "Beginner", label: "Stable / Safe" },
                { val: "Intermediate", label: "Neutral Balance" },
                { val: "Pro / iRating high", label: "Aggressive / Loose" },
              ].map((lvl) => (
                <button
                  key={lvl.val}
                  type="button"
                  className={`seg-btn ${skillLevel === lvl.val ? "active" : ""}`}
                  onClick={() => setSkillLevel(lvl.val)}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="driverStyle">
              <span>Driving style preference</span>
              <span className="field-hint">Braking & rotation style</span>
            </label>
            <div className="input-wrapper">
              <input
                id="driverStyle"
                type="text"
                value={driverStyle}
                onChange={(e) => setDriverStyle(e.target.value)}
                placeholder="e.g. Heavy trail-braker, relies on throttle-steering, likes stable rear"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="handlingIssue">
              <span>Handling issue to diagnose & correct</span>
              <span className="field-hint">Specific chassis complaint</span>
            </label>
            <div className="textarea-wrapper">
              <textarea
                id="handlingIssue"
                rows={3}
                value={handlingIssue}
                onChange={(e) => setHandlingIssue(e.target.value)}
                placeholder="e.g. Snap oversteer on corner exit under power, mid-corner understeer in slow chicanes"
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <button type="submit" className="generate-btn" disabled={state === "loading"}>
            <span className="btn-sheen" aria-hidden="true"></span>
            <div className="btn-content">
              <span className="btn-spinner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
                </svg>
              </span>
              <span className="btn-label">Generate Setup Sheet</span>
              <span className="btn-flag" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </span>
            </div>
            <span className="btn-badge">AI CALIBRATED</span>
          </button>
        </form>
      </section>

      {/* OUTPUT PANEL (SETUP SHEET) */}
      <section className="panel output-panel glass-card">
        <div className="panel-header">
          <div className="panel-tag-group">
            <span className="panel-num">02</span>
            <div className="panel-label-group">
              <span className="panel-label">SETUP SHEET</span>
              <span className="panel-sublabel">CALIBRATED CHASSIS SPEC</span>
            </div>
          </div>
          {state === "result" && result && (
            <div className="sheet-actions">
              <button type="button" className="action-btn" onClick={handleCopy}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>{copied ? "COPIED ✓" : "COPY SPEC"}</span>
              </button>

              <button
                type="button"
                className={`action-btn ${savedToVault ? "saved" : ""}`}
                onClick={handleSaveToVault}
                title="Save this calibrated setup to your local Setup Vault"
                style={savedToVault ? { borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399", background: "rgba(16, 185, 129, 0.1)" } : {}}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>{savedToVault ? "SAVED TO VAULT ✓" : "SAVE TO VAULT"}</span>
              </button>

              <button
                type="button"
                className="action-btn flex items-center gap-1.5"
                onClick={() => setIsMorphModalOpen(true)}
                title="Adapt this setup to higher/lower track temp or wet weather"
              >
                <span className="text-amber-400 font-bold">⚡</span>
                <span>SETUP MORPH</span>
              </button>

              <SetupExportModal
                buttonLabel="INJECT / EXPORT SETUP"
                context={{
                  game,
                  car,
                  track,
                  sessionType,
                  weather,
                  trackTemp,
                  airTemp,
                  fuelLoad,
                  tyreCompound,
                  driverStyle,
                  summary: result.summary,
                  engineerNotes: result.engineerNotes,
                  sections: result.sections || [],
                }}
              />

              {isMorphModalOpen && (
                <SetupMorphModal
                  isOpen={isMorphModalOpen}
                  onClose={() => setIsMorphModalOpen(false)}
                  context={{
                    game,
                    car,
                    track,
                    sessionType,
                    weather,
                    trackTemp,
                    airTemp,
                    fuelLoad,
                    tyreCompound,
                    driverStyle,
                    summary: result.summary,
                    engineerNotes: result.engineerNotes,
                    sections: result.sections || [],
                  }}
                  onApplyMorphedSetup={(newSections, summaryNote) => {
                    setResult((prev) => prev ? {
                      ...prev,
                      sections: newSections,
                      summary: `${prev.summary}\n\n[DYNAMIC WEATHER MORPH]: ${summaryNote}`,
                    } : null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* State: Empty Standby */}
        {state === "empty" && (
          <div className="empty-state">
            <div className="chassis-schematic" aria-hidden="true">
              <svg viewBox="0 0 240 160" fill="none" stroke="currentColor" className="w-full h-auto text-slate-600">
                <line x1="120" y1="10" x2="120" y2="150" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="220" y2="80" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                <path d="M100 25 L140 25 L160 45 L170 85 L160 135 L80 135 L70 85 L80 45 Z" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" fill="rgba(255,255,255,0.02)" />
                <circle cx="120" cy="80" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <rect x="42" y="30" width="14" height="28" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
                <rect x="184" y="30" width="14" height="28" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
                <rect x="42" y="102" width="14" height="28" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
                <rect x="184" y="102" width="14" height="28" rx="2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
              </svg>
            </div>
            <div className="empty-text-wrap">
              <h3 className="empty-title">CHASSIS SETUP ENGINE STANDBY</h3>
              <p className="empty-description">
                Configure your car, circuit, and handling issues on the left.<br />
                The race engineer will compute calibrated damper curves, camber, aerodynamic balance, and gear ratios.
              </p>
            </div>
          </div>
        )}

        {/* State: Loading */}
        {state === "loading" && (
          <div className="loading-state">
            <div className="loading-visual">
              <div className="loading-pulse-ring" aria-hidden="true"></div>
              <div className="loading-data-wrap">
                <div className="loading-status-badge">COMPUTING SETUP SPECIFICATION</div>
                <p className="loading-text">{loadingMessages[loadingTextIndex]}</p>
                <div className="loading-sub">Calibrating chassis telemetry and mechanical balance</div>
              </div>
            </div>
          </div>
        )}

        {/* State: Error */}
        {state === "error" && (
          <div className="error-state">
            ⚠ {errorMessage}
          </div>
        )}

        {/* State: Result */}
        {state === "result" && result && (
          <div className="result-state">
            <div className="result-summary-card">
              <div className="summary-header">
                <div className="summary-header-left">
                  <span className="summary-icon">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="summary-title">ENGINEERING PHILOSOPHY // BASELINE OBJECTIVE</span>
                </div>
                <span className="summary-verified">TELEMETRY VERIFIED</span>
              </div>
              <div className="result-summary">{result.summary}</div>
            </div>

            <div className="result-sections">
              {(result.sections || []).map((sec, i) => (
                <div key={i} className="setup-section">
                  <div className="setup-section-title">
                    <span>{sec.title}</span>
                    <span className="section-count">
                      {sec.items?.length || 0} {sec.items?.length === 1 ? "PARAM" : "PARAMS"}
                    </span>
                  </div>
                  {(sec.items || []).map((item, j) => (
                    <div key={j} className="setup-item">
                      <span className="label">{item.label}</span>
                      <span className="value">{item.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="result-notes">
              <div className="notes-header">
                <div className="radio-signal">
                  <span className="radio-bar"></span>
                  <span className="radio-bar"></span>
                  <span className="radio-bar"></span>
                  <span className="radio-pulse"></span>
                </div>
                <div className="notes-label">TEAM RADIO // RACE ENGINEER BRIEFING</div>
                <div className="notes-channel">PIT WALL CH 1 · SECURE</div>
              </div>
              <div className="notes-body">
                <p>{result.engineerNotes}</p>
              </div>
            </div>

            <div className="result-footer-actions flex items-center justify-between">
              <button type="button" className="reset-btn" onClick={handleReset}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
                <span>Build another setup</span>
              </button>

              {onDiscussWithEngineer && (
                <button
                  type="button"
                  onClick={onDiscussWithEngineer}
                  className="action-btn flex items-center gap-1.5 border-cyan-500/40 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
                  title="Discuss this setup with your AI Chief Race Engineer"
                >
                  <span>🎙️ Discuss with Race Engineer →</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
