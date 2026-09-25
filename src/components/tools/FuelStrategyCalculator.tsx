"use client";

import React, { useState, useMemo } from "react";
import {
  calculateFuelStrategy,
  FuelCalculationResult,
  formatLapTime,
} from "@/lib/fuel-calculator";

interface FuelStrategyCalculatorProps {
  initialLapTime?: number; // in seconds
  onApplyFuelLoad?: (liters: number) => void;
}

export const FuelStrategyCalculator: React.FC<FuelStrategyCalculatorProps> = ({
  initialLapTime = 137.482,
  onApplyFuelLoad,
}) => {
  const [raceFormat, setRaceFormat] = useState<"time" | "laps">("time");
  const [raceDurationMinutes, setRaceDurationMinutes] = useState<number>(45);
  const [raceTotalLaps, setRaceTotalLaps] = useState<number>(25);

  const [lapTimeMinutes, setLapTimeMinutes] = useState<number>(Math.floor(initialLapTime / 60));
  const [lapTimeSeconds, setLapTimeSeconds] = useState<number>(+(initialLapTime % 60).toFixed(2));

  const [fuelPerLap, setFuelPerLap] = useState<number>(3.35);
  const [tankCapacity, setTankCapacity] = useState<number>(120);
  const [hasFormationLap, setHasFormationLap] = useState<boolean>(true);
  const [safetyBufferLaps, setSafetyBufferLaps] = useState<number>(1.5);
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);

  const totalLapTimeSec = useMemo(() => {
    return lapTimeMinutes * 60 + lapTimeSeconds;
  }, [lapTimeMinutes, lapTimeSeconds]);

  const result: FuelCalculationResult = useMemo(() => {
    return calculateFuelStrategy({
      raceFormat,
      raceDurationMinutes,
      raceTotalLaps: raceFormat === "laps" ? raceTotalLaps : undefined,
      lapTimeSeconds: totalLapTimeSec,
      fuelPerLapLiters: fuelPerLap,
      tankCapacityLiters: tankCapacity,
      hasFormationLap,
      safetyBufferLaps,
    });
  }, [
    raceFormat,
    raceDurationMinutes,
    raceTotalLaps,
    totalLapTimeSec,
    fuelPerLap,
    tankCapacity,
    hasFormationLap,
    safetyBufferLaps,
  ]);

  const handleApply = () => {
    onApplyFuelLoad?.(result.initialFuelLoadLiters);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2500);
  };

  const handleQuickPreset = (mins: number, isSprint = false) => {
    setRaceFormat("time");
    setRaceDurationMinutes(mins);
    if (isSprint) {
      setSafetyBufferLaps(1.0);
    }
  };

  return (
    <div className="fuel-calc-card glass-card-nested">
      {/* Header */}
      <div className="calc-header">
        <div className="calc-title-group">
          <div className="calc-badge-row">
            <span className="calc-badge text-emerald">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                <path d="M7 2v20" />
                <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
              </svg>
              RACE FUEL & PIT WINDOW STRATEGY
            </span>
            <span className="calc-target-pill">
              STINT CAP: <strong>{result.maxLapsPerTank} LAPS</strong>
            </span>
          </div>
          <h3 className="calc-title">Precision Fuel Burn & Pit Window Planner</h3>
          <p className="calc-sub">
            Calculates exact fuel mass, stint ranges, mandatory pit stops, and lift-and-coast savings to undercut traffic.
          </p>
        </div>

        {/* Quick Race Presets */}
        <div className="quick-presets-strip">
          <button
            type="button"
            className="preset-pill-btn"
            onClick={() => handleQuickPreset(25, true)}
          >
            25m Sprint
          </button>
          <button
            type="button"
            className="preset-pill-btn"
            onClick={() => handleQuickPreset(45)}
          >
            45m Sprint (1-Stop)
          </button>
          <button
            type="button"
            className="preset-pill-btn"
            onClick={() => handleQuickPreset(60)}
          >
            60m Endurance
          </button>
          <button
            type="button"
            className="preset-pill-btn"
            onClick={() => handleQuickPreset(120)}
          >
            2h Enduro
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="calc-inputs-grid">
        <div className="calc-field">
          <label className="field-label">Race Format</label>
          <div className="segmented">
            <button
              type="button"
              className={`seg-btn ${raceFormat === "time" ? "active" : ""}`}
              onClick={() => setRaceFormat("time")}
            >
              Time Based
            </button>
            <button
              type="button"
              className={`seg-btn ${raceFormat === "laps" ? "active" : ""}`}
              onClick={() => setRaceFormat("laps")}
            >
              Lap Count
            </button>
          </div>
        </div>

        {raceFormat === "time" ? (
          <div className="calc-field">
            <label className="field-label">Race Duration (Minutes)</label>
            <input
              type="number"
              min="5"
              max="1440"
              value={raceDurationMinutes}
              onChange={(e) => setRaceDurationMinutes(parseInt(e.target.value, 10) || 45)}
              className="calc-input"
            />
          </div>
        ) : (
          <div className="calc-field">
            <label className="field-label">Total Race Laps</label>
            <input
              type="number"
              min="1"
              max="500"
              value={raceTotalLaps}
              onChange={(e) => setRaceTotalLaps(parseInt(e.target.value, 10) || 25)}
              className="calc-input"
            />
          </div>
        )}

        <div className="calc-field">
          <label className="field-label">Average Lap Pace (m:ss.s)</label>
          <div className="time-split-inputs">
            <div className="time-split-box">
              <input
                type="number"
                min="0"
                max="10"
                value={lapTimeMinutes}
                onChange={(e) => setLapTimeMinutes(parseInt(e.target.value, 10) || 0)}
                className="calc-input-compact"
              />
              <span className="unit-tag">min</span>
            </div>
            <span className="split-colon">:</span>
            <div className="time-split-box">
              <input
                type="number"
                min="0"
                max="59.99"
                step="0.1"
                value={lapTimeSeconds}
                onChange={(e) => setLapTimeSeconds(parseFloat(e.target.value) || 0)}
                className="calc-input-compact"
              />
              <span className="unit-tag">sec</span>
            </div>
          </div>
        </div>

        <div className="calc-field">
          <label className="field-label">Fuel Burn per Lap (Liters)</label>
          <input
            type="number"
            min="0.5"
            max="15"
            step="0.05"
            value={fuelPerLap}
            onChange={(e) => setFuelPerLap(parseFloat(e.target.value) || 3.0)}
            className="calc-input"
          />
        </div>

        <div className="calc-field">
          <label className="field-label">Max Tank Capacity (Liters)</label>
          <input
            type="number"
            min="20"
            max="150"
            value={tankCapacity}
            onChange={(e) => setTankCapacity(parseInt(e.target.value, 10) || 120)}
            className="calc-input"
          />
        </div>

        <div className="calc-field">
          <label className="field-label">Formation Lap & Safety Buffer</label>
          <div className="toggles-sub-row">
            <label className="checkbox-pill">
              <input
                type="checkbox"
                checked={hasFormationLap}
                onChange={(e) => setHasFormationLap(e.target.checked)}
              />
              <span>Formation Lap</span>
            </label>

            <select
              className="calc-select-compact"
              value={safetyBufferLaps}
              onChange={(e) => setSafetyBufferLaps(parseFloat(e.target.value))}
            >
              <option value="1.0">1.0 Lap Reserve</option>
              <option value="1.5">1.5 Laps Reserve</option>
              <option value="2.0">2.0 Laps Reserve</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Overview Tiles */}
      <div className="fuel-kpis-grid">
        <div className="fuel-kpi-card">
          <span className="kpi-label">TOTAL RACE LAPS</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-primary">{result.totalRaceLaps}</span>
            <span className="kpi-sub">laps</span>
          </div>
          <span className="kpi-footer-note">Est. time: {result.estimatedRaceDurationFormatted}</span>
        </div>

        <div className="fuel-kpi-card highlight-emerald">
          <span className="kpi-label">STARTING FUEL LOAD</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-emerald">{result.initialFuelLoadLiters}</span>
            <span className="kpi-sub">Liters</span>
          </div>
          <span className="kpi-footer-note">Fill for Stint 1 on Grid</span>
        </div>

        <div className="fuel-kpi-card">
          <span className="kpi-label">TOTAL FUEL REQUIRED</span>
          <div className="kpi-val-row">
            <span className="kpi-val text-sky">{result.totalFuelRequiredLiters}</span>
            <span className="kpi-sub">Liters</span>
          </div>
          <span className="kpi-footer-note">Includes {result.safetyMarginLiters}L safety buffer</span>
        </div>

        <div className="fuel-kpi-card">
          <span className="kpi-label">MANDATORY PIT STOPS</span>
          <div className="kpi-val-row">
            <span className={`kpi-val ${result.numberOfPitStops > 0 ? "text-amber" : "text-emerald"}`}>
              {result.numberOfPitStops}
            </span>
            <span className="kpi-sub">{result.numberOfPitStops === 1 ? "stop" : "stops"}</span>
          </div>
          <span className="kpi-footer-note">
            {result.numberOfPitStops === 0 ? "No stop required (Sprint)" : "Refuel required"}
          </span>
        </div>
      </div>

      {/* Pit Stop Strategy Windows Table */}
      {result.numberOfPitStops > 0 && (
        <div className="pit-strategy-box">
          <div className="strategy-box-title">
            <span>RECOMMENDED PIT STOP WINDOW SCHEDULE</span>
            <span className="hint-pill">Traffic & Undercut Windows</span>
          </div>
          <div className="pit-table-wrapper">
            <table className="pit-table">
              <thead>
                <tr>
                  <th>Stop</th>
                  <th>Window Open</th>
                  <th>Optimal Box Lap</th>
                  <th>Window Close</th>
                  <th>Fuel to Add</th>
                  <th>Strategic Advice</th>
                </tr>
              </thead>
              <tbody>
                {result.pitStops.map((stop) => (
                  <tr key={stop.stopNumber}>
                    <td className="stop-num">Stop #{stop.stopNumber}</td>
                    <td className="text-muted">Lap {stop.lapWindowStart}</td>
                    <td className="optimal-lap">
                      <span className="lap-pill">Lap {stop.recommendedLap}</span>
                    </td>
                    <td className="text-muted">Lap {stop.lapWindowEnd}</td>
                    <td className="fuel-add-val">+{stop.fuelToAddLiters} Liters</td>
                    <td className="strategy-note">
                      Box Lap {stop.recommendedLap} to minimize tyre degradation drop-off.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lift-and-Coast Fuel Saver & Strategic Advice */}
      <div className="fuel-strategy-footer">
        <div className="lift-coast-card">
          <div className="lift-coast-header">
            <span className="eco-dot"></span>
            <span className="eco-title">RACE ENGINEER LIFT-AND-COAST TACTICAL VERDICT</span>
          </div>
          <p className="eco-advice">{result.liftAndCoast.advice}</p>
        </div>

        {onApplyFuelLoad && (
          <button
            type="button"
            className={`calc-apply-btn ${appliedFeedback ? "applied" : ""}`}
            onClick={handleApply}
          >
            {appliedFeedback ? "✓ Fuel Load Applied to Setup" : `Apply ${result.initialFuelLoadLiters}L to Setup →`}
          </button>
        )}
      </div>
    </div>
  );
};
