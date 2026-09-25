"use client";

import React from "react";

interface HeaderProps {
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isLoading }) => {
  return (
    <header className="top-nav">
      <div className="nav-inner">
        {/* Brand Identity */}
        <div className="nav-brand">
          <div className="nav-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15l4-8 4 6 4-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="nav-brand-title">
            <span className="nav-brand-name">SimSetup AI</span>
            <span className="nav-brand-subtitle">/ Race Engineering & Telemetry</span>
          </div>
        </div>

        {/* Engineering Status Bus */}
        <div className="nav-status-group">
          <div className="status-indicator-pill" title="Telemetry Processing Engine Status">
            <span className={`status-dot ${isLoading ? "busy" : "active"}`} aria-hidden="true"></span>
            <span>{isLoading ? "PROCESSING TELEMETRY" : "MOTEC ENGINE READY"}</span>
          </div>

          <div className="status-indicator-pill hidden md:flex" title="AI Inference Backbone">
            <span className="text-slate-400">MODEL</span>
            <span className="text-slate-200">GROQ L-3.3 70B</span>
          </div>
        </div>
      </div>

      {/* Subtle hairline progress bar when loading */}
      {isLoading && (
        <div className="w-full h-[2px] bg-blue-500/20 overflow-hidden absolute bottom-0 left-0">
          <div className="h-full bg-blue-500 w-1/3 animate-[indeterminate_1.5s_infinite_linear]"></div>
        </div>
      )}
    </header>
  );
};
