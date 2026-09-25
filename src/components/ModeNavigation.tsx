"use client";

import React from "react";

export type WorkspaceMode = "setup" | "telemetry" | "strategy" | "live";

interface ModeNavigationProps {
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  onOpenVault: () => void;
  savedSetupsCount?: number;
}

export const ModeNavigation: React.FC<ModeNavigationProps> = ({
  mode,
  onChangeMode,
  onOpenVault,
  savedSetupsCount = 0,
}) => {
  return (
    <nav aria-label="Workspace Mode Selection" className="flex items-center gap-3">
      <div className="mode-switcher-bar">
        <button
          type="button"
          className={`mode-toggle-btn ${mode === "setup" ? "active" : ""}`}
          onClick={() => onChangeMode("setup")}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span>Setup Generator</span>
        </button>

        <button
          type="button"
          className={`mode-toggle-btn ${mode === "telemetry" ? "active" : ""}`}
          onClick={() => onChangeMode("telemetry")}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Telemetry Analyzer</span>
          <span className="mode-badge">Adaptive AI</span>
        </button>

        <button
          type="button"
          className={`mode-toggle-btn ${mode === "strategy" ? "active" : ""}`}
          onClick={() => onChangeMode("strategy")}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>Race Strategy & Tools</span>
        </button>

        <button
          type="button"
          className={`mode-toggle-btn ${mode === "live" ? "active" : ""}`}
          onClick={() => onChangeMode("live")}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>Live Cockpit HUD</span>
          <span className="mode-badge" style={{ background: "rgba(244, 63, 94, 0.15)", color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}>60Hz UDP</span>
        </button>
      </div>

      {/* Setup Vault Button */}
      <button
        type="button"
        className="vault-nav-btn"
        onClick={onOpenVault}
        title="Open Setup Vault & Version Diff"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
          <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
          <path d="M4 12h16" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span>Setup Vault</span>
        {savedSetupsCount > 0 && <span className="vault-badge-count">{savedSetupsCount}</span>}
      </button>
    </nav>
  );
};
