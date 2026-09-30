"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, X, Type } from "lucide-react";

export type FontThemeId = "barlow" | "geist";

export const FONT_MAPS: Record<FontThemeId, { sans: string; display: string; mono: string; name: string }> = {
  barlow: {
    name: "Option B: Barlow Semi Condensed + IBM Plex",
    sans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Barlow Semi Condensed', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  geist: {
    name: "Option A: Geist + Geist Mono",
    sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "'Geist', sans-serif",
    mono: "'Geist Mono', monospace",
  },
};

export function applyGlobalFontTheme(fontId: FontThemeId) {
  if (typeof window === "undefined") return;
  const selected = FONT_MAPS[fontId] || FONT_MAPS.barlow;
  
  document.documentElement.setAttribute("data-font", fontId);
  document.body.setAttribute("data-font", fontId);
  document.documentElement.style.setProperty("--font-sans", selected.sans);
  document.documentElement.style.setProperty("--font-display", selected.display);
  document.documentElement.style.setProperty("--font-mono", selected.mono);
  document.body.style.fontFamily = selected.sans;
  
  try {
    localStorage.setItem("apexwall_font", fontId);
  } catch {
    // Ignore storage errors
  }
}

interface FontOption {
  id: FontThemeId;
  name: string;
  subtitle: string;
  displayFont: string;
  bodyFont: string;
  monoFont: string;
  description: string;
  sampleHeader: string;
  sampleBody: string;
  sampleMetrics: Array<{ label: string; value: string; delta?: string }>;
}

const FONT_OPTIONS: FontOption[] = [
  {
    id: "barlow",
    name: "Option B — Motorsport character",
    subtitle: "Barlow Semi Condensed + IBM Plex Sans + IBM Plex Mono",
    displayFont: "Barlow Semi Condensed (400, 600)",
    bodyFont: "IBM Plex Sans",
    monoFont: "IBM Plex Mono",
    description:
      "Barlow is used only for the wordmark and section titles. Its DIN-like shapes are close to real timing screens and pit boards. IBM Plex is used for everything else, limited to weights 400 and 600.",
    sampleHeader: "Autodromo Enzo e Dino Ferrari // Variante Villeneuve",
    sampleBody:
      "Braking point 68m, trail-brake release smooth through apex kerb. Rear anti-roll bar reduced 1 click to mitigate high-speed exit oversteer.",
    sampleMetrics: [
      { label: "Top speed", value: "318.4 km/h", delta: "+2.1" },
      { label: "Sector delta", value: "-0.428s", delta: "-0.428" },
      { label: "Tyre pressure", value: "27.4 psi", delta: "-0.2" },
      { label: "Lateral load", value: "1.82 G", delta: "+0.05" },
    ],
  },
  {
    id: "geist",
    name: "Option A — Clean and modern",
    subtitle: "Geist + Geist Mono",
    displayFont: "Geist",
    bodyFont: "Geist",
    monoFont: "Geist Mono (tabular-nums)",
    description:
      "Geist for UI and body text, Geist Mono for every number with font-variant-numeric: tabular-nums so values line up cleanly in columns. Neutral and reads as a real engineering product.",
    sampleHeader: "Autodromo Enzo e Dino Ferrari // Variante Villeneuve",
    sampleBody:
      "Braking point 68m, trail-brake release smooth through apex kerb. Rear anti-roll bar reduced 1 click to mitigate high-speed exit oversteer.",
    sampleMetrics: [
      { label: "Top speed", value: "318.4 km/h", delta: "+2.1" },
      { label: "Sector delta", value: "-0.428s", delta: "-0.428" },
      { label: "Tyre pressure", value: "27.4 psi", delta: "-0.2" },
      { label: "Lateral load", value: "1.82 G", delta: "+0.05" },
    ],
  },
];

interface FontShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFont?: (fontId: FontThemeId) => void;
}

