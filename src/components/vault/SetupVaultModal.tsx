"use client";

import React, { useState, useEffect } from "react";
import {
  SavedSetupRecord,
  getSavedSetups,
  saveSetupToVault,
  deleteSetupFromVault,
  compareSetupRecords,
  SetupDiffResult,
} from "@/lib/setup-vault";
import { SetupExportModal } from "../setup/SetupExportModal";
import { SetupSection } from "@/types/telemetry";

interface SetupVaultModalProps {
  currentSetupToSave?: {
    game: string;
    car: string;
    track: string;
    sessionType?: string;
    weather?: string;
    trackTemp?: string;
    airTemp?: string;
    tyreCompound?: string;
    fuelLoad?: string;
    lapTime?: string;
    driverStyle?: string;
    summary?: string;
    engineerNotes?: string;
    sections: SetupSection[];
  };
  onLoadSetup?: (setup: SavedSetupRecord) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SetupVaultModal: React.FC<SetupVaultModalProps> = ({
  currentSetupToSave,
  onLoadSetup,
  isOpen,
  onClose,
}) => {
  const [setups, setSetups] = useState<SavedSetupRecord[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "diff">("list");
  const [selectedIdA, setSelectedIdA] = useState<string>("");
  const [selectedIdB, setSelectedIdB] = useState<string>("");
  const [diffOnly, setDiffOnly] = useState<boolean>(true);

  // New setup name input when saving current
  const [customName, setCustomName] = useState<string>("");
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const all = getSavedSetups();
      setSetups(all);
      if (all.length >= 2) {
        setSelectedIdA(all[0].id);
        setSelectedIdB(all[1].id);
      } else if (all.length === 1) {
        setSelectedIdA(all[0].id);
      }
      if (currentSetupToSave) {
        setCustomName(`${currentSetupToSave.track} — ${currentSetupToSave.car} (v${all.length + 1})`);
      }
    }
  }, [isOpen, currentSetupToSave]);

  if (!isOpen) return null;

  const handleSaveCurrent = () => {
    if (!currentSetupToSave) return;
    const record = saveSetupToVault({
      name: customName || `${currentSetupToSave.track} Setup`,
      game: currentSetupToSave.game,
      car: currentSetupToSave.car,
      track: currentSetupToSave.track,
      sessionType: currentSetupToSave.sessionType,
      weather: currentSetupToSave.weather,
      trackTemp: currentSetupToSave.trackTemp,
      airTemp: currentSetupToSave.airTemp,
      lapTime: currentSetupToSave.lapTime,
      driverStyle: currentSetupToSave.driverStyle,
      summary: currentSetupToSave.summary,
      engineerNotes: currentSetupToSave.engineerNotes,
      sections: currentSetupToSave.sections,
    });
    setSetups(getSavedSetups());
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2500);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this setup from your vault?")) {
      const updated = deleteSetupFromVault(id);
      setSetups(updated);
    }
  };

  // Compare diff calculation
  const setupA = setups.find((s) => s.id === selectedIdA);
  const setupB = setups.find((s) => s.id === selectedIdB);
  const diffResult: SetupDiffResult | null =
    setupA && setupB && setupA.id !== setupB.id ? compareSetupRecords(setupA, setupB) : null;

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="vault-modal-header">
          <div className="vault-header-title">
            <div className="vault-badge-row">
              <span className="vault-badge">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
                  <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
                  <path d="M4 12h16" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                CHASSIS SETUP VAULT & VERSION CONTROL
              </span>
              <span className="vault-count-pill">{setups.length} SETUPS SAVED</span>
            </div>
            <h2 className="vault-title">Setup Iteration Manager & Parameter Diff</h2>
          </div>

          <div className="vault-header-actions">
            <div className="segmented">
              <button
                type="button"
                className={`seg-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                Vault List
              </button>
              <button
                type="button"
                className={`seg-btn ${viewMode === "diff" ? "active" : ""}`}
                onClick={() => setViewMode("diff")}
                disabled={setups.length < 2}
              >
                Side-by-Side Diff
              </button>
            </div>

            <button type="button" className="vault-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Save Current Active Setup Bar (If present) */}
        {currentSetupToSave && (
          <div className="vault-quick-save-strip">
            <div className="quick-save-info">
              <span className="save-dot"></span>
              <span>Active Setup: <strong>{currentSetupToSave.car}</strong> @ {currentSetupToSave.track}</span>
            </div>
            <div className="quick-save-inputs">
              <input
                type="text"
                className="vault-name-input"
                placeholder="Setup Name (e.g. Spa Quali V2 Softer ARB)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <button
                type="button"
                className={`vault-save-btn ${savedFeedback ? "saved" : ""}`}
                onClick={handleSaveCurrent}
              >
                {savedFeedback ? "✓ Saved to Vault" : "+ Save Setup"}
              </button>
            </div>
          </div>
        )}

        {/* Body View 1: List of Saved Setups */}
        {viewMode === "list" && (
          <div className="vault-list-view">
            {setups.length === 0 ? (
              <div className="vault-empty-state">
                <p>No saved setups in your local vault yet. Generate or synthesize a setup and save it here.</p>
              </div>
            ) : (
              <div className="vault-cards-grid">
                {setups.map((s) => (
                  <div key={s.id} className="vault-setup-card">
                    <div className="setup-card-top">
                      <div className="setup-name-group">
                        <h4 className="setup-card-title">{s.name}</h4>
                        <div className="setup-card-meta">
                          <span>{s.car}</span>
                          <span>·</span>
                          <span>{s.track}</span>
                          <span>·</span>
                          <span className="text-dim">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {s.lapTime && (
                        <div className="setup-laptime-badge">
                          <span className="lap-label">PB PACE</span>
                          <span className="lap-time">{s.lapTime}</span>
                        </div>
                      )}
                    </div>

                    {s.summary && (
                      <p className="setup-card-summary">{s.summary}</p>
                    )}

                    <div className="setup-card-sections-preview">
                      {s.sections.slice(0, 3).map((sec, i) => (
                        <span key={i} className="section-pill">
                          {sec.title} ({sec.items.length})
                        </span>
                      ))}
                    </div>

                    <div className="setup-card-footer">
                      <div className="setup-footer-left">
                        {onLoadSetup && (
                          <button
                            type="button"
                            className="card-load-btn"
                            onClick={() => {
                              onLoadSetup(s);
                              onClose();
                            }}
                          >
                            Load Setup →
                          </button>
                        )}
                        <SetupExportModal
                          buttonLabel="Export"
                          context={{
                            game: s.game,
                            car: s.car,
                            track: s.track,
                            sessionType: s.sessionType,
                            weather: s.weather,
                            trackTemp: s.trackTemp,
                            airTemp: s.airTemp,
                            driverStyle: s.driverStyle,
                            summary: s.summary,
                            sections: s.sections,
                            engineerNotes: s.engineerNotes,
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        className="card-delete-btn"
                        onClick={(e) => handleDelete(s.id, e)}
                        title="Delete setup from vault"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body View 2: Side-by-Side Parameter Diff */}
        {viewMode === "diff" && (
          <div className="vault-diff-view">
            {/* Diff Selectors Bar */}
            <div className="diff-selectors-bar">
              <div className="diff-select-group">
                <label className="diff-label">Baseline (Setup A)</label>
                <select
                  className="diff-select"
                  value={selectedIdA}
                  onChange={(e) => setSelectedIdA(e.target.value)}
                >
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lapTime || "No lap"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="diff-vs-indicator">VS</div>

              <div className="diff-select-group">
                <label className="diff-label">Comparison (Setup B)</label>
                <select
                  className="diff-select"
                  value={selectedIdB}
                  onChange={(e) => setSelectedIdB(e.target.value)}
                >
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lapTime || "No lap"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="diff-filter-toggle">
                <label className="checkbox-pill">
                  <input
                    type="checkbox"
                    checked={diffOnly}
                    onChange={(e) => setDiffOnly(e.target.checked)}
                  />
                  <span>Show Differences Only</span>
                </label>
              </div>
            </div>

            {/* Diff Summary Strip */}
            {diffResult && (
              <div className="diff-summary-strip">
                <div className="diff-stat">
                  <span className="stat-label">MODIFIED PARAMETERS</span>
                  <span className="stat-val text-amber">{diffResult.changedCount}</span>
                </div>
                <div className="diff-stat">
                  <span className="stat-label">IDENTICAL PARAMETERS</span>
                  <span className="stat-val text-slate">{diffResult.unchangedCount}</span>
                </div>
                {diffResult.setupA.lapTime && diffResult.setupB.lapTime && (
                  <div className="diff-stat">
                    <span className="stat-label">LAP TIME PACE DELTA</span>
                    <span className="stat-val text-emerald">
                      {diffResult.setupA.lapTime} → {diffResult.setupB.lapTime}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Parameter Diff Table */}
            {diffResult && (
              <div className="diff-table-wrapper">
                <table className="diff-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Parameter</th>
                      <th>Setup A ({setupA?.name.slice(0, 22)})</th>
                      <th>Setup B ({setupB?.name.slice(0, 22)})</th>
                      <th>Delta / Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffResult.diffs
                      .filter((d) => (diffOnly ? d.hasChanged : true))
                      .map((d, i) => (
                        <tr key={i} className={d.hasChanged ? "diff-row-changed" : ""}>
                          <td className="diff-cat-cell">{d.category}</td>
                          <td className="diff-param-cell">{d.label}</td>
                          <td className="diff-val-a">{d.valueA}</td>
                          <td className={`diff-val-b ${d.hasChanged ? "highlight-changed" : ""}`}>
                            {d.valueB}
                          </td>
                          <td className="diff-delta-cell">
                            {d.hasChanged ? (
                              <span className={`diff-tag ${d.tone}`}>{d.deltaSummary}</span>
                            ) : (
                              <span className="text-dim">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
