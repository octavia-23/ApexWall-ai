"use client";

import React, { useState, useRef, useEffect } from "react";
import { SetupExportContext } from "@/lib/setup-exporter";
import { TelemetryAnalysisResult, ParsedTelemetryFile } from "@/types/telemetry";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface RaceEngineerChatProps {
  currentSetup?: SetupExportContext | null;
  telemetryResult?: TelemetryAnalysisResult | null;
  parsedTelemetry?: ParsedTelemetryFile | null;
  onApplyAdjustmentToSetup?: (note: string) => void;
  onSwitchToSetup?: () => void;
}

export const RaceEngineerChat: React.FC<RaceEngineerChatProps> = ({
  currentSetup,
  telemetryResult,
  parsedTelemetry,
  onApplyAdjustmentToSetup,
  onSwitchToSetup,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: `Radio check driver, loud and clear on pit wall telemetry.

I have your active session telemetry and chassis telemetry synced. How does the car feel through the wheel? Let me know if you're fighting understeer on turn-in, snap oversteer on kerbs, or losing time to the delta benchmark, and I'll call out the exact click adjustments to make in the garage.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [radioAudioEnabled, setRadioAudioEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const activeSim = currentSetup?.game || "Assetto Corsa Competizione";
  const activeCar = currentSetup?.car || parsedTelemetry?.filename?.split(/[-_]/)[0]?.toUpperCase() || "GT3 Homologated";
  const activeTrack = currentSetup?.track || "Circuit de Spa-Francorchamps";
  const activeLapTime = telemetryResult?.lapComparison?.driverLapTime || parsedTelemetry?.lapTime || "2:18.420";
  const gripUtil = telemetryResult?.frictionCircle?.gripUtilizationPct || 89.4;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Voice synthesis for authentic pit radio comms
  const speakRadioMessage = (text: string) => {
    if (!radioAudioEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Take first 2 sentences for radio brevity
      const shortText = text.split(/(?<=[.?!])\s+/).slice(0, 2).join(" ");
      const utterance = new SpeechSynthesisUtterance(shortText);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const britishOrDeepVoice = voices.find(
        (v) => v.lang.includes("en-GB") || v.name.includes("Male") || v.name.includes("David")
      );
      if (britishOrDeepVoice) utterance.voice = britishOrDeepVoice;

      window.speechSynthesis.speak(utterance);
    } catch (_e) {
      // Audio synthesis fallback
    }
  };

  const handleSendMessage = async (userText: string) => {
    const query = userText.trim();
    if (!query || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Build context payload
    const telemetryContext = {
      car: activeCar,
      track: activeTrack,
      lapTime: activeLapTime,
      topSpeed: parsedTelemetry?.topSpeed || 285,
      minSpeed: parsedTelemetry?.minSpeed || 65,
      trailBrakingScore: parsedTelemetry?.trailBrakingScore || 78,
      gripUtilization: gripUtil,
      tyres: parsedTelemetry?.tyreStats,
      keyCorners: telemetryResult?.lapComparison?.cornerComparisons?.map((c) => ({
        corner: c.corner,
        driverSpeed: c.driverMinSpeed,
        refSpeed: c.refMinSpeed,
        speedDelta: c.speedDelta,
        timeDelta: c.timeDelta,
        verdict: c.verdict,
      })),
    };

    const setupContext = currentSetup
      ? {
          game: currentSetup.game,
          car: currentSetup.car,
          track: currentSetup.track,
          summary: currentSetup.summary,
          sections: currentSetup.sections,
          engineerNotes: currentSetup.engineerNotes,
        }
      : undefined;

    try {
      const res = await fetch("/api/race-engineer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          telemetryContext,
          setupContext,
          activeSim,
        }),
      });

      const data = await res.json();
      const replyContent = data.reply || "Copy driver, telemetry signal interrupted. State your issue again.";

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      speakRadioMessage(replyContent);
    } catch (_err) {
      const errorMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `Copy driver, telemetry packet lost. Based on your ${activeSim} baseline for ${activeCar}, focus on progressive trail-braking release into turn-in and monitor tyre pressure buildup on your left-hand tyres.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  const quickDebriefPrompts = [
    { label: "⚡ Turn 1 Pace Deficit", prompt: "Why am I losing time in Turn 1 compared to the delta benchmark?" },
    { label: "🛞 Tyre Temp & Pressure Check", prompt: "Check my tyre pressures and operating temperature window across the stint." },
    { label: "🔧 Cure Mid-Corner Understeer", prompt: "I have mid-corner push and understeer. What suspension and toe clicks should I adjust?" },
    { label: "🏎️ High-Speed Snap Oversteer", prompt: "The car snaps into oversteer under high-speed trail-braking. How do I stabilize the rear axle?" },
    { label: "🏁 Kerb Compliance in Chicanes", prompt: "The car bounces violently over chicane kerbs. How should I tune my fast dampers and bump stops?" },
  ];

  return (
    <div className="race-engineer-workspace max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-4">
      {/* Session Context Bar */}
      <div className="bg-[#0f1420] border border-cyan-500/20 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-inner">
            🎙️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono tracking-wider text-white uppercase">
                CHIEF RACE ENGINEER // PIT WALL TELEMETRY DEBRIEF
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                RADIO COMMS ACTIVE
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
              <span className="text-cyan-300 font-semibold">{activeCar}</span>
              <span>•</span>
              <span className="text-slate-300">{activeTrack}</span>
              <span>•</span>
              <span className="text-slate-400">Sim: {activeSim}</span>
            </div>
          </div>
        </div>

        {/* Live Telemetry Mini-Pills & Radio Sound Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-black/40 border border-white/5 rounded-lg px-3 py-1.5">
            <span className="text-slate-400">Lap Time:</span>
            <span className="text-white font-bold">{activeLapTime}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Grip Util:</span>
            <span className="text-emerald-400 font-bold">{gripUtil}%</span>
          </div>

          <button
            type="button"
            onClick={() => setRadioAudioEnabled(!radioAudioEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-2 ${
              radioAudioEnabled
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Toggle authentic team radio voice synthesis"
          >
            <span>{radioAudioEnabled ? "🔊" : "🔇"}</span>
            <span>{radioAudioEnabled ? "Radio Audio: ON" : "Radio Audio: OFF"}</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-[#0b0e14] border border-white/10 rounded-2xl flex flex-col h-[650px] shadow-2xl overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.map((msg) => {
            const isEngineer = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  isEngineer ? "self-start" : "self-end flex-row-reverse"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                    isEngineer
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {isEngineer ? "⚡" : "🏎️"}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                    isEngineer
                      ? "bg-[#121824] border border-cyan-500/25 text-slate-200 shadow-lg"
                      : "bg-blue-600/90 text-white shadow-lg"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/10">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isEngineer ? "text-cyan-400" : "text-blue-200"
                      }`}
                    >
                      {isEngineer ? "CHIEF RACE ENGINEER // PIT WALL CH 1" : "DRIVER // COCKPIT"}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 opacity-70">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.content}
                  </div>

                  {/* If engineer suggests setup modifications, show quick-apply button */}
                  {isEngineer && (msg.content.includes("Anti-Roll") || msg.content.includes("Dampers") || msg.content.includes("Toe") || msg.content.includes("click")) && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-500/20 flex items-center justify-between">
                      <span className="text-[10.5px] font-mono text-cyan-300">
                        ⚡ Actionable garage adjustments detected
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyAdjustmentToSetup?.(msg.content);
                          onSwitchToSetup?.();
                        }}
                        className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-[11px] font-mono text-cyan-300 font-semibold transition-colors"
                      >
                        Push to Setup Generator →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="self-start flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-bold animate-pulse">
                ⚡
              </div>
              <div className="bg-[#121824] border border-cyan-500/25 rounded-2xl p-4 text-xs font-mono text-cyan-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>Race Engineer analyzing telemetry channels & calculating setup changes...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Debrief Suggestions Bar */}
        <div className="px-5 py-2.5 bg-black/40 border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10.5px] font-mono uppercase tracking-wider text-slate-500 flex-shrink-0">
            Debrief Focus:
          </span>
          {quickDebriefPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.prompt)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/30 text-[11px] font-mono text-slate-300 hover:text-cyan-300 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-[#0d121c] border-t border-white/10 flex items-center gap-3">
          <div className="flex-1 flex items-center bg-[#151c2a] border border-white/15 focus-within:border-cyan-500 rounded-xl px-4 py-2.5 transition-colors">
            <span className="text-slate-500 mr-2 font-mono text-xs">🎙️ DRIVER:</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell your race engineer how the car feels or ask about telemetry..."
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
            />
          </div>

          <button
            type="button"
            disabled={!input.trim() || isLoading}
            onClick={() => handleSendMessage(input)}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-black font-bold text-xs font-mono rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2"
          >
            <span>RADIO PIT WALL</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