export const FontShowcaseModal: React.FC<FontShowcaseModalProps> = ({
  isOpen,
  onClose,
  onSelectFont,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeFont, setActiveFont] = useState<FontThemeId>("barlow");

  useEffect(() => {
    setMounted(true);
    const saved = (typeof window !== "undefined" && localStorage.getItem("apexwall_font")) as FontThemeId | null;
    const current = (typeof document !== "undefined" && document.documentElement.getAttribute("data-font") as FontThemeId) || saved || "barlow";
    setActiveFont(current === "geist" ? "geist" : "barlow");
  }, [isOpen]);

  const handleSelect = (fontId: FontThemeId) => {
    setActiveFont(fontId);
    applyGlobalFontTheme(fontId);
    if (onSelectFont) onSelectFont(fontId);
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#16181b] border border-[#25282d] rounded-[6px] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#25282d]">
          <div className="flex items-center gap-2.5">
            <Type className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.5} />
            <div>
              <h2 className="text-sm font-semibold text-[#c4c7cc]">
                Typography system
              </h2>
              <p className="text-[12px] text-[#808690]">
                Select between motorsport character or clean neutral design
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[4px] text-[#808690] hover:text-[#c4c7cc] hover:bg-[#25282d] transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Options grid */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[75vh]">
          {FONT_OPTIONS.map((opt) => {
            const isSelected = activeFont === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`flex flex-col justify-between p-4 rounded-[6px] border cursor-pointer transition-colors ${
                  isSelected
                    ? "border-[var(--accent)] bg-[#1b1e22]"
                    : "border-[#25282d] bg-[#16181b] hover:border-[#353941] hover:bg-[#191b1f]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#c4c7cc]">
                      {opt.name}
                    </span>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] text-[var(--accent)] font-medium">
                        <Check className="w-3.5 h-3.5" strokeWidth={2} /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#808690] mb-3">
                    {opt.subtitle}
                  </div>
                  <p className="text-[12px] text-[#808690] leading-relaxed mb-4">
                    {opt.description}
                  </p>

                  {/* Specimen Box */}
                  <div className="p-3 rounded-[4px] bg-[#0f1012] border border-[#25282d] space-y-2 mb-3">
                    <div
                      style={{
                        fontFamily:
                          opt.id === "barlow"
                            ? "'Barlow Semi Condensed', sans-serif"
                            : "'Geist', sans-serif",
                      }}
                      className="text-xs font-semibold text-[#c4c7cc]"
                    >
                      {opt.sampleHeader}
                    </div>
                    <div
                      style={{
                        fontFamily:
                          opt.id === "barlow"
                            ? "'IBM Plex Sans', sans-serif"
                            : "'Geist', sans-serif",
                      }}
                      className="text-[12px] text-[#808690] leading-normal"
                    >
                      {opt.sampleBody}
                    </div>
                  </div>

                  {/* Metric Readouts */}
                  <div className="grid grid-cols-2 gap-2">
                    {opt.sampleMetrics.map((m, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-[4px] bg-[#0f1012] border border-[#25282d]"
                      >
                        <div className="text-[11px] text-[#808690]">
                          {m.label}
                        </div>
                        <div
                          style={{
                            fontFamily:
                              opt.id === "barlow"
                                ? "'IBM Plex Mono', monospace"
                                : "'Geist Mono', monospace",
                          }}
                          className="text-xs font-medium text-[#c4c7cc] tabular-nums"
                        >
                          {m.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#25282d] flex justify-end">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                      isSelected
                        ? "bg-[var(--accent)] text-[#d8dbdf]"
                        : "bg-[#25282d] text-[#c4c7cc] hover:bg-[#353941]"
                    }`}
                  >
                    {isSelected ? "Current theme" : "Apply typography"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#25282d] bg-[#121417] flex items-center justify-between text-xs text-[#808690]">
          <span>Changes are saved locally and applied instantaneously.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-[4px] bg-[#25282d] text-[#c4c7cc] hover:bg-[#353941] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
