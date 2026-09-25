"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { parseTelemetryCSV } from "@/lib/telemetry-parser";
import { computeLapComparison } from "@/lib/telemetry-comparison";
import { computeGGFrictionCircle } from "@/lib/telemetry-friction-circle";
import { generateTrackMapData } from "@/lib/track-map-generator";
import { GGFrictionCircle } from "./GGFrictionCircle";
import { TrackMap2D } from "./TrackMap2D";
import {
  ParsedTelemetryFile,
  TelemetryAnalysisResult,
  TelemetryPoint,
  LapComparisonSummary,
  CornerDeltaComparison,
  DeltaPoint,
  GGFrictionCircleData,
  TrackMapData,
} from "@/types/telemetry";
import { SetupExportModal } from "../setup/SetupExportModal";
import { saveSetupToVault } from "@/lib/setup-vault";

interface TelemetryAnalyzerProps {
  onLoadingChange: (loading: boolean) => void;
  onApplyToSetup: (setupContext: {
    game: string;
    car: string;
    track: string;
    trackTemp: string;
    airTemp: string;
    tyreCompound: string;
    fuelLoad: string;
    handlingIssue: string;
  }) => void;
}

const telLoadingMessages = [
  "Ingesting MoTeC telemetry channels…",
  "Computing trail-braking pressure decay rate…",
  "Analyzing steering scrub vs yaw response…",
  "Assessing 4-corner tyre thermals & pressures…",
  "Chief Race Engineer formulating adaptive setup…",
];

