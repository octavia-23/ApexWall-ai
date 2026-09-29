"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { WorkspaceMode } from "@/components/ModeNavigation";
import { Activity, Sliders, MessageSquare, Timer, Radio, Moon, Sun, ShieldCheck } from "lucide-react";

interface CockpitNavbarProps {
  mode: WorkspaceMode;
  onChangeMode: (mode: WorkspaceMode) => void;
  onOpenVault: () => void;
  onOpenAuth: () => void;
  savedSetupsCount: number;
  isLoading: boolean;
  activeCar?: string;
  activeTrack?: string;
}

export const CockpitNavbar: React.FC<CockpitNavbarProps> = ({
  mode,
  onChangeMode,
  onOpenVault,
  onOpenAuth,
  savedSetupsCount,
  isLoading,
  activeCar = "Ferrari 296 GT3",
  activeTrack = "Spa-Francorchamps",
}) => {
  const { user, signOut } = useAuth();
  const { isAmoled, toggleTheme } = useTheme();
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

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Driver";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();

  const modes: Array<{ id: WorkspaceMode; label: string; icon: React.ReactNode }> = [
    { id: "telemetry", label: "Telemetry", icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "setup", label: "Chassis Setup", icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: "engineer", label: "Race Engineer", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: "strategy", label: "Pit Strategy", icon: <Timer className="w-3.5 h-3.5" /> },
    { id: "live", label: "Live HUD", icon: <Radio className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 h-12 w-full bg-[var(--bg-base)]/90 backdrop-blur-xl border-b border-white/[0.08] select-none transition-colors duration-200">
      <div className="max-w-[1780px] h-full mx-auto px-4 flex items-center justify-between gap-3">
        {/* LEFT: Brand */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm font-extrabold text-xs tracking-wider">
              AW
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white font-sans">
              ApexWall
            </span>
          </div>
        </div>

        {/* CENTER: Sleek Segmented Mode Controller */}
        <nav aria-label="Workspace Navigation" className="flex items-center">
          <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] gap-1">
            {modes.map((m) => {
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChangeMode(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-md font-bold"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="text-[11px]">{m.icon}</span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* RIGHT: Active Car/Track, AMOLED Toggle, Vault & Driver Profile */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active Session Pill */}
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-slate-300">
            <span className="text-blue-400 font-semibold">{activeCar}</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">{activeTrack}</span>
          </div>

          {/* AMOLED Mode Switcher Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
              isAmoled
                ? "bg-white/10 text-white border-white/20 shadow-sm"
                : "bg-white/[0.04] text-slate-400 hover:text-slate-200 border-white/[0.08]"
            }`}
            title="Toggle AMOLED True Black Mode (Pure OLED pitch black vs Obsidian Slate)"
          >
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                isAmoled ? "bg-emerald-400 shadow-[0_0_8px_#34D399]" : "bg-slate-500"
              }`}
            ></span>
            <span className="font-mono text-[11px] tracking-tight">AMOLED</span>
            {isAmoled && (
              <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                PITCH
              </span>
            )}
          </button>

          {/* Setup Vault Button */}
          <button
            type="button"
            onClick={onOpenVault}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/40 hover:bg-blue-600/10 text-xs font-medium text-slate-300 hover:text-white transition-all"
            title="Open Setup Vault & Parameter Diff Engine"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
              <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
              <path d="M4 12h16" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="hidden md:inline">Vault</span>
            {savedSetupsCount > 0 && (
              <span className="text-[10px] font-bold text-blue-300 bg-blue-600/20 border border-blue-500/30 px-1.5 rounded-full">
                {savedSetupsCount}
              </span>
            )}
          </button>

          {/* Driver Auth Menu */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-blue-400/40 text-xs font-medium"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[9px]">
                    {initial}
                  </div>
                )}
                <span className="text-slate-200 font-medium max-w-[90px] truncate hidden sm:inline">
                  {displayName}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-[#0C101A] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-white/10">
                    <div className="font-semibold text-slate-100 truncate">{displayName}</div>
                    <div className="text-[10.5px] text-slate-400 truncate">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors mt-1 font-medium"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-all shadow-sm"
            >
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar when loading */}
      {isLoading && (
        <div className="w-full h-[2px] bg-blue-500/20 overflow-hidden absolute bottom-0 left-0">
          <div className="h-full bg-blue-500 w-1/3 animate-[indeterminate_1.5s_infinite_linear]"></div>
        </div>
      )}
    </header>
  );
};
