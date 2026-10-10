"use client";

import React, { useState, useRef, useEffect } from "react";
import { SetupExportContext } from "@/lib/setup-exporter";
import { TelemetryAnalysisResult, ParsedTelemetryFile } from "@/types/telemetry";
import { EngineerMessageContent } from "./EngineerMessageFormatter";

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
  activeCar?: string;
  activeTrack?: string;
}

export const RaceEngineerChat: React.FC<RaceEngineerChatProps> = ({
  currentSetup,
  telemetryResult,
  parsedTelemetry,
  onApplyAdjustmentToSetup,
  onSwitchToSetup,
  activeCar: activeCarProp,
  activeTrack: activeTrackProp,
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const gamepadPollingRef = useRef<number | null>(null);
  const lastGamepadBtnState = useRef<boolean>(false);

  const activeSim = currentSetup?.game || "Assetto Corsa Competizione";
  const activeCar = currentSetup?.car || activeCarProp || parsedTelemetry?.filename?.split(/[-_]/)[0]?.toUpperCase() || "GT3 Car";
  const activeTrack = currentSetup?.track || activeTrackProp || "Current Circuit";
  const activeLapTime = telemetryResult?.lapComparison?.driverLapTime || parsedTelemetry?.lapTime || "--:--.---";
  const gripUtil = telemetryResult?.frictionCircle?.gripUtilizationPct ?? null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Authentic pit-radio beep sound via Web Audio API
  const playRadioBeep = (open: boolean) => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(open ? 920 : 620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(open ? 1200 : 420, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (_e) {}
  };

  // Initialize Speech Recognition & Wheel Button Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      setSpeechSupported(true);
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        playRadioBeep(true);
      };

      rec.onresult = (e: any) => {
        const transcript = e.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput(transcript);
          handleSendMessage(transcript);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        playRadioBeep(false);
      };

      recognitionRef.current = rec;
    }

    // Gamepad API Poller for Sim Rig Steering Wheel Button PTT
    const pollGamepad = () => {
      const gamepads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
      let anyBtnPressed = false;
      for (const gp of gamepads) {
        if (!gp) continue;
        // Check primary action buttons or wheel thumb buttons (index 0, 1, 4, 5)
        for (let i = 0; i < Math.min(gp.buttons.length, 12); i++) {
          if (gp.buttons[i]?.pressed) {
            anyBtnPressed = true;
            break;
          }
        }
      }

      if (anyBtnPressed && !lastGamepadBtnState.current) {
        // Toggle PTT
        toggleVoiceInput();
      }
      lastGamepadBtnState.current = anyBtnPressed;
      gamepadPollingRef.current = requestAnimationFrame(pollGamepad);
    };

    gamepadPollingRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      if (gamepadPollingRef.current) cancelAnimationFrame(gamepadPollingRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (_e) {}
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (_e) {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (_e) {
        setIsListening(false);
      }
    }
  };

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
      topSpeed: parsedTelemetry?.topSpeed ?? null,
      minSpeed: parsedTelemetry?.minSpeed ?? null,
      trailBrakingScore: parsedTelemetry?.trailBrakingScore ?? null,
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
    { label: "Turn 1 Pace Deficit", prompt: "Why am I losing time in Turn 1 compared to the delta benchmark?" },
    { label: "Tyre Temp & Pressure Check", prompt: "Check my tyre pressures and operating temperature window across the stint." },
    { label: "Cure Mid-Corner Understeer", prompt: "I have mid-corner push and understeer. What suspension and toe clicks should I adjust?" },
    { label: "High-Speed Snap Oversteer", prompt: "The car snaps into oversteer under high-speed trail-braking. How do I stabilize the rear axle?" },
    { label: "Kerb Compliance in Chicanes", prompt: "The car bounces violently over chicane kerbs. How should I tune my fast dampers and bump stops?" },
  ];

  return (
    <div className="race-engineer-workspace max-w-[1440px] mx-auto px-6 py-4 flex flex-col gap-4">
      {/* Session Context Bar */}
      <div className="bg-[#0f1420] border border-white/10 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-mono font-bold text-xs">
            RE
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-white">
                Race Engineer
              </span>
              <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                Session synced
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
              <span className="text-slate-200 font-medium">{activeCar}</span>
              <span>•</span>
              <span className="text-slate-300">{activeTrack}</span>
              <span>•</span>
              <span className="text-slate-400">Sim: {activeSim}</span>
            </div>
          </div>
        </div>

        {/* Live Telemetry Mini-Pills & Radio Sound Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-black/40 border border-white/5 rounded-md px-3 py-1.5">
            <span className="text-slate-400">Lap Time:</span>
            <span className="text-white font-medium">{activeLapTime}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">Grip Util:</span>
            <span className="text-emerald-400 font-medium">{gripUtil}%</span>
          </div>

          <button
            type="button"
            onClick={() => setRadioAudioEnabled(!radioAudioEnabled)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors flex items-center gap-1.5 ${
              radioAudioEnabled
                ? "bg-blue-600/15 border-blue-500/40 text-blue-300"
                : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Toggle team radio voice synthesis"
          >
            <span>{radioAudioEnabled ? "Radio Audio: ON" : "Radio Audio: OFF"}</span>
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-[var(--bg-surface)] border border-white/10 rounded-lg flex flex-col h-[650px] overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((msg) => {
            const isEngineer = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 w-full ${
                  isEngineer ? "self-start max-w-[94%] md:max-w-[88%]" : "self-end max-w-[85%] md:max-w-[75%] flex-row-reverse"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-bold mt-1 ${
                    isEngineer
                      ? "bg-slate-800 text-slate-200 border border-slate-700"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {isEngineer ? "RE" : "DR"}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-lg p-4 text-xs md:text-[13px] leading-relaxed flex-1 ${
                    isEngineer
                      ? "bg-[var(--bg-surface-elevated)] border border-white/10 text-slate-200 shadow-sm"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between gap-4 mb-2.5 pb-1.5 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-mono font-semibold tracking-wide ${
                          isEngineer ? "text-slate-300" : "text-blue-100"
                        }`}
                      >
                        {isEngineer ? "Race Engineer" : "Driver"}
                      </span>
                      {isEngineer && (
                        <span className="text-[9.5px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.2 rounded">
                          Pit Wall
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 opacity-60">
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Body Content */}
                  <EngineerMessageContent content={msg.content} role={msg.role} />

                  {/* If engineer suggests setup modifications, show quick-apply button */}
                  {isEngineer && (/anti-roll|arb|dampers|bump|rebound|toe|camber|diff|power|coast|pressure|psi|wing|rake|ride height|brake bias|click/i.test(msg.content)) && (
                    <div className="mt-3.5 pt-2.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 bg-black/20 -mx-4 -mb-4 p-3 rounded-b-lg">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span>Actionable setup parameter adjustments detected</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onApplyAdjustmentToSetup?.(msg.content);
                          onSwitchToSetup?.();
                        }}
                        className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 rounded text-xs font-mono text-blue-300 hover:text-white font-medium transition-colors flex items-center gap-1.5"
                      >
                        <span>Push to Setup Generator</span>
                        <span>→</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="self-start flex gap-2.5 max-w-[85%]">
              <div className="w-7 h-7 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-[10px] font-mono font-bold">
                RE
              </div>
              <div className="bg-[var(--bg-surface-elevated)] border border-white/10 rounded-md p-3 text-xs font-mono text-slate-400">
                <span>Analyzing telemetry channels and evaluating setup recommendations...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Debrief Suggestions Bar */}
        <div className="px-4 py-2 bg-black/30 border-t border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[10.5px] font-mono tracking-wide text-slate-500 flex-shrink-0">
            Debrief Focus:
          </span>
          {quickDebriefPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q.prompt)}
              className="flex-shrink-0 px-2.5 py-1 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-[var(--bg-surface-elevated)] border-t border-white/10 flex items-center gap-2.5">
          {/* Wheel/Voice PTT Button */}
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`px-3 py-2 rounded-md font-mono text-xs flex items-center gap-1.5 transition-all border ${
                isListening
                  ? "bg-red-500/20 border-red-500 text-red-300 animate-pulse"
                  : "bg-white/[0.04] border-white/10 hover:border-blue-500/50 text-slate-300 hover:text-white"
              }`}
              title="Push-To-Talk Radio (Click or Press Wheel Button)"
            >
              <span className={`w-2 h-2 rounded-full ${isListening ? "bg-red-500" : "bg-slate-400"}`} />
              <span className="hidden sm:inline">{isListening ? "Listening..." : "Radio PTT"}</span>
            </button>
          )}

          <div className="flex-1 flex items-center bg-[var(--bg-inset)] border border-white/10 focus-within:border-blue-500 rounded-md px-3 py-2 transition-colors">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening to driver comms..." : "Report car behavior or ask for engineering recommendations..."}
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
            />
          </div>

          <button
            type="button"
            disabled={!input.trim() || isLoading}
            onClick={() => handleSendMessage(input)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-medium text-xs font-mono rounded-md transition-colors flex items-center gap-1.5"
          >
            <span>Send</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