export const TelemetryAnalyzer: React.FC<TelemetryAnalyzerProps> = ({
  onLoadingChange,
  onApplyToSetup,
}) => {
  // Session & Vehicle Spec
  const [game, setGame] = useState("Assetto Corsa Competizione");
  const [car, setCar] = useState("Ferrari 296 GT3");
  const [track, setTrack] = useState("Spa-Francorchamps GP");
  const [sessionType, setSessionType] = useState("Practice / Hotlap");
  const [weather, setWeather] = useState("Dry");
  const [trackTemp, setTrackTemp] = useState("30°C");
  const [airTemp, setAirTemp] = useState("22°C");
  const [tyreCompound, setTyreCompound] = useState("DHE Slick");
  const [fuelLoad, setFuelLoad] = useState("35 L");

  // Driver Style & Preferences
  const [driverStyle, setDriverStyle] = useState("Heavy Trail-Braker");
  const [balancePreference, setBalancePreference] = useState("Neutral Balance");
  const [setupTarget, setSetupTarget] = useState("Qualifying Hotlap (Peak Grip)");
  const [driverComplaint, setDriverComplaint] = useState(
    "Front wash and mid-corner understeer into Bus Stop chicane, snap oversteer on kerb exit"
  );

  // Telemetry Data State
  const [activePreset, setActivePreset] = useState("spa");
  const [parsedTelemetry, setParsedTelemetry] = useState<ParsedTelemetryFile | null>(null);
  const [referenceTelemetry, setReferenceTelemetry] = useState<ParsedTelemetryFile | null>(null);
  const [lapComparison, setLapComparison] = useState<LapComparisonSummary | null>(null);
  const [frictionCircleData, setFrictionCircleData] = useState<GGFrictionCircleData | null>(null);
  const [benchmarkMode, setBenchmarkMode] = useState<"pro" | "off">("pro");
  const [state, setState] = useState<"empty" | "loading" | "error" | "result">("empty");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<TelemetryAnalysisResult | null>(null);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Chart State
  const [activeChannel, setActiveChannel] = useState<
    "pedals" | "dualSpeed" | "timeDelta" | "steering" | "gear"
  >("pedals");
  const [hoverIndex, setHoverIndex] = useState<number>(-1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // 2D Track Map Data (Memoized based on current telemetry, circuit and lap comparison)
  const trackMapData = useMemo(() => {
    if (!parsedTelemetry) return null;
    return generateTrackMapData(parsedTelemetry, track, lapComparison);
  }, [parsedTelemetry, track, lapComparison]);

  // Copy Feedback States
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedAdaptive, setCopiedAdaptive] = useState(false);
  const [savedAdaptiveVault, setSavedAdaptiveVault] = useState(false);

  // Load Preset Handler
  const loadPreset = async (presetKey: string) => {
    setActivePreset(presetKey);

    const presets: Record<string, any> = {
      spa: {
        game: "Assetto Corsa Competizione",
        car: "Ferrari 296 GT3",
        track: "Spa-Francorchamps GP",
        weather: "Dry",
        trackTemp: "30°C",
        airTemp: "22°C",
        tyres: "DHE Slick",
        fuel: "35 L",
        driverStyle: "Heavy Trail-Braker",
        balance: "Neutral Balance",
        target: "Qualifying Hotlap (Peak Grip)",
        complaint: "Front wash and mid-corner understeer into Bus Stop chicane, snap oversteer on kerb exit",
        file: "/sample-telemetry/spa-gt3-motec.csv",
        refFile: "/sample-telemetry/spa-gt3-pro-reference.csv",
      },
      monza: {
        game: "Assetto Corsa Competizione",
        car: "Porsche 992 GT3 R",
        track: "Monza GP",
        weather: "Dry",
        trackTemp: "32°C",
        airTemp: "24°C",
        tyres: "Medium Slick",
        fuel: "28 L",
        driverStyle: "Throttle-Steerer / Power Rotator",
        balance: "Planted / Safe Rear",
        target: "Race Stint (Tire Life & Consistency)",
        complaint: "Front tyres overheating into Prima Variante braking zone, wheelspin on exit of Ascari",
        file: "/sample-telemetry/monza-gt3-motec.csv",
        refFile: "/sample-telemetry/monza-gt3-pro-reference.csv",
      },
      silverstone: {
        game: "F1 24",
        car: "Red Bull RB20",
        track: "Silverstone GP",
        weather: "Dry",
        trackTemp: "28°C",
        airTemp: "21°C",
        tyres: "Soft Slick (C3)",
        fuel: "45 L",
        driverStyle: "Momentum / Smooth Roller",
        balance: "Pointy / Loose Rotation",
        target: "Qualifying Hotlap (Peak Grip)",
        complaint: "High-speed understeer through Becketts complex, locking inside front into Brooklands",
        file: "/sample-telemetry/silverstone-f1.csv",
        refFile: "/sample-telemetry/silverstone-f1-pro-reference.csv",
      },
    };

    const cfg = presets[presetKey];
    if (!cfg) return;

    setGame(cfg.game);
    setCar(cfg.car);
    setTrack(cfg.track);
    setWeather(cfg.weather);
    setTrackTemp(cfg.trackTemp);
    setAirTemp(cfg.airTemp);
    setTyreCompound(cfg.tyres);
    setFuelLoad(cfg.fuel);
    setDriverStyle(cfg.driverStyle);
    setBalancePreference(cfg.balance);
    setSetupTarget(cfg.target);
    setDriverComplaint(cfg.complaint);

    try {
      const [resDriver, resRef] = await Promise.all([
        fetch(cfg.file),
        cfg.refFile ? fetch(cfg.refFile) : Promise.resolve(null),
      ]);

      if (!resDriver.ok) throw new Error("Could not load sample CSV.");
      const textDriver = await resDriver.text();
      const parsedDriver = parseTelemetryCSV(textDriver, `${presetKey}-driver-motec.csv`);
      setParsedTelemetry(parsedDriver);

      let parsedRefData: ParsedTelemetryFile | null = null;
      if (resRef && resRef.ok) {
        const textRef = await resRef.text();
        parsedRefData = parseTelemetryCSV(textRef, `${presetKey}-pro-reference.csv`);
        setReferenceTelemetry(parsedRefData);
        const comp = computeLapComparison(parsedDriver, parsedRefData, cfg.track);
        setLapComparison(comp);
      } else {
        setReferenceTelemetry(null);
        setLapComparison(null);
      }

      // Compute G-G Friction Circle
      try {
        const gg = computeGGFrictionCircle(parsedDriver, parsedRefData);
        setFrictionCircleData(gg);
      } catch (errGg) {
        console.warn("Could not compute G-G friction circle:", errGg);
      }
    } catch (err) {
      console.error("Failed to load preset CSV:", err);
    }
  };

  // Initial load Spa preset on mount
  useEffect(() => {
    loadPreset("spa");
  }, []);

  // Rotating loading messages
  useEffect(() => {
    if (state !== "loading") return;
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % telLoadingMessages.length);
    }, 1300);
    return () => clearInterval(interval);
  }, [state]);

  // File Upload Handlers
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseTelemetryCSV(text, file.name);
        setParsedTelemetry(parsed);
        setActivePreset("");

        if (referenceTelemetry) {
          try {
            const comp = computeLapComparison(parsed, referenceTelemetry, track);
            setLapComparison(comp);
          } catch (errComp) {
            console.warn("Could not compute lap comparison:", errComp);
            setLapComparison(null);
          }
        }

        try {
          const gg = computeGGFrictionCircle(parsed, referenceTelemetry);
          setFrictionCircleData(gg);
        } catch (errGg) {
          console.warn("Could not compute G-G friction circle:", errGg);
        }
      } catch (err: any) {
        alert(`Could not parse telemetry file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Draw MoTeC Telemetry Canvas
  useEffect(() => {
    if (!parsedTelemetry || !canvasRef.current || !wrapperRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wrapperRef.current.getBoundingClientRect();
    const width = rect.width || 760;
    const height = 240;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const points = parsedTelemetry.points;
    const maxDist = points[points.length - 1].dist || 1;
    const paddingLeft = 36;
    const paddingRight = 16;
    const paddingTop = 22;
    const paddingBottom = 26;
    const plotW = width - paddingLeft - paddingRight;
    const plotH = height - paddingTop - paddingBottom;

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = paddingTop + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      const val =
        activeChannel === "pedals"
          ? `${100 - i * 25}%`
          : activeChannel === "dualSpeed"
          ? `${320 - i * 80} km/h`
          : activeChannel === "timeDelta"
          ? `${(1.5 - i * 0.75 > 0 ? "+" : "")}${(1.5 - i * 0.75).toFixed(2)}s`
          : activeChannel === "steering"
          ? `${60 - i * 30}°`
          : `${8 - i * 2}`;
      ctx.fillText(val, paddingLeft - 6, y + 3);
    }

    // Prominent zero-line for Time Delta channel
    if (activeChannel === "timeDelta") {
      const yMid = paddingTop + plotH / 2;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.moveTo(paddingLeft, yMid);
      ctx.lineTo(width - paddingRight, yMid);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("0.00s REF (BENCHMARK PACE)", paddingLeft + 10, yMid - 4);
    }

    // Distance ticks
    for (let i = 0; i <= 5; i++) {
      const frac = i / 5;
      const x = paddingLeft + plotW * frac;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(maxDist * frac)}m`, x, height - 10);
    }

    const getX = (dist: number) => paddingLeft + (dist / maxDist) * plotW;

    // Dual Speed Shading (Delta Fill)
    if (activeChannel === "dualSpeed" && lapComparison?.deltaPoints && benchmarkMode === "pro") {
      const dPts = lapComparison.deltaPoints;
      for (let i = 0; i < dPts.length - 1; i++) {
        const p1 = dPts[i];
        const p2 = dPts[i + 1];
        const x1 = getX(p1.dist);
        const x2 = getX(p2.dist);
        const yDriver1 = paddingTop + plotH - (p1.driverSpeed / 320) * plotH;
        const yDriver2 = paddingTop + plotH - (p2.driverSpeed / 320) * plotH;
        const yRef1 = paddingTop + plotH - (p1.refSpeed / 320) * plotH;
        const yRef2 = paddingTop + plotH - (p2.refSpeed / 320) * plotH;

        ctx.beginPath();
        ctx.moveTo(x1, yDriver1);
        ctx.lineTo(x2, yDriver2);
        ctx.lineTo(x2, yRef2);
        ctx.lineTo(x1, yRef1);
        ctx.closePath();

        ctx.fillStyle = p1.speedDelta >= 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)";
        ctx.fill();
      }
    }

    // Speed trace (Driver)
    if (activeChannel === "pedals" || activeChannel === "dualSpeed" || activeChannel === "steering") {
      ctx.beginPath();
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH - (p.speed / 320) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Pro Reference Speed trace (Overlay)
    if (
      (activeChannel === "dualSpeed" || activeChannel === "pedals") &&
      benchmarkMode === "pro" &&
      referenceTelemetry
    ) {
      const refPoints = referenceTelemetry.points;
      ctx.beginPath();
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 3]);
      refPoints.forEach((rp, idx) => {
        const x = getX(rp.dist);
        const y = paddingTop + plotH - (rp.speed / 320) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Time Delta (Δt) Continuous Trace
    if (activeChannel === "timeDelta" && lapComparison?.deltaPoints) {
      const dPts = lapComparison.deltaPoints;
      const yMid = paddingTop + plotH / 2;
      const maxDt = 1.5; // ±1.5s axis scale

      // Shaded area between delta trace and zero baseline
      for (let i = 0; i < dPts.length - 1; i++) {
        const p1 = dPts[i];
        const p2 = dPts[i + 1];
        const x1 = getX(p1.dist);
        const x2 = getX(p2.dist);
        const clamp1 = Math.max(-maxDt, Math.min(maxDt, p1.timeDelta));
        const clamp2 = Math.max(-maxDt, Math.min(maxDt, p2.timeDelta));
        const y1 = yMid - (clamp1 / maxDt) * (plotH / 2);
        const y2 = yMid - (clamp2 / maxDt) * (plotH / 2);

        ctx.beginPath();
        ctx.moveTo(x1, yMid);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x2, yMid);
        ctx.closePath();

        // If timeDelta > 0 (driver took longer / time lost): red shading.
        // If timeDelta <= 0 (driver ahead / time gained): green shading.
        ctx.fillStyle = p1.timeDelta > 0 ? "rgba(244, 63, 94, 0.18)" : "rgba(16, 185, 129, 0.18)";
        ctx.fill();
      }

      // Delta trace line
      ctx.beginPath();
      ctx.lineWidth = 2.2;
      dPts.forEach((p, idx) => {
        const x = getX(p.dist);
        const clamp = Math.max(-maxDt, Math.min(maxDt, p.timeDelta));
        const y = yMid - (clamp / maxDt) * (plotH / 2);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#34D399";
      ctx.stroke();
    }

    // Pedals
    if (activeChannel === "pedals") {
      // Throttle (Green)
      ctx.beginPath();
      ctx.strokeStyle = "#10B981";
      ctx.lineWidth = 1.8;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH - (p.throttle / 100) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Brake (Red)
      ctx.beginPath();
      ctx.strokeStyle = "#F43F5E";
      ctx.lineWidth = 2;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH - (p.brake / 100) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Steering & Lateral G
    if (activeChannel === "steering") {
      // Steering (Yellow)
      ctx.beginPath();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.8;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH / 2 - (p.steer / 60) * (plotH / 2);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Lat G (Purple)
      ctx.beginPath();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.6;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH / 2 - (p.latG / 3.5) * (plotH / 2);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Gear & RPM
    if (activeChannel === "gear") {
      // Gear (Purple)
      ctx.beginPath();
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 2;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH - (p.gear / 8) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // RPM (Cyan)
      ctx.beginPath();
      ctx.strokeStyle = "#00d2be";
      ctx.lineWidth = 1.5;
      points.forEach((p, idx) => {
        const x = getX(p.dist);
        const y = paddingTop + plotH - ((p.rpm - 4000) / 5000) * plotH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Hover vertical scrubber
    if (hoverIndex >= 0 && hoverIndex < points.length) {
      const pt = points[hoverIndex];
      const x = getX(pt.dist);

      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (activeChannel === "timeDelta" && lapComparison?.deltaPoints?.[hoverIndex]) {
        const dp = lapComparison.deltaPoints[hoverIndex];
        const yMid = paddingTop + plotH / 2;
        const clamp = Math.max(-1.5, Math.min(1.5, dp.timeDelta));
        const yDelta = yMid - (clamp / 1.5) * (plotH / 2);

        ctx.beginPath();
        ctx.arc(x, yDelta, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = dp.timeDelta > 0 ? "#F43F5E" : "#10B981";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const ySpeed = paddingTop + plotH - (pt.speed / 320) * plotH;
        ctx.beginPath();
        ctx.arc(x, ySpeed, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#38BDF8";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // If benchmark speed exists at this point, draw amber circle on ref speed
        if (
          (activeChannel === "dualSpeed" || activeChannel === "pedals") &&
          benchmarkMode === "pro" &&
          lapComparison?.deltaPoints?.[hoverIndex]
        ) {
          const dp = lapComparison.deltaPoints[hoverIndex];
          const yRef = paddingTop + plotH - (dp.refSpeed / 320) * plotH;
          ctx.beginPath();
          ctx.arc(x, yRef, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#F59E0B";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }, [
    parsedTelemetry,
    referenceTelemetry,
    lapComparison,
    benchmarkMode,
    activeChannel,
    hoverIndex,
    state,
  ]);

  // Form Submit
  const handleAnalyzeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedTelemetry) {
      alert("Please upload or select telemetry data first.");
      return;
    }

    setState("loading");
    onLoadingChange(true);
    setErrorMessage("");

    try {
      const payload = {
        game,
        car,
        track,
        sessionType,
        weather,
        trackTemp,
        airTemp,
        tyreCompound,
        fuelLoad,
        driverStyle,
        balancePreference,
        setupTarget,
        driverComplaint,
        summaryMetrics: {
          lapTime: parsedTelemetry.lapTime,
          topSpeed: parsedTelemetry.topSpeed,
          minSpeed: parsedTelemetry.minSpeed,
          maxLatG: parsedTelemetry.maxLatG,
          maxDecelG: parsedTelemetry.maxDecelG,
          minCornerSpeeds: parsedTelemetry.minCornerSpeeds,
          trailBrakingScore: parsedTelemetry.trailBrakingScore,
          throttleSmoothness: parsedTelemetry.throttleSmoothness,
          steeringScrub: parsedTelemetry.steeringScrub,
          tyres: parsedTelemetry.tyreStats,
        },
        sampledPoints: parsedTelemetry.points.slice(0, 45),
        anomalies: parsedTelemetry.detectedAnomalies,
        lapComparison: benchmarkMode === "pro" && lapComparison ? lapComparison : undefined,
        frictionCircle: frictionCircleData
          ? {
              gripUtilizationPct: frictionCircleData.gripUtilizationPct,
              trailBrakingTransitionEfficiency: frictionCircleData.trailBrakingTransitionEfficiency,
              peakCombinedG: frictionCircleData.peakCombinedG,
              peakLatG: frictionCircleData.peakLatG,
              peakDecelG: frictionCircleData.peakDecelG,
              quadrantStats: frictionCircleData.quadrantStats,
              verdict: frictionCircleData.gripDeficitVerdict,
            }
          : undefined,
      };

      const res = await fetch("/api/analyze-telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze telemetry.");
      }

      if (lapComparison && !data.lapComparison) {
        data.lapComparison = lapComparison;
      }
      if (frictionCircleData && !data.frictionCircle) {
        data.frictionCircle = frictionCircleData;
      }

      setResult(data);
      setState("result");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to analyze telemetry.");
      setState("error");
    } finally {
      onLoadingChange(false);
    }
  };

  // Copy Handlers
  const handleCopyReport = () => {
    if (!result) return;
    let text = `SIM SETUP AI // TELEMETRY DIAGNOSTIC REPORT\n`;
    text += `${car.toUpperCase()} @ ${track.toUpperCase()} (MoTeC Ingest)\n`;
    text += `${"=".repeat(50)}\n\n`;
    text += `[VERDICT & PACE DELTA]\n`;
    text += `Overall Score: ${result.overallScore}/100\n`;
    text += `Observed Lap: ${result.lapTimeObserved || parsedTelemetry?.lapTime}\n`;
    text += `Achievable Potential Delta: ${result.estimatedTimeLost || "-0.85s"}\n`;
    text += `Primary Limiter: ${result.primaryLimiter}\n\n`;

    if (frictionCircleData) {
      text += `[G-G FRICTION CIRCLE & GRIP ENVELOPE]\n`;
      text += `Grip Utilization Index: ${frictionCircleData.gripUtilizationPct}%\n`;
      text += `Transition Quality: ${frictionCircleData.trailBrakingTransitionEfficiency}/100\n`;
      text += `Peak Combined Vector: ${frictionCircleData.peakCombinedG} G | Peak Decel: ${frictionCircleData.peakDecelG} G\n`;
      text += `Diagnosis: ${frictionCircleData.gripDeficitVerdict}\n\n`;
    }

    if (lapComparison && benchmarkMode === "pro") {
      text += `[PRO BENCHMARK COMPARISON]\n`;
      text += `Reference Lap: ${lapComparison.refLapTime} (Pro Benchmark)\n`;
      text += `Pace Delta: ${lapComparison.totalTimeDeltaSeconds > 0 ? "+" : ""}${lapComparison.totalTimeDeltaSeconds}s · Top Speed Delta: ${lapComparison.topSpeedDeltaKmh > 0 ? "+" : ""}${lapComparison.topSpeedDeltaKmh} km/h\n`;
      text += `Corner Attribution:\n`;
      lapComparison.cornerComparisons.forEach((cc) => {
        text += `• ${cc.corner} (@${cc.dist}m): Δv ${cc.speedDelta > 0 ? "+" : ""}${cc.speedDelta} km/h | Δt ${cc.timeDelta > 0 ? "+" : ""}${cc.timeDelta}s | Brk: ${cc.brakingPointDeltaMeters > 0 ? "+" : ""}${cc.brakingPointDeltaMeters}m | Thr: ${cc.throttleCommitDeltaMeters > 0 ? "+" : ""}${cc.throttleCommitDeltaMeters}m\n  ${cc.verdict}\n`;
      });
      text += `\n`;
    }

    text += `[EXECUTIVE SUMMARY]\n${result.executiveSummary}\n\n`;

    (result.cornerBreakdowns || []).forEach((c) => {
      text += `• ${c.corner} (${c.timeDelta})\n  Flaw: ${c.driverInput}\n  Reaction: ${c.chassisResponse}\n  Fix: ${c.actionableFix}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    });
  };

  const handleCopyAdaptiveSetup = () => {
    if (!result || !result.adaptiveSetup) return;
    let text = `SIM SETUP AI // TELEMETRY-CALIBRATED ADAPTIVE SETUP SPEC\n`;
    text += `${car.toUpperCase()} @ ${track.toUpperCase()}\n`;
    text += `Tuned for: ${driverStyle} · ${balancePreference}\n`;
    text += `${"=".repeat(55)}\n\n`;

    if (result.adaptiveSetup.philosophy) {
      text += `[ADAPTIVE PHILOSOPHY]\n${result.adaptiveSetup.philosophy}\n\n`;
    }

    (result.adaptiveSetup.sections || []).forEach((sec) => {
      text += `[${sec.title.toUpperCase()}]\n`;
      (sec.items || []).forEach((item) => {
        text += `  • ${item.label}: ${item.value}\n`;
        if (item.styleNote) {
          text += `    ↳ Style Tuning: ${item.styleNote}\n`;
        }
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopiedAdaptive(true);
      setTimeout(() => setCopiedAdaptive(false), 2000);
    });
  };

  const handleSaveAdaptiveToVault = () => {
    if (!result || !result.adaptiveSetup) return;
    saveSetupToVault({
      name: `${car} - ${track} (Adaptive ${driverStyle})`,
      game,
      car,
      track,
      sessionType,
      weather,
      trackTemp,
      airTemp,
      tyreCompound,
      fuelLoad,
      driverStyle,
      summary: result.adaptiveSetup.philosophy,
      engineerNotes: result.pitRadioMessage,
      sections: result.adaptiveSetup.sections || [],
    });
    setSavedAdaptiveVault(true);
    setTimeout(() => setSavedAdaptiveVault(false), 2500);
  };

  const handleApplyToSetupClick = () => {
    if (!result) return;
    const adjSummary = (result.setupAdjustments || [])
      .map((a) => `${a.component}: ${a.adjustment}`)
      .join(", ");

    onApplyToSetup({
      game,
      car,
      track,
      trackTemp,
      airTemp,
      tyreCompound,
      fuelLoad,
      handlingIssue: `Diagnosed via Telemetry: ${result.primaryLimiter || "Handling imbalance"}. Tweaks: ${adjSummary}`,
    });
  };

  const hoverPoint =
    hoverIndex >= 0 && parsedTelemetry?.points[hoverIndex]
      ? parsedTelemetry.points[hoverIndex]
      : null;

  const hoverDeltaPoint =
    hoverIndex >= 0 && lapComparison?.deltaPoints?.[hoverIndex]
      ? lapComparison.deltaPoints[hoverIndex]
      : null;

  return (
    <div className="layout layout-telemetry">
      {/* LEFT PANEL: INGEST & PROFILE */}
      <section className="panel form-panel glass-card">
        <div className="panel-header">
          <div className="panel-tag-group">
            <span className="panel-num">01</span>
            <div className="panel-label-group">
              <span className="panel-label">TELEMETRY INGEST</span>
              <span className="panel-sublabel">CHANNELS, CAR SPEC & TRACK CONDITIONS</span>
            </div>
          </div>
          <div className="panel-telemetry-badge">
            <span className="badge-dot badge-dot-cyan"></span> MOTEC / CSV READY
          </div>
        </div>

        <form onSubmit={handleAnalyzeSubmit} autoComplete="off">
          {/* Section 1: Platform & Vehicle */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 17h14M4 14l2-6h12l2 6M6 17a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            01 // VEHICLE & CIRCUIT SPECIFICATION
          </div>

          <div className="field">
            <label htmlFor="telGame">
              <span>Sim title</span>
              <span className="field-hint">Physics simulation platform</span>
            </label>
            <div className="select-wrapper">
              <select id="telGame" value={game} onChange={(e) => setGame(e.target.value)} required>
                <option>Assetto Corsa Competizione</option>
                <option>iRacing</option>
                <option>Assetto Corsa</option>
                <option>rFactor 2</option>
                <option>Automobilista 2</option>
                <option>Le Mans Ultimate</option>
                <option>F1 24</option>
                <option>F1 25</option>
                <option>Gran Turismo 7</option>
                <option>RaceRoom Racing Experience</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="telCar">
                <span>Car / Class</span>
                <span className="field-hint">Chassis specification</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telCar"
                  type="text"
                  value={car}
                  onChange={(e) => setCar(e.target.value)}
                  placeholder="e.g. Ferrari 296 GT3"
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="telTrack">
                <span>Track / Layout</span>
                <span className="field-hint">Circuit configuration</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telTrack"
                  type="text"
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  placeholder="e.g. Spa-Francorchamps GP"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Session & Conditions */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeLinecap="round" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            02 // SESSION & AMBIENT CONDITIONS
          </div>

          <div className="field">
            <label>
              <span>Session profile</span>
              <span className="field-hint">Target run context</span>
            </label>
            <div className="segmented">
              {["Practice / Hotlap", "Qualifying", "Race Stint"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`seg-btn ${sessionType === st ? "active" : ""}`}
                  onClick={() => setSessionType(st)}
                >
                  <span className="seg-indicator"></span>{st.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>
              <span>Track condition</span>
              <span className="field-hint">Asphalt grip state</span>
            </label>
            <div className="segmented">
              {[
                { val: "Dry", cls: "dry" },
                { val: "Damp", cls: "damp" },
                { val: "Wet", cls: "wet" },
              ].map((w) => (
                <button
                  key={w.val}
                  type="button"
                  className={`seg-btn ${weather === w.val ? "active" : ""}`}
                  onClick={() => setWeather(w.val)}
                >
                  <span className={`weather-indicator ${w.cls}`}></span>{w.val}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="telTrackTemp">
                <span>Track temp</span>
                <span className="field-hint">Surface reading</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telTrackTemp"
                  type="text"
                  value={trackTemp}
                  onChange={(e) => setTrackTemp(e.target.value)}
                  placeholder="e.g. 30°C"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="telAirTemp">
                <span>Air temp</span>
                <span className="field-hint">Ambient temperature</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telAirTemp"
                  type="text"
                  value={airTemp}
                  onChange={(e) => setAirTemp(e.target.value)}
                  placeholder="e.g. 22°C"
                />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="telTyreCompound">
                <span>Tyre compound</span>
                <span className="field-hint">Rubber spec</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telTyreCompound"
                  type="text"
                  value={tyreCompound}
                  onChange={(e) => setTyreCompound(e.target.value)}
                  placeholder="e.g. Medium Slick"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="telFuelLoad">
                <span>Fuel load</span>
                <span className="field-hint">Stint fuel</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="telFuelLoad"
                  type="text"
                  value={fuelLoad}
                  onChange={(e) => setFuelLoad(e.target.value)}
                  placeholder="e.g. 35 L"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Telemetry Data Upload */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            03 // TELEMETRY DATA INGEST
          </div>

          {/* Dropzone */}
          <div
            className="telemetry-dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
            }}
          >
            <input
              type="file"
              id="telFileInput"
              accept=".csv,.json,.txt,.motec"
              className="hidden-file-input"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            <div className="dropzone-content">
              <div className="dropzone-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                </svg>
              </div>
              <div className="dropzone-text">
                <span className="dropzone-primary">Drag & drop your Telemetry file</span>
                <span className="dropzone-sub">
                  Supports <strong>MoTeC i2 CSV</strong>, <strong>Popometer</strong>, <strong>ACC Telemetry</strong>, <strong>iRacing</strong> & <strong>JSON</strong> logs
                </span>
              </div>
              <button
                type="button"
                className="dropzone-browse-btn"
                onClick={() => document.getElementById("telFileInput")?.click()}
              >
                Browse Files
              </button>
            </div>
          </div>

          {/* Loaded File Card */}
          {parsedTelemetry && (
            <div className="telemetry-file-card">
              <div className="file-card-header">
                <div className="file-card-info">
                  <span className="file-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  <div>
                    <div className="file-name">{parsedTelemetry.filename}</div>
                    <div className="file-meta">
                      {parsedTelemetry.rawCount.toLocaleString()} telemetry points · Lap Time: {parsedTelemetry.lapTime}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="file-clear-btn"
                  onClick={() => setParsedTelemetry(null)}
                >
                  ✕
                </button>
              </div>
              <div className="detected-channels">
                {["Speed", "Throttle", "Brake", "Steering", "Gear", "Tyre Temps", "G-Force"].map((ch) => (
                  <span key={ch} className="channel-pill">{ch}</span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Demo Presets */}
          <div className="demo-telemetry-box">
            <div className="demo-box-label">
              <span className="demo-dot"></span>
              <span>Calibrated Telemetry Stints</span>
            </div>
            <div className="demo-presets-row">
              <button
                type="button"
                className={`demo-btn ${activePreset === "spa" ? "active" : ""}`}
                onClick={() => loadPreset("spa")}
              >
                <div className="demo-btn-top">
                  <span className="demo-btn-title">Spa-Francorchamps</span>
                  {activePreset === "spa" && <span className="demo-active-pill">ACTIVE</span>}
                </div>
                <div className="demo-btn-meta">
                  <span>Ferrari 296 GT3</span>
                  <span className="demo-laptime">2:17.482</span>
                </div>
              </button>

              <button
                type="button"
                className={`demo-btn ${activePreset === "monza" ? "active" : ""}`}
                onClick={() => loadPreset("monza")}
              >
                <div className="demo-btn-top">
                  <span className="demo-btn-title">Monza GP</span>
                  {activePreset === "monza" && <span className="demo-active-pill">ACTIVE</span>}
                </div>
                <div className="demo-btn-meta">
                  <span>Porsche 992 GT3 R</span>
                  <span className="demo-laptime">1:47.310</span>
                </div>
              </button>

              <button
                type="button"
                className={`demo-btn ${activePreset === "silverstone" ? "active" : ""}`}
                onClick={() => loadPreset("silverstone")}
              >
                <div className="demo-btn-top">
                  <span className="demo-btn-title">Silverstone GP</span>
                  {activePreset === "silverstone" && <span className="demo-active-pill">ACTIVE</span>}
                </div>
                <div className="demo-btn-meta">
                  <span>Red Bull F1</span>
                  <span className="demo-laptime">1:28.150</span>
                </div>
              </button>
            </div>
          </div>

          {/* Section 4: Driver Style & Setup Preferences */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            04 // DRIVER STYLE & CHASSIS PREFERENCES
          </div>

          <div className="field">
            <label>
              <span>Natural driving style profile</span>
              <span className="field-hint">Your braking & rotation DNA</span>
            </label>
            <div className="segmented segmented-wrap">
              {[
                "Heavy Trail-Braker",
                "Momentum / Smooth Roller",
                "Throttle-Steerer / Power Rotator",
                "Point & Squirt",
              ].map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`seg-btn ${driverStyle === style ? "active" : ""}`}
                  onClick={() => setDriverStyle(style)}
                >
                  <span className="seg-indicator"></span>{style.split(" / ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                <span>Chassis balance preference</span>
                <span className="field-hint">Rear rotation margin</span>
              </label>
              <div className="segmented">
                {[
                  { val: "Planted / Safe Rear", label: "Planted" },
                  { val: "Neutral Balance", label: "Neutral" },
                  { val: "Pointy / Loose Rotation", label: "Loose" },
                ].map((b) => (
                  <button
                    key={b.val}
                    type="button"
                    className={`seg-btn ${balancePreference === b.val ? "active" : ""}`}
                    onClick={() => setBalancePreference(b.val)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>
                <span>Tuning objective</span>
                <span className="field-hint">Pace vs endurance</span>
              </label>
              <div className="segmented">
                {[
                  { val: "Qualifying Hotlap (Peak Grip)", label: "Quali Hotlap" },
                  { val: "Race Stint (Tire Life & Consistency)", label: "Race Stint" },
                ].map((tgt) => (
                  <button
                    key={tgt.val}
                    type="button"
                    className={`seg-btn ${setupTarget === tgt.val ? "active" : ""}`}
                    onClick={() => setSetupTarget(tgt.val)}
                  >
                    {tgt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="telDriverComplaint">
              <span>Driver feedback / Target goal</span>
              <span className="field-hint">Specific complaint or time target</span>
            </label>
            <div className="textarea-wrapper">
              <textarea
                id="telDriverComplaint"
                rows={2}
                value={driverComplaint}
                onChange={(e) => setDriverComplaint(e.target.value)}
                placeholder="e.g. Understeer at apex in slow corners, snap oversteer on curb exit"
              />
            </div>
          </div>

          {/* Primary Action Button */}
          <button type="submit" className="generate-btn generate-btn-telemetry" disabled={state === "loading"}>
            <span className="btn-sheen" aria-hidden="true"></span>
            <div className="btn-content">
              <span className="btn-spinner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M12 3a9 9 0 019 9" strokeLinecap="round" />
                </svg>
              </span>
              <span className="btn-label">Analyze Telemetry & Synthesize Setup</span>
              <span className="btn-flag" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
            </div>
            <span className="btn-badge btn-badge-cyan">ADAPTIVE CHASSIS SYNTHESIS</span>
          </button>
        </form>
      </section>

      {/* RIGHT PANEL: TELEMETRY DIAGNOSTIC SUITE & AI RACE ENGINEER */}
      <section className="panel output-panel glass-card">
        <div className="panel-header">
          <div className="panel-tag-group">
            <span className="panel-num">02</span>
            <div className="panel-label-group">
              <span className="panel-label">TELEMETRY DIAGNOSTIC SUITE</span>
              <span className="panel-sublabel">CHIEF PERFORMANCE & RACE ENGINEER GUIDANCE</span>
            </div>
          </div>
          {state === "result" && result && (
            <div className="sheet-actions">
              <button type="button" className="action-btn" onClick={handleCopyReport}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                <span>{copiedReport ? "COPIED ✓" : "COPY REPORT"}</span>
              </button>
              <button type="button" className="action-btn" onClick={handleApplyToSetupClick}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <span>APPLY TO SETUP</span>
              </button>
              {result.adaptiveSetup && (
                <SetupExportModal
                  buttonLabel="EXPORT SETUP"
                  context={{
                    game,
                    car,
                    track,
                    sessionType,
                    weather,
                    trackTemp,
                    airTemp,
                    fuelLoad,
                    tyreCompound,
                    driverStyle,
                    summary: result.adaptiveSetup.philosophy,
                    sections: result.adaptiveSetup.sections || [],
                    engineerNotes: result.pitRadioMessage,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* State: Empty Standby */}
        {state === "empty" && (
          <div className="empty-state">
            <div className="chassis-schematic" aria-hidden="true">
              <svg viewBox="0 0 240 140" fill="none" className="w-full h-auto text-slate-600">
                <line x1="20" y1="20" x2="220" y2="20" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="20" y1="50" x2="220" y2="50" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="20" y1="80" x2="220" y2="80" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="20" y1="110" x2="220" y2="110" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <path d="M 20 40 Q 50 25 80 75 T 130 30 T 170 85 T 220 35" stroke="#38BDF8" strokeWidth="1.8" fill="none" />
                <path d="M 20 110 L 60 110 L 70 120 L 100 120 L 110 110 L 150 110 L 160 120 L 180 120 L 190 110 L 220 110" stroke="#10B981" strokeWidth="1.5" fill="none" />
                <path d="M 65 120 L 75 80 L 95 120 M 155 120 L 165 75 L 180 120" stroke="#F43F5E" strokeWidth="1.5" fill="none" />
              </svg>
            </div>
            <div className="empty-text-wrap">
              <h3 className="empty-title">TELEMETRY DIAGNOSTICS STANDBY</h3>
              <p className="empty-description">
                Upload your MoTeC CSV / JSON log or select a demo stint on the left.<br />
                The race engineer will plot your speed and pedal traces, calculate trail-braking linearity, diagnose chassis balance, and synthesize an adaptive setup sheet.
              </p>
            </div>
            <div className="empty-specs-strip">
              <span className="spec-node"><span className="spec-dot"></span>MULTI-CHANNEL OVERLAY</span>
              <span className="spec-node"><span className="spec-dot"></span>TRAIL-BRAKING LINEARITY</span>
              <span className="spec-node"><span className="spec-dot"></span>ADAPTIVE SETUP SYNTHESIS</span>
            </div>
          </div>
        )}

        {/* State: Loading */}
        {state === "loading" && (
          <div className="loading-state">
            <div className="loading-visual">
              <div className="loading-pulse-ring" aria-hidden="true"></div>
              <div className="loading-data-wrap">
                <div className="loading-status-badge">AI TELEMETRY COMPUTATION</div>
                <p className="loading-text">{telLoadingMessages[loadingTextIndex]}</p>
                <div className="loading-sub">Analyzing steering scrub, trail-braking pressure decay, and chassis balance</div>
              </div>
            </div>
          </div>
        )}

        {/* State: Error */}
        {state === "error" && (
          <div className="error-state">
            ⚠ {errorMessage}
          </div>
        )}

        {/* State: Result */}
        {state === "result" && result && (
          <div className="result-state">
            {/* 1. Score & Overview Banner */}
            <div className="telemetry-score-card">
              <div className="score-card-main">
                <div className="score-dial-wrap">
                  <div className="score-dial">
                    <span className="score-number">{result.overallScore}</span>
                    <span className="score-max">/100</span>
                  </div>
                  <span className="score-label">TELEMETRY SCORE</span>
                </div>
                <div className="score-details">
                  <div className="score-tags-row">
                    <span className="tag-laptime">
                      LAP: {result.lapTimeObserved || parsedTelemetry?.lapTime}
                    </span>
                    <span className="tag-delta">
                      {result.estimatedTimeLost ? `${result.estimatedTimeLost} TIME ON TABLE` : "-0.85s TIME ON TABLE"}
                    </span>
                    <span className="tag-limiter">
                      {result.primaryLimiter || "APEX UNDERSTEER & BRAKE DUMP"}
                    </span>
                  </div>
                  <h3 className="score-verdict-title">{result.verdictTitle}</h3>
                  <p className="score-summary">{result.executiveSummary}</p>
                </div>
              </div>
            </div>

            {/* Pro Benchmark Comparison Strip */}
            {lapComparison && (
              <div className="benchmark-strip">
                <div className="benchmark-info">
                  <span className="benchmark-badge">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    PRO BENCHMARK OVERLAY
                  </span>
                  <span className="benchmark-metric">
                    Driver: <strong>{result.lapTimeObserved || parsedTelemetry?.lapTime}</strong> vs Pro: <strong>{lapComparison.refLapTime}</strong>
                  </span>
                  <span className={`benchmark-delta-pill ${lapComparison.totalTimeDeltaSeconds > 0 ? "loss" : "gain"}`}>
                    Δt: {lapComparison.totalTimeDeltaSeconds > 0 ? `+${lapComparison.totalTimeDeltaSeconds}s` : `${lapComparison.totalTimeDeltaSeconds}s`}
                  </span>
                  <span className={`benchmark-delta-pill ${lapComparison.topSpeedDeltaKmh >= 0 ? "gain" : "loss"}`}>
                    Δv Top: {lapComparison.topSpeedDeltaKmh > 0 ? `+${lapComparison.topSpeedDeltaKmh}` : lapComparison.topSpeedDeltaKmh} km/h
                  </span>
                </div>
                <div className="benchmark-toggle-group">
                  <button
                    type="button"
                    className={`benchmark-toggle-btn ${benchmarkMode === "pro" ? "active" : ""}`}
                    onClick={() => setBenchmarkMode(benchmarkMode === "pro" ? "off" : "pro")}
                  >
                    <span className="toggle-dot dot-dualspeed"></span>
                    {benchmarkMode === "pro" ? "Overlay Active" : "Overlay Muted"}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Interactive MoTeC Telemetry Chart */}
            <div className="telemetry-chart-module glass-card-nested">
              <div className="chart-header">
                <div className="chart-title-group">
                  <span className="chart-title">MOTEC MULTI-CHANNEL TELEMETRY HUD</span>
                  <span className="chart-sub">SYNCHRONIZED DISTANCE TRACE WITH LIVE HOVER SCRUBBER</span>
                </div>
                <div className="chart-channel-toggles">
                  {[
                    { key: "pedals", label: "Speed & Pedals", dot: "dot-speed" },
                    { key: "dualSpeed", label: "Dual Speed Overlay", dot: "dot-dualspeed" },
                    { key: "timeDelta", label: "Time Delta (Δt)", dot: "dot-timedelta" },
                    { key: "steering", label: "Steering & Lat G", dot: "dot-steer" },
                    { key: "gear", label: "Gear & RPM", dot: "dot-gear" },
                  ].map((ch) => (
                    <button
                      key={ch.key}
                      type="button"
                      className={`channel-toggle-btn ${activeChannel === ch.key ? "active" : ""}`}
                      onClick={() => setActiveChannel(ch.key as any)}
                    >
                      <span className={`toggle-dot ${ch.dot}`}></span>{ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="canvas-wrapper"
                ref={wrapperRef}
                onMouseMove={(e) => {
                  if (!parsedTelemetry || !wrapperRef.current) return;
                  const rect = wrapperRef.current.getBoundingClientRect();
                  const mouseX = e.clientX - rect.left;
                  const frac = Math.max(0, Math.min(1, (mouseX - 36) / (rect.width - 52)));
                  setHoverIndex(Math.round(frac * (parsedTelemetry.points.length - 1)));
                }}
                onMouseLeave={() => setHoverIndex(-1)}
              >
                <canvas ref={canvasRef} />
                {hoverPoint && (
                  <div className="telemetry-hover-hud">
                    <div className="hud-dist">Dist: {hoverPoint.dist}m</div>
                    <div className="hud-val hud-speed">Driver: {hoverPoint.speed} km/h</div>
                    {benchmarkMode === "pro" && hoverDeltaPoint && (
                      <>
                        <div className="hud-val hud-ref">Ref: {hoverDeltaPoint.refSpeed} km/h</div>
                        <div className={`hud-val ${hoverDeltaPoint.speedDelta >= 0 ? "hud-delta-neg" : "hud-delta-pos"}`}>
                          Δv: {hoverDeltaPoint.speedDelta > 0 ? "+" : ""}{hoverDeltaPoint.speedDelta} km/h
                        </div>
                        <div className={`hud-val ${hoverDeltaPoint.timeDelta <= 0 ? "hud-delta-neg" : "hud-delta-pos"}`}>
                          Δt: {hoverDeltaPoint.timeDelta > 0 ? "+" : ""}{hoverDeltaPoint.timeDelta}s
                        </div>
                      </>
                    )}
                    <div className="hud-val hud-throttle">Thr: {hoverPoint.throttle}%</div>
                    <div className="hud-val hud-brake">Brk: {hoverPoint.brake}%</div>
                    <div className="hud-val hud-steer">Steer: {hoverPoint.steer}°</div>
                    <div className="hud-val hud-gear">Gear: {hoverPoint.gear}</div>
                  </div>
                )}
              </div>

              <div className="chart-footer-legend">
                <span className="legend-item"><span className="legend-line line-speed"></span> Driver Speed (km/h)</span>
                {benchmarkMode === "pro" && referenceTelemetry && (
                  <span className="legend-item"><span className="legend-line line-ref"></span> Pro Benchmark Speed</span>
                )}
                {activeChannel === "timeDelta" ? (
                  <>
                    <span className="legend-item"><span className="legend-line line-delta-neg"></span> Ahead / Gaining (Δt &lt; 0)</span>
                    <span className="legend-item"><span className="legend-line line-delta-pos"></span> Behind / Losing (Δt &gt; 0)</span>
                  </>
                ) : (
                  <>
                    <span className="legend-item"><span className="legend-line line-throttle"></span> Throttle (0-100%)</span>
                    <span className="legend-item"><span className="legend-line line-brake"></span> Brake (0-100%)</span>
                    <span className="legend-item"><span className="legend-line line-steer"></span> Steering Angle</span>
                    <span className="legend-item"><span className="legend-line line-latg"></span> Lateral G</span>
                  </>
                )}
              </div>
            </div>

            {/* 2D GPS Circuit Trace & Racing Line Visualizer */}
            {trackMapData && (
              <TrackMap2D
                data={trackMapData}
                hoverIndex={hoverIndex}
                onHoverPoint={setHoverIndex}
                lapComparison={lapComparison}
                benchmarkMode={benchmarkMode}
              />
            )}

            {/* Turn-by-Turn Pro Benchmark Delta Attribution Table */}
            {benchmarkMode === "pro" && lapComparison && (
              <div className="delta-table-module glass-card-nested">
                <div className="module-header">
                  <div className="module-title-group">
                    <span className="module-title">PRO BENCHMARK TURN-BY-TURN DELTA ATTRIBUTION</span>
                    <span className="module-sub">APEX SPEED · BRAKING POINT · THROTTLE COMMITMENT · TIME DELTA</span>
                  </div>
                  <div className="benchmark-badge">
                    <span className="demo-dot"></span>
                    GHOST REF: {lapComparison.refLapTime} ({lapComparison.totalTimeDeltaSeconds > 0 ? `+${lapComparison.totalTimeDeltaSeconds}s` : `${lapComparison.totalTimeDeltaSeconds}s`})
                  </div>
                </div>
                <div className="delta-table-wrapper">
                  <table className="delta-table">
                    <thead>
                      <tr>
                        <th>Corner / Apex</th>
                        <th>Driver Apex</th>
                        <th>Benchmark Apex</th>
                        <th>Apex Speed Δ</th>
                        <th>Braking Point</th>
                        <th>Throttle Commit</th>
                        <th>Sector Δt</th>
                        <th>Engineering Attribution & Verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lapComparison.cornerComparisons.map((c, idx) => (
                        <tr key={idx}>
                          <td className="delta-corner-cell">
                            {c.corner}
                            <span className="delta-dist-sub">@{c.dist}m</span>
                          </td>
                          <td className="delta-speed-val">{c.driverMinSpeed} km/h</td>
                          <td className="delta-speed-val">{c.refMinSpeed} km/h</td>
                          <td className={`delta-diff ${c.speedDelta >= 0 ? "gain" : "loss"}`}>
                            {c.speedDelta > 0 ? `+${c.speedDelta}` : c.speedDelta} km/h
                          </td>
                          <td className={`delta-diff ${c.brakingPointDeltaMeters >= 0 ? "gain" : "loss"}`}>
                            {c.brakingPointDeltaMeters > 0 ? `+${c.brakingPointDeltaMeters}m early` : c.brakingPointDeltaMeters < 0 ? `${Math.abs(c.brakingPointDeltaMeters)}m late` : "Matched"}
                          </td>
                          <td className={`delta-diff ${c.throttleCommitDeltaMeters >= 0 ? "gain" : "loss"}`}>
                            {c.throttleCommitDeltaMeters > 0 ? `${c.throttleCommitDeltaMeters}m earlier` : c.throttleCommitDeltaMeters < 0 ? `${Math.abs(c.throttleCommitDeltaMeters)}m delayed` : "Matched"}
                          </td>
                          <td className={`delta-diff ${c.timeDelta <= 0 ? "gain" : "loss"}`}>
                            {c.timeDelta > 0 ? `+${c.timeDelta}s` : `${c.timeDelta}s`}
                          </td>
                          <td className="delta-verdict-cell">{c.verdict}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* G-G Friction Circle & Grip Envelope Module */}
            {frictionCircleData && (
              <GGFrictionCircle data={frictionCircleData} hoverIndex={hoverIndex} />
            )}

            {/* 3. 4-Corner Tyre Thermal HUD */}
            {parsedTelemetry?.tyreStats && (
              <div className="telemetry-tyres-module glass-card-nested">
                <div className="module-header">
                  <span className="module-title">4-CORNER TYRE DYNAMICS & THERMAL SPREAD</span>
                  <span className="module-badge">HOT PRESSURES & CAMBER SPREAD</span>
                </div>
                <div className="tyres-hud-grid">
                  <div className="tyre-pod tyre-fl">
                    <div className="tyre-header">
                      <span className="tyre-pos">FRONT LEFT</span>
                      <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.FL.temp}</div>
                    <div className="tyre-imo">IMO: 86° / 84° / 81°</div>
                    <div className="tyre-press">{parsedTelemetry.tyreStats.FL.pressure} <span>(+0.2)</span></div>
                  </div>
                  <div className="tyre-pod tyre-fr">
                    <div className="tyre-header">
                      <span className="tyre-pos">FRONT RIGHT</span>
                      <span className="tyre-status-badge badge-warm">LOAD AXIS</span>
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.FR.temp}</div>
                    <div className="tyre-imo">IMO: 89° / 86° / 83°</div>
                    <div className="tyre-press">{parsedTelemetry.tyreStats.FR.pressure} <span>(+0.5)</span></div>
                  </div>
                  <div className="tyre-pod tyre-rl">
                    <div className="tyre-header">
                      <span className="tyre-pos">REAR LEFT</span>
                      <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.RL.temp}</div>
                    <div className="tyre-imo">IMO: 83° / 81° / 79°</div>
                    <div className="tyre-press">{parsedTelemetry.tyreStats.RL.pressure} <span>(0.0)</span></div>
                  </div>
                  <div className="tyre-pod tyre-rr">
                    <div className="tyre-header">
                      <span className="tyre-pos">REAR RIGHT</span>
                      <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.RR.temp}</div>
                    <div className="tyre-imo">IMO: 85° / 83° / 81°</div>
                    <div className="tyre-press">{parsedTelemetry.tyreStats.RR.pressure} <span>(+0.2)</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. KPI Progress Grid */}
            <div className="telemetry-kpis-grid">
              {(result.kpiRatings || []).map((kpi, idx) => {
                const statusClass =
                  kpi.status.toLowerCase().includes("good") || kpi.status.toLowerCase().includes("optimal")
                    ? "status-good"
                    : kpi.status.toLowerCase().includes("fair")
                    ? "status-fair"
                    : "status-needs-work";

                return (
                  <div key={idx} className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-name">{kpi.name}</span>
                      <span className={`kpi-score-badge ${statusClass}`}>
                        {kpi.status} ({kpi.score}%)
                      </span>
                    </div>
                    <div className="kpi-bar-wrap">
                      <div className="kpi-bar-fill" style={{ width: `${kpi.score}%` }}></div>
                    </div>
                    <div className="kpi-feedback">{kpi.feedback}</div>
                  </div>
                );
              })}
            </div>

            {/* 5. Turn-by-Turn Telemetry Anomalies */}
            <div className="telemetry-corners-module">
              <div className="module-header">
                <span className="module-title">TURN-BY-TURN TELEMETRY ANOMALIES & DELTA ANALYSIS</span>
                <span className="module-badge">SECTOR BREAKDOWNS</span>
              </div>
              <div className="corners-list">
                {(result.cornerBreakdowns || []).map((c, idx) => (
                  <div key={idx} className="corner-anomaly-card">
                    <div className="corner-card-header">
                      <span className="corner-title">{c.corner}</span>
                      <span className="corner-delta">{c.timeDelta}</span>
                    </div>
                    <div className="corner-grid">
                      <div className="corner-col">
                        <span className="corner-col-label">Driver Input Telemetry</span>
                        <span className="corner-col-text">{c.driverInput}</span>
                      </div>
                      <div className="corner-col">
                        <span className="corner-col-label">Chassis Dynamics Reaction</span>
                        <span className="corner-col-text">{c.chassisResponse}</span>
                      </div>
                      <div className="corner-col">
                        <span className="corner-col-label">Actionable Coach Fix</span>
                        <span className="corner-col-text"><strong>{c.actionableFix}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Driver Technique & Input Coaching */}
            <div className="driver-coaching-module glass-card-nested">
              <div className="module-header">
                <span className="module-title">DRIVER TECHNIQUE & INPUT COACHING</span>
                <span className="module-badge">PEDAL & WHEEL REFINEMENT</span>
              </div>
              <div className="coaching-grid">
                {(result.driverCoaching || []).map((dc, idx) => (
                  <div key={idx} className="coaching-card">
                    <div className="coaching-phase">
                      <span className="pulse-dot"></span>{dc.phase}
                    </div>
                    <div className="coaching-tip">{dc.tip}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. Click-by-Click Setup Adjustments */}
            <div className="setup-adjustments-module glass-card-nested">
              <div className="module-header">
                <span className="module-title">CLICK-BY-CLICK SETUP ADJUSTMENTS</span>
                <span className="module-badge">DIRECTIONAL MECHANICAL & AERO FIXES</span>
              </div>
              <div className="adjustments-grid">
                {(result.setupAdjustments || []).map((adj, idx) => (
                  <div key={idx} className="adj-card">
                    <div className="adj-header">
                      <span className="adj-comp">{adj.component}</span>
                      <span className="adj-change">{adj.adjustment}</span>
                    </div>
                    <div className="adj-rationale">{adj.rationale}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Telemetry-Calibrated Adaptive Setup Sheet */}
            {result.adaptiveSetup && (
              <div className="adaptive-setup-module glass-card-nested">
                <div className="module-header">
                  <div className="module-title-group">
                    <span className="module-title">TELEMETRY-CALIBRATED ADAPTIVE SETUP SHEET</span>
                    <span className="module-sub">CHASSIS TUNED TO COMPLEMENT YOUR NATURAL DRIVING STYLE</span>
                  </div>
                  <div className="adaptive-actions">
                    <button type="button" className="action-btn" onClick={handleCopyAdaptiveSetup}>
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      <span>{copiedAdaptive ? "COPIED ✓" : "COPY ADAPTIVE SPEC"}</span>
                    </button>

                    <button
                      type="button"
                      className={`action-btn ${savedAdaptiveVault ? "saved" : ""}`}
                      onClick={handleSaveAdaptiveToVault}
                      title="Save this adaptive setup to your local Setup Vault"
                      style={savedAdaptiveVault ? { borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399", background: "rgba(16, 185, 129, 0.1)" } : {}}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                      <span>{savedAdaptiveVault ? "SAVED TO VAULT ✓" : "SAVE TO VAULT"}</span>
                    </button>

                    <SetupExportModal
                      buttonLabel="EXPORT SIM SETUP (.JSON/.SVM)"
                      context={{
                        game,
                        car,
                        track,
                        sessionType,
                        weather,
                        trackTemp,
                        airTemp,
                        fuelLoad,
                        tyreCompound,
                        driverStyle,
                        summary: result.adaptiveSetup.philosophy,
                        sections: result.adaptiveSetup.sections || [],
                        engineerNotes: result.pitRadioMessage,
                      }}
                    />
                  </div>
                </div>

                <div className="adaptive-philosophy-card">
                  <div className="philosophy-header">
                    <span className="philosophy-tag">CHIEF ENGINEER ADAPTIVE VERDICT</span>
                    <span className="philosophy-status">STYLE MATCHED</span>
                  </div>
                  <p className="philosophy-text">{result.adaptiveSetup.philosophy}</p>
                </div>

                <div className="adaptive-setup-sections">
                  {(result.adaptiveSetup.sections || []).map((sec, idx) => (
                    <div key={idx} className="adaptive-sec-card">
                      <div className="adaptive-sec-header">
                        <span className="adaptive-sec-title">{sec.title}</span>
                        <span className="adaptive-sec-count">
                          {sec.items?.length || 0} {sec.items?.length === 1 ? "SETTING" : "SETTINGS"}
                        </span>
                      </div>
                      {(sec.items || []).map((item, j) => (
                        <div key={j} className="adaptive-item-row">
                          <div className="adaptive-item-main">
                            <span className="adaptive-item-label">{item.label}</span>
                            <span className="adaptive-item-val">{item.value}</span>
                          </div>
                          {item.styleNote && (
                            <div className="adaptive-style-note">↳ {item.styleNote}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. Pit Wall Team Radio */}
            <div className="result-notes result-notes-telemetry">
              <div className="notes-header">
                <div className="radio-signal">
                  <span className="radio-bar"></span>
                  <span className="radio-bar"></span>
                  <span className="radio-bar"></span>
                  <span className="radio-pulse"></span>
                </div>
                <div className="notes-label">PIT WALL TEAM RADIO // CHIEF ENGINEER DEBRIEF</div>
                <div className="notes-channel">DATA BUS CH 1 · SECURE</div>
              </div>
              <div className="notes-body">
                <p>{result.pitRadioMessage}</p>
              </div>
            </div>

            {/* 10. Footer Reset Button */}
            <div className="result-footer-actions">
              <button
                type="button"
                className="reset-btn"
                onClick={() => {
                  setState("empty");
                  setResult(null);
                }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
                <span>Analyze another telemetry stint</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
