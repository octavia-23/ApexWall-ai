"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Download, 
  CheckCircle2, 
  Terminal, 
  ArrowLeft, 
  Cpu, 
  Radio, 
  Sliders, 
  Zap, 
  ShieldCheck,
  RefreshCw,
  ExternalLink
} from "lucide-react";

export default function DownloadPage() {
  const [activeTab, setActiveTab] = useState<"ams2" | "forza" | "f1" | "acc" | "ac">("ams2");
  const [bridgeStatus, setBridgeStatus] = useState<{
    connected: boolean;
    game: string;
    pointsCount: number;
  } | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const res = await fetch("http://localhost:9001/api/status", { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        setBridgeStatus({
          connected: true,
          game: data.activeGame || "Standby",
          pointsCount: data.currentLapPointsCount || 0,
        });
      } else {
        setBridgeStatus(null);
      }
    } catch {
      setBridgeStatus(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="h-14 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-8 flex items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
          <span>Back to Telemetry Cockpit</span>
        </Link>

        <div className="flex items-center gap-3">
          {bridgeStatus?.connected ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Bridge Active: {bridgeStatus.game}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-amber-400/80" />
              <span>Bridge Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-16">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            <Radio className="w-3.5 h-3.5" />
            <span>ApexWall Rig Bridge v2.1 • Universal Windows Hub</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Zero-Friction Sim Racing Telemetry
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Eliminate SecondMonitor, MoTeC converters, and manual CSV exporting. 
            Stream 60Hz telemetry directly into ApexWall and inject setups in 1 click.
          </p>

          {/* Primary Download Button */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/downloads/ApexWall-Bridge.zip"
              download="ApexWall-Bridge.zip"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-900/30 flex items-center justify-center gap-2.5 transition transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Download className="w-4 h-4" />
              <span>Download ApexWall Bridge for Windows</span>
              <span className="text-xs font-normal opacity-75 font-mono">(34 MB)</span>
            </a>

            <button
              onClick={checkStatus}
              disabled={isChecking}
              className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-blue-400" : ""}`} />
              <span>Test Connection</span>
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Standalone executable included. Zero Node.js or Git required.</span>
          </p>
        </div>

        {/* Live Bridge Connection Live Tester Card */}
        <div className={`p-4 rounded-xl border mb-12 backdrop-blur-md transition-all ${
          bridgeStatus?.connected 
            ? "bg-emerald-950/20 border-emerald-500/30" 
            : "bg-slate-900/40 border-slate-800"
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className={`w-3.5 h-3.5 rounded-full ${bridgeStatus?.connected ? "bg-emerald-400" : "bg-amber-400"}`} />
                {bridgeStatus?.connected && (
                  <span className="absolute w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {bridgeStatus?.connected ? "Bridge Connected & Streaming" : "Awaiting Local Bridge"}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {bridgeStatus?.connected 
                    ? `Active on ws://localhost:9001 • Target: ${bridgeStatus.game} • ${bridgeStatus.pointsCount} pts in memory`
                    : "Double-click Launch_ApexWall_Bridge.bat or ApexWall-Bridge.exe to begin listening"}
                </div>
              </div>
            </div>

            {bridgeStatus?.connected && (
              <Link 
                href="/" 
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5"
              >
                <span>Launch Cockpit</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* 3 Core Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14">
          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3.5">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-200 mb-1.5">Universal Auto-Detect</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Opens UDP ports for AMS2 (5606), Forza (5300), F1 (20777), and ACC (9000) simultaneously. Just launch your sim.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-200 mb-1.5">Auto-Lap Recording</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Buffers laps at 60Hz. When you cross the finish line, click &quot;Import Live Lap&quot; in ApexWall to analyze your telemetry instantly.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800/80 bg-slate-900/30">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3.5">
              <Sliders className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-slate-200 mb-1.5">1-Click Setup Injection</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bypasses browser limits to write native .svm, .ini, and .json setup files straight into your game&apos;s Documents directory.
            </p>
          </div>
        </div>

        {/* Tabbed In-Game Setup Guide */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/20">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-white">In-Game Telemetry Configuration</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select your sim title below to see the exact in-game toggle.</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
              {(["ams2", "forza", "f1", "acc", "ac"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                    activeTab === tab 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab === "ams2" ? "AMS2" : tab === "forza" ? "Forza" : tab === "f1" ? "F1 24" : tab === "acc" ? "ACC" : "Assetto Corsa"}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "ams2" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-400">Automobilista 2 / Project CARS 2 (UDP Port 5606)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>In AMS2, navigate to <span className="font-mono text-amber-300">Options &gt; System</span>.</li>
                  <li>Set <span className="font-semibold text-white">Use Shared Memory</span> to <span className="font-mono text-emerald-400">Project CARS 2</span>.</li>
                  <li>Set <span className="font-semibold text-white">UDP Protocol Version</span> to <span className="font-mono text-emerald-400">Project CARS 2</span>.</li>
                  <li>Set <span className="font-semibold text-white">UDP Frequency</span> to <span className="font-mono text-emerald-400">1 or 2</span> (60Hz transmission).</li>
                  <li>Save and return to track. The bridge will automatically capture your laps!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "forza" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-400">Forza Motorsport & Horizon (UDP Port 5300 - PC &amp; Xbox)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>In Forza, go to <span className="font-mono text-amber-300">Settings &gt; Gameplay &gt; HUD &amp; Gameplay</span>.</li>
                  <li>Scroll down to <span className="font-semibold text-white">Data Out</span> and toggle it to <span className="font-mono text-emerald-400">ON</span>.</li>
                  <li>Set <span className="font-semibold text-white">Data Out IP Address</span> to <span className="font-mono text-emerald-400">127.0.0.1</span> (or your PC&apos;s local IP if playing on Xbox).</li>
                  <li>Set <span className="font-semibold text-white">Data Out IP Port</span> to <span className="font-mono text-emerald-400">5300</span>.</li>
                  <li>Set <span className="font-semibold text-white">Data Out Packet Format</span> to <span className="font-mono text-emerald-400">CarDash</span>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "f1" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-400">F1 23 / F1 24 / F1 25 (UDP Port 20777)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>In F1, open <span className="font-mono text-amber-300">Game Options &gt; Settings &gt; Telemetry Settings</span>.</li>
                  <li>Toggle <span className="font-semibold text-white">UDP Telemetry</span> to <span className="font-mono text-emerald-400">ON</span>.</li>
                  <li>Set <span className="font-semibold text-white">UDP Broadcast</span> to <span className="font-mono text-emerald-400">ON</span>.</li>
                  <li>Set <span className="font-semibold text-white">UDP Port</span> to <span className="font-mono text-emerald-400">20777</span>.</li>
                  <li>Set <span className="font-semibold text-white">UDP Send Rate</span> to <span className="font-mono text-emerald-400">60Hz</span>.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "acc" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-400">Assetto Corsa Competizione (UDP Port 9000)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>ACC natively communicates via UDP port 9000.</li>
                  <li>Ensure our bridge is running on your machine.</li>
                  <li>Setups are automatically injected directly to:</li>
                  <div className="font-mono text-slate-400 text-[11px] bg-black/40 p-2 rounded">
                    Documents\Assetto Corsa Competizione\Setups\&lt;car&gt;\&lt;track&gt;
                  </div>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "ac" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="font-semibold text-sky-400">Assetto Corsa (Original &amp; Content Manager)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                  <li>Works directly with the ApexWall Bridge for setup injection and telemetry.</li>
                  <li>Setups automatically resolve to your active mod or Kunos car directory:</li>
                  <div className="font-mono text-slate-400 text-[11px] bg-black/40 p-2 rounded">
                    Documents\Assetto Corsa\setups\&lt;car_folder&gt;\&lt;track&gt;
                  </div>
                </ol>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-white/[0.08] flex items-center justify-between px-6 text-xs text-slate-500 font-mono">
        <div>ApexWall AI v2.1 • Motorsport Engineering &amp; Telemetry Hub</div>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-slate-300 transition">Telemetry</Link>
          <a href="/downloads/ApexWall-Bridge.zip" download="ApexWall-Bridge.zip" className="text-blue-400 hover:text-blue-300 transition">Download (.zip)</a>
        </div>
      </footer>
    </div>
  );
}
