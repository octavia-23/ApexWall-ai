"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  isLoading: boolean;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isLoading, onOpenAuth }) => {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute initials or display name
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Driver";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <header className="top-nav relative">
      <div className="nav-inner">
        {/* Brand Identity */}
        <div className="nav-brand">
          <div className="nav-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15l4-8 4 6 4-3 4 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="nav-brand-title">
            <span className="nav-brand-name">PitWall AI</span>
            <span className="nav-brand-subtitle">/ Race Engineering & Telemetry</span>
          </div>
        </div>

        {/* Right side group: Engineering Status Bus & Auth */}
        <div className="flex items-center gap-3">
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

          {/* Authentication Badge / Driver Menu */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-cyan-400/50 transition-all text-xs font-mono"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-5 h-5 rounded-full object-cover border border-cyan-400/40"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                    {initial}
                  </div>
                )}
                <span className="text-slate-200 font-medium max-w-[110px] truncate hidden sm:inline">
                  {displayName}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0D111A] border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="font-semibold text-slate-200 truncate">{displayName}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{user.email}</div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded w-fit">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                      <span>TELEMETRY CLOUD SYNCED</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        signOut();
                      }}
                      className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors font-mono"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>SIGN OUT</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-2 py-1 px-3 rounded-lg bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 hover:border-blue-400 transition-all text-xs font-mono font-semibold text-blue-300 hover:text-white"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>SIGN IN</span>
            </button>
          )}
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
