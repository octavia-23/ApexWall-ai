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
import { getAuthenticTrackGeometry } from "@/lib/circuit-geometries";

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
    telemetryContext?: any;
  }) => void;
  onTelemetryAnalyzed?: (result: TelemetryAnalysisResult, file: ParsedTelemetryFile | null) => void;
  onDiscussWithEngineer?: () => void;
  onSessionChange?: (session: { car: string; track: string; game?: string }) => void;
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
  onTelemetryAnalyzed,
  onDiscussWithEngineer,
  onSessionChange,
}) => {
  // Session & Vehicle Spec
  const [game, setGame] = useState("Assetto Corsa Competizione");
  const [car, setCar] = useState("");
  const [track, setTrack] = useState("");
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
  const [activePreset, setActivePreset] = useState("");
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
  const [activeCornerId, setActiveCornerId] = useState<string | null>(null);
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
      redbullring: {
        game: "iRacing",
        car: "Mercedes-AMG GT4",
        track: "Red Bull Ring (Spielberg GP)",
        weather: "Dry",
        trackTemp: "39°C",
        airTemp: "25°C",
        tyres: "Michelin Pilot Sport GT",
        fuel: "40 L",
        driverStyle: "Heavy Trail-Braker",
        balance: "Neutral Balance",
        target: "Sprint Race (Tyre Life & Agility)",
        complaint: "Understeer on entry into Turn 3 Remus hairpin, snap oversteer across Turn 6 exit kerb",
        file: "/sample-telemetry/redbullring-amg-gt4.csv",
        refFile: "",
      },
      acevo: {
        game: "Assetto Corsa Evo",
        car: "Ferrari 296 GT3",
        track: "Autodromo Internazionale Enzo e Dino Ferrari (Imola)",
        weather: "Dry",
        trackTemp: "31°C",
        airTemp: "23°C",
        tyres: "Hard Slick",
        fuel: "30 L",
        driverStyle: "Heavy Trail-Braker",
        balance: "Neutral Balance",
        target: "Qualifying Hotlap (Peak Grip)",
        complaint: "Bottoming out on Variante Alta kerbs, understeer through Tamburello entry",
        file: "/sample-telemetry/acevo-imola-gt3.csv",
        refFile: "/sample-telemetry/spa-gt3-pro-reference.csv",
      },
      roadatlanta: {
        game: "iRacing",
        car: "Porsche 992 GT3 R",
        track: "Michelin Raceway Road Atlanta",
        weather: "Dry",
        trackTemp: "33°C",
        airTemp: "24°C",
        tyres: "Michelin Pilot Sport GT",
        fuel: "45 L",
        driverStyle: "Momentum / Smooth Roller",
        balance: "Neutral Balance",
        target: "Sprint Race (Tyre Life & Agility)",
        complaint: "Bottoming out through Turn 12 downhill compression, oversteer on Turn 3 crest",
        file: "/sample-telemetry/roadatlanta-imsa-gt3.csv",
        refFile: "",
      },
      nordschleife: {
        game: "Assetto Corsa Competizione",
        car: "Porsche 992 GT3 R",
        track: "Nürburgring Nordschleife (Full Course)",
        weather: "Dry",
        trackTemp: "26°C",
        airTemp: "19°C",
        tyres: "DHE Slick",
        fuel: "60 L",
        driverStyle: "Planted / Safe Rear",
        balance: "Planted / Safe Rear",
        target: "Endurance Race (Pace & Stability)",
        complaint: "Instability through Flugplatz crest, high kerb harshness at Karussell entry",
        file: "/sample-telemetry/nordschleife-gt3.csv",
        refFile: "",
      },
      jeddah: {
        game: "F1 24",
        car: "Red Bull RB20",
        track: "Jeddah Corniche Circuit",
        weather: "Dry",
        trackTemp: "34°C",
        airTemp: "29°C",
        tyres: "Soft Slick (C4)",
        fuel: "38 L",
        driverStyle: "Momentum / Smooth Roller",
        balance: "Pointy / Loose Rotation",
        target: "Qualifying Hotlap (Peak Grip)",
        complaint: "Front wing wash through high-speed sweeps (Turns 8-10), snap oversteer on Turn 27 exit",
        file: "/sample-telemetry/jeddah-f1.csv",
        refFile: "",
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
    onSessionChange?.({ car: cfg.car, track: cfg.track, game: cfg.game });

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

  // Rotating loading messages
  useEffect(() => {
    if (state !== "loading") return;
    const interval = setInterval(() => {
      setLoadingTextIndex((prev) => (prev + 1) % telLoadingMessages.length);
    }, 1300);
    return () => clearInterval(interval);
  }, [state]);

  const [isParsingDuckDB, setIsParsingDuckDB] = useState(false);

  // File Upload Handlers
  const processParsedTelemetry = (parsed: ParsedTelemetryFile) => {
    setParsedTelemetry(parsed);
    setActivePreset("");

    // Auto-detect track, car, and sim game from filename
    const lowerName = parsed.filename.toLowerCase();
    let detectedTrack = track;

    const maxDist = parsed.points[parsed.points.length - 1]?.dist || 0;
    const authCircuit = getAuthenticTrackGeometry(lowerName, maxDist);
    if (authCircuit) {
      detectedTrack = authCircuit.name;
    } else if (lowerName.includes("nordschleife") || lowerName.includes("nurburgring")) {
      detectedTrack = "Nürburgring Nordschleife";
    } else if (lowerName.includes("imola") || lowerName.includes("dino")) {
      detectedTrack = "Autodromo Enzo e Dino Ferrari (Imola)";
    } else if (lowerName.includes("roadatlanta") || lowerName.includes("road_atlanta") || lowerName.includes("road-atlanta")) {
      detectedTrack = "Michelin Raceway Road Atlanta";
    } else if (lowerName.includes("jeddah")) {
      detectedTrack = "Jeddah Corniche Circuit";
    } else if (lowerName.includes("redbull") || lowerName.includes("red_bull") || lowerName.includes("spielberg") || lowerName.includes("rbr") || lowerName.includes("austria")) {
      detectedTrack = "Red Bull Ring (Spielberg GP)";
    } else if (lowerName.includes("silverstone")) {
      detectedTrack = "Silverstone Grand Prix Circuit";
    } else if (lowerName.includes("monza")) {
      detectedTrack = "Autodromo Nazionale Monza";
    } else if (lowerName.includes("spa") || lowerName.includes("francorchamps")) {
      detectedTrack = "Circuit de Spa-Francorchamps";
    } else if (lowerName.includes("suzuka")) {
      detectedTrack = "Suzuka International Racing Course";
    } else if (lowerName.includes("interlagos") || lowerName.includes("pace")) {
      detectedTrack = "Autódromo José Carlos Pace (Interlagos)";
    } else if (lowerName.includes("cota") || lowerName.includes("americas")) {
      detectedTrack = "Circuit of the Americas (COTA)";
    } else if (lowerName.includes("zandvoort")) {
      detectedTrack = "Circuit Zandvoort";
    } else if (lowerName.includes("barcelona") || lowerName.includes("catalunya")) {
      detectedTrack = "Circuit de Barcelona-Catalunya";
    } else if (lowerName.includes("bathurst") || lowerName.includes("mount_panorama")) {
      detectedTrack = "Mount Panorama Circuit (Bathurst)";
    } else if (lowerName.includes("sebring")) {
      detectedTrack = "Sebring International Raceway";
    } else if (lowerName.includes("watkins") || lowerName.includes("glen")) {
      detectedTrack = "Watkins Glen International";
    } else if (lowerName.includes("daytona")) {
      detectedTrack = "Daytona International Speedway";
    } else if (lowerName.includes("lemans") || lowerName.includes("le_mans") || lowerName.includes("sarthe")) {
      detectedTrack = "Circuit de la Sarthe (Le Mans)";
    } else if (lowerName.includes("laguna")) {
      detectedTrack = "WeatherTech Raceway Laguna Seca";
    }

    if (detectedTrack) {
      setTrack(detectedTrack);
    }

    let detectedCar = car;
    if (lowerName.includes("mercedes") || lowerName.includes("amg")) {
      detectedCar = lowerName.includes("gt4") ? "Mercedes-AMG GT4" : "Mercedes-AMG GT3";
    } else if (lowerName.includes("corvette")) {
      detectedCar = lowerName.includes("c8") ? "Corvette C8.R" : "Corvette C7.R";
    } else if (lowerName.includes("porsche") || lowerName.includes("992") || lowerName.includes("911")) {
      detectedCar = "Porsche 992 GT3 R";
    } else if (lowerName.includes("ferrari") || lowerName.includes("296")) {
      detectedCar = "Ferrari 296 GT3";
    } else if (lowerName.includes("488")) {
      detectedCar = "Ferrari 488 GT3 Evo";
    } else if (lowerName.includes("bmw") || lowerName.includes("m4")) {
      detectedCar = "BMW M4 GT3";
    } else if (lowerName.includes("audi") || lowerName.includes("r8")) {
      detectedCar = "Audi R8 LMS GT3 Evo II";
    } else if (lowerName.includes("mclaren") || lowerName.includes("720")) {
      detectedCar = "McLaren 720S GT3 Evo";
    } else if (lowerName.includes("aston") || lowerName.includes("vantage")) {
      detectedCar = "Aston Martin Vantage AMR GT3";
    } else if (lowerName.includes("lamborghini") || lowerName.includes("huracan")) {
      detectedCar = "Lamborghini Huracán GT3 EVO2";
    } else if (lowerName.includes("mustang")) {
      detectedCar = "Ford Mustang GT3";
    } else if (lowerName.includes("redbull") || lowerName.includes("rb20") || lowerName.includes("f1")) {
      detectedCar = "Red Bull RB20";
    }

    if (detectedCar) {
      setCar(detectedCar);
    }

    let detectedGame = game;
    if (lowerName.includes("iracing") || lowerName.includes(".ibt")) {
      detectedGame = "iRacing";
    } else if (lowerName.includes("ace") || lowerName.includes("evo") || lowerName.includes("acevo")) {
      detectedGame = "Assetto Corsa Evo";
    } else if (lowerName.includes("competizione") || lowerName.includes("acc")) {
      detectedGame = "Assetto Corsa Competizione";
    } else if (
      lowerName.includes("assetto") ||
      lowerName.includes("acti") ||
      lowerName.includes("ac_") ||
      lowerName.startsWith("ac-")
    ) {
      detectedGame = "Assetto Corsa";
    } else if (lowerName.includes("f1") || lowerName.includes("codemasters")) {
      detectedGame = "F1 24";
    } else if (lowerName.includes("lmu") || lowerName.includes("lemans") || lowerName.endsWith(".duckdb")) {
      detectedGame = "Le Mans Ultimate";
    }
    setGame(detectedGame);

    onSessionChange?.({
      car: detectedCar || car,
      track: detectedTrack || track,
      game: detectedGame || game,
    });

    // Reset reference comparison if it was from a different track
    setReferenceTelemetry(null);
    setLapComparison(null);

    try {
      const gg = computeGGFrictionCircle(parsed, null);
      setFrictionCircleData(gg);
    } catch (errGg) {
      console.warn("Could not compute G-G friction circle:", errGg);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.name.toLowerCase().endsWith(".duckdb")) {
      setIsParsingDuckDB(true);
      try {
        const { parseDuckDBTelemetry } = await import("@/lib/duckdb-parser");
        const parsed = await parseDuckDBTelemetry(file);
        processParsedTelemetry(parsed);
      } catch (err: any) {
        alert(`Could not parse DuckDB telemetry file: ${err.message}`);
      } finally {
        setIsParsingDuckDB(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseTelemetryCSV(text, file.name);
        processParsedTelemetry(parsed);
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

    // Draw Authentic Corner Apex Guides & Flags along Distance Axis
    const chartCorners = trackMapData?.corners || [];
    chartCorners.forEach((corner) => {
      const cx = getX(corner.dist);
      if (cx < paddingLeft || cx > width - paddingRight) return;

      const isCornerActive =
        activeCornerId === corner.id ||
        activeCornerId === corner.name ||
        activeCornerId === corner.shortName ||
        (hoverIndex >= 0 && Math.abs(points[hoverIndex].dist - corner.dist) < 140);

      // Subtle vertical dashed guide line
      ctx.beginPath();
      ctx.strokeStyle = isCornerActive ? "rgba(56, 189, 248, 0.85)" : "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = isCornerActive ? 1.5 : 1;
      ctx.setLineDash(isCornerActive ? [] : [2, 4]);
      ctx.moveTo(cx, paddingTop);
      ctx.lineTo(cx, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top corner badge tag
      const label = corner.shortName;
      ctx.font = `bold ${isCornerActive ? "9px" : "8px"} 'JetBrains Mono', monospace`;
      const textMetrics = ctx.measureText(label);
      const badgeW = Math.max(22, textMetrics.width + 8);
      const badgeH = 14;
      const badgeX = cx - badgeW / 2;
      const badgeY = paddingTop - 18;

      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
      }
      ctx.fillStyle = isCornerActive ? "#38BDF8" : "rgba(15, 23, 42, 0.85)";
      ctx.fill();
      ctx.strokeStyle = isCornerActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = isCornerActive ? 1.5 : 0.8;
      ctx.stroke();

      ctx.fillStyle = isCornerActive ? "#0B0E14" : "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, badgeY + badgeH / 2);
    });

    ctx.restore();
  }, [
    parsedTelemetry,
    referenceTelemetry,
    lapComparison,
    benchmarkMode,
    activeChannel,
    hoverIndex,
    state,
    trackMapData,
    activeCornerId,
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
      if (parsedTelemetry?.phaseBalance && !data.phaseBalance) {
        data.phaseBalance = parsedTelemetry.phaseBalance;
      }
      if (parsedTelemetry?.tyreOptimization && !data.tyreOptimization) {
        data.tyreOptimization = parsedTelemetry.tyreOptimization;
      }
      if (parsedTelemetry?.driverVsCar && !data.driverVsCar) {
        data.driverVsCar = parsedTelemetry.driverVsCar;
      }

      setResult(data);
      setState("result");
      onTelemetryAnalyzed?.(data, parsedTelemetry);
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
    let text = `APEXWALL // TELEMETRY DIAGNOSTIC REPORT\n`;
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
    let text = `APEXWALL // TELEMETRY-CALIBRATED ADAPTIVE SETUP SPEC\n`;
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

    const telContext = {
      hasTelemetry: true,
      trailBrakingScore: parsedTelemetry?.trailBrakingScore,
      throttleSmoothness: parsedTelemetry?.throttleSmoothness,
      steeringScrub: parsedTelemetry?.steeringScrub,
      gripUtilization: frictionCircleData?.gripUtilizationPct,
      trailBrakingTransitionEfficiency: frictionCircleData?.trailBrakingTransitionEfficiency,
      peakCombinedG: frictionCircleData?.peakCombinedG,
      maxLatG: parsedTelemetry?.maxLatG,
      maxDecelG: parsedTelemetry?.maxDecelG,
      topSpeed: parsedTelemetry?.topSpeed,
      minSpeed: parsedTelemetry?.minSpeed,
      lapTime: parsedTelemetry?.lapTime,
      primaryLimiter: result.primaryLimiter,
      phaseBalance: result.phaseBalance || parsedTelemetry?.phaseBalance,
      tyreOptimization: result.tyreOptimization || parsedTelemetry?.tyreOptimization,
      driverVsCar: result.driverVsCar || parsedTelemetry?.driverVsCar,
      keyCorners: lapComparison?.cornerComparisons?.map((c) => ({
        corner: c.corner,
        verdict: c.verdict,
        speedDelta: c.speedDelta,
      })),
      tyres: parsedTelemetry?.tyreStats,
    };

    onApplyToSetup({
      game,
      car,
      track,
      trackTemp,
      airTemp,
      tyreCompound,
      fuelLoad,
      handlingIssue: `Diagnosed via Telemetry: ${result.primaryLimiter || "Handling imbalance"}. Tweaks: ${adjSummary}`,
      telemetryContext: telContext,
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
            <div className="panel-label-group">
              <span className="panel-label">Telemetry Configuration</span>
              <span className="panel-sublabel">Vehicle parameters and conditions</span>
            </div>
          </div>
          <div className="panel-telemetry-badge">
            MoTeC / CSV Ready
          </div>
        </div>

        <form onSubmit={handleAnalyzeSubmit} autoComplete="off">
          {/* Section 1: Platform & Vehicle */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 17h14M4 14l2-6h12l2 6M6 17a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Vehicle & Circuit Specification
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
                <option>Assetto Corsa Evo</option>
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setCar(v);
                    onSessionChange?.({ car: v, track, game });
                  }}
                  placeholder="e.g. Ferrari 296 GT3, Porsche 992 GT3 R"
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setTrack(v);
                    onSessionChange?.({ car, track: v, game });
                  }}
                  placeholder="e.g. Spa-Francorchamps GP, Nordschleife"
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
            Session & Track Conditions
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
            Telemetry File Ingest
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
              accept=".csv,.json,.txt,.motec,.duckdb"
              className="hidden-file-input"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            <div className="dropzone-content">
              <div className="dropzone-icon">
                {isParsingDuckDB ? (
                  <svg className="animate-spin text-amber-400" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
                  </svg>
                )}
              </div>
              <div className="dropzone-text">
                <span className="dropzone-primary">
                  {isParsingDuckDB ? "Executing DuckDB-Wasm Engine..." : "Drag & drop your Telemetry file"}
                </span>
                <span className="dropzone-sub">
                  Supports <strong>Assetto Corsa Evo (MoTeC CSV)</strong>, <strong>Le Mans Ultimate (.duckdb)</strong>, <strong>MoTeC i2 CSV</strong>, <strong>Popometer</strong>, <strong>ACC Telemetry</strong> & <strong>iRacing</strong> logs
                </span>
              </div>
              <button
                type="button"
                className="dropzone-browse-btn"
                onClick={() => document.getElementById("telFileInput")?.click()}
                disabled={isParsingDuckDB}
              >
                {isParsingDuckDB ? "Reading DuckDB..." : "Browse Files"}
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
                  onClick={() => {
                    setParsedTelemetry(null);
                    setActivePreset("");
                    setCar("");
                    setTrack("");
                    onSessionChange?.({ car: "", track: "", game: "" });
                  }}
                  title="Clear telemetry file"
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

          {/* 1-Click Sample Telemetry Presets */}
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="text-[11px] text-slate-400 font-medium mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Sample Telemetry Runs (1-Click Instant Demo):</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                NO FILE NEEDED
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "spa"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("spa")}
              >
                <div className="font-semibold truncate">Spa-Francorchamps</div>
                <div className="text-[10px] text-slate-400 truncate">Ferrari 296 · ACC</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "monza"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("monza")}
              >
                <div className="font-semibold truncate">Monza GP</div>
                <div className="text-[10px] text-slate-400 truncate">992 GT3 R · ACC</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "silverstone"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("silverstone")}
              >
                <div className="font-semibold truncate">Silverstone GP</div>
                <div className="text-[10px] text-slate-400 truncate">Red Bull RB20 · F1</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "redbullring"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("redbullring")}
              >
                <div className="font-semibold truncate">Red Bull Ring</div>
                <div className="text-[10px] text-slate-400 truncate">AMG GT4 · iRacing</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "acevo"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("acevo")}
              >
                <div className="font-semibold truncate">Imola (AC Evo)</div>
                <div className="text-[10px] text-slate-400 truncate">Ferrari 296 · AC Evo</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "roadatlanta"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("roadatlanta")}
              >
                <div className="font-semibold truncate">Road Atlanta</div>
                <div className="text-[10px] text-slate-400 truncate">992 GT3 R · iRacing</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "nordschleife"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("nordschleife")}
              >
                <div className="font-semibold truncate">Nordschleife (20km)</div>
                <div className="text-[10px] text-slate-400 truncate">992 GT3 R · ACC</div>
              </button>

              <button
                type="button"
                className={`px-2.5 py-2 rounded-lg border text-left text-xs transition-all ${
                  activePreset === "jeddah"
                    ? "border-cyan-500/50 bg-cyan-500/10 text-white shadow-sm"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                }`}
                onClick={() => loadPreset("jeddah")}
              >
                <div className="font-semibold truncate">Jeddah Corniche</div>
                <div className="text-[10px] text-slate-400 truncate">Red Bull RB20 · F1</div>
              </button>
            </div>
          </div>

          {/* Section 4: Driver Style & Setup Preferences */}
          <div className="form-section-title">
            <svg className="section-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Driver Style & Setup Intent
          </div>

          <div className="field">
            <label>
              <span>Natural driving style profile</span>
              <span className="field-hint">Braking and rotation preference</span>
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
          </button>
        </form>
      </section>

      {/* RIGHT PANEL: TELEMETRY DIAGNOSTIC SUITE & RACE ENGINEER */}
      <section className="panel output-panel glass-card">
        <div className="panel-header">
          <div className="panel-tag-group">
            <div className="panel-label-group">
              <span className="panel-label">Telemetry Diagnostics</span>
              <span className="panel-sublabel">Multi-channel traces, circuit map, and chassis dynamics</span>
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
              {onDiscussWithEngineer && (
                <button
                  type="button"
                  className="action-btn border-blue-500/40 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20"
                  onClick={onDiscussWithEngineer}
                  title="Discuss this telemetry debrief with Race Engineer"
                >
                  <span>Discuss with Race Engineer →</span>
                </button>
              )}
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

        {/* State: Loading Banner */}
        {state === "loading" && (
          <div className="loading-state m-4">
            <div className="loading-visual">
              <div className="loading-pulse-ring" aria-hidden="true"></div>
              <div className="loading-data-wrap">
                <div className="loading-status-badge">TELEMETRY DIAGNOSTICS</div>
                <p className="loading-text">{telLoadingMessages[loadingTextIndex]}</p>
                <div className="loading-sub">Analyzing steering, braking decay, and chassis balance</div>
              </div>
            </div>
          </div>
        )}

        {/* State: Error */}
        {state === "error" && (
          <div className="error-state m-4">
            ⚠ {errorMessage}
          </div>
        )}

        {/* Fallback Empty Standby (only if no telemetry parsed) */}
        {!parsedTelemetry && state === "empty" && (
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
                Upload your MoTeC CSV / DuckDB log or select a demo stint on the left.<br />
                The race engineer will plot your speed and pedal traces, calculate trail-braking linearity, diagnose chassis balance, and synthesize an adaptive setup sheet.
              </p>
            </div>
            <div className="empty-specs-strip">
              <span className="spec-node">MULTI-CHANNEL OVERLAY</span>
              <span className="spec-node">TRAIL-BRAKING LINEARITY</span>
              <span className="spec-node">ADAPTIVE SETUP SYNTHESIS</span>
            </div>
          </div>
        )}

        {/* Live Telemetry Viewport (Active whenever parsedTelemetry is present!) */}
        {parsedTelemetry && (
          <div className="result-state">
            {/* 1. Score & Overview Banner OR Live Telemetry Sync Banner */}
            {state === "result" && result ? (
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
            ) : (
              <div className="telemetry-score-card !bg-blue-600/10 !border-blue-500/25">
                <div className="score-card-main !p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-white">
                        {car} @ {track}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {parsedTelemetry.points.length} SAMPLES · {parsedTelemetry.lapTime}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Channels synchronized. Interactive scrubber, circuit map, and friction circle ready.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAnalyzeSubmit}
                    disabled={state === "loading"}
                    className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-tight transition-colors flex items-center gap-2 flex-shrink-0"
                  >
                    <span>Analyze Chassis & Synthesize Setup</span>
                  </button>
                </div>
              </div>
            )}

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
                    Driver: <strong>{result?.lapTimeObserved || parsedTelemetry?.lapTime}</strong> vs Pro: <strong>{lapComparison.refLapTime}</strong>
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
                  <span className="chart-title">Multi-Channel Telemetry HUD</span>
                  <span className="chart-sub">Distance trace with synchronized hover scrubber</span>
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
                activeCornerId={activeCornerId}
                onSelectCorner={(corner) => setActiveCornerId(corner ? corner.shortName || corner.id : null)}
                onSelectCircuit={(circuitKey) => {
                  setTrack(circuitKey);
                  onSessionChange?.({ car, track: circuitKey, game });
                }}
              />
            )}

            {/* Turn-by-Turn Pro Benchmark Delta Attribution Table */}
            {benchmarkMode === "pro" && lapComparison && (
              <div className="delta-table-module glass-card-nested">
                <div className="module-header">
                  <div className="module-title-group">
                    <span className="module-title">Turn-by-Turn Benchmark Delta</span>
                    <span className="module-sub">Apex speed, braking point, throttle commit, and time delta</span>
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
                      {lapComparison.cornerComparisons.map((c, idx) => {
                        const isRowActive =
                          activeCornerId === c.shortName ||
                          activeCornerId === c.corner ||
                          activeCornerId === `corner-${idx}` ||
                          (hoverIndex >= 0 &&
                            parsedTelemetry &&
                            Math.abs(parsedTelemetry.points[hoverIndex]?.dist - c.dist) < 140);

                        return (
                          <tr
                            key={idx}
                            className={`delta-row-clickable ${isRowActive ? "row-active-corner" : ""}`}
                            onMouseEnter={() => {
                              setActiveCornerId(c.shortName || `corner-${idx}`);
                              if (parsedTelemetry) {
                                let closestIdx = 0;
                                let minDiff = Infinity;
                                parsedTelemetry.points.forEach((p, pIdx) => {
                                  const diff = Math.abs(p.dist - c.dist);
                                  if (diff < minDiff) {
                                    minDiff = diff;
                                    closestIdx = pIdx;
                                  }
                                });
                                setHoverIndex(closestIdx);
                              }
                            }}
                            onMouseLeave={() => {
                              setActiveCornerId(null);
                            }}
                            onClick={() => {
                              if (parsedTelemetry) {
                                let closestIdx = 0;
                                let minDiff = Infinity;
                                parsedTelemetry.points.forEach((p, pIdx) => {
                                  const diff = Math.abs(p.dist - c.dist);
                                  if (diff < minDiff) {
                                    minDiff = diff;
                                    closestIdx = pIdx;
                                  }
                                });
                                setHoverIndex(closestIdx);
                              }
                            }}
                            title="Hover or click to highlight on track map and MoTeC chart"
                          >
                            <td className="delta-corner-cell">
                              <span className="delta-corner-badge">{c.shortName || `T${idx + 1}`}</span>
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
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* G-G Friction Circle & Grip Envelope Module */}
            {frictionCircleData && (
              <GGFrictionCircle data={frictionCircleData} hoverIndex={hoverIndex} />
            )}

            {/* 2b. Corner Phase Balance & Slip Dynamics */}
            {parsedTelemetry?.phaseBalance && (
              <div className="telemetry-balance-module glass-card-nested">
                <div className="module-header">
                  <span className="module-title">Corner Phase Balance (Steering vs Ackermann Slip)</span>
                  <span className="module-badge">Dynamic Vehicle Balance</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80">
                    <div className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Entry Phase</div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm font-semibold ${
                        parsedTelemetry.phaseBalance.entry === "Understeer"
                          ? "text-amber-400"
                          : parsedTelemetry.phaseBalance.entry === "Oversteer"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}>
                        {parsedTelemetry.phaseBalance.entry}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {parsedTelemetry.phaseBalance.entryDeltaDeg > 0 ? "+" : ""}
                        {parsedTelemetry.phaseBalance.entryDeltaDeg.toFixed(1)}° slip
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Trail-braking yaw response</div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80">
                    <div className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Mid-Corner (Apex)</div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm font-semibold ${
                        parsedTelemetry.phaseBalance.mid === "Understeer"
                          ? "text-amber-400"
                          : parsedTelemetry.phaseBalance.mid === "Oversteer"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}>
                        {parsedTelemetry.phaseBalance.mid}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {parsedTelemetry.phaseBalance.midDeltaDeg > 0 ? "+" : ""}
                        {parsedTelemetry.phaseBalance.midDeltaDeg.toFixed(1)}° slip
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Mechanical roll stiffness balance</div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 rounded border border-zinc-800/80">
                    <div className="text-[11px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Exit Phase</div>
                    <div className="flex items-baseline justify-between">
                      <span className={`text-sm font-semibold ${
                        parsedTelemetry.phaseBalance.exit === "Understeer"
                          ? "text-amber-400"
                          : parsedTelemetry.phaseBalance.exit === "Oversteer"
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}>
                        {parsedTelemetry.phaseBalance.exit}
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {parsedTelemetry.phaseBalance.exitDeltaDeg > 0 ? "+" : ""}
                        {parsedTelemetry.phaseBalance.exitDeltaDeg.toFixed(1)}° slip
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">Throttle pickup & diff lock</div>
                  </div>
                </div>
                <div className="px-3 pb-3 text-xs text-zinc-400 font-mono">
                  Verdict: <span className="text-zinc-200">{parsedTelemetry.phaseBalance.verdict}</span>
                </div>
              </div>
            )}

            {/* 3. 4-Corner Tyre Thermal & Pressure Calibration HUD */}
            {parsedTelemetry?.tyreStats && (
              <div className="telemetry-tyres-module glass-card-nested">
                <div className="module-header">
                  <span className="module-title">Tyre Pressures & Temperatures</span>
                  <span className="module-badge">
                    {parsedTelemetry.tyreOptimization ? "Empirical Cold Calibration" : "4-Corner Thermal Spread"}
                  </span>
                </div>
                <div className="tyres-hud-grid">
                  <div className="tyre-pod tyre-fl">
                    <div className="tyre-header">
                      <span className="tyre-pos">FRONT LEFT</span>
                      {parsedTelemetry.tyreOptimization ? (
                        <span className={`tyre-status-badge ${Math.abs(parsedTelemetry.tyreOptimization.pressureDelta.FL) < 0.3 ? "badge-optimal" : "badge-warm"}`}>
                          {parsedTelemetry.tyreOptimization.pressureDelta.FL >= 0 ? "+" : ""}
                          {parsedTelemetry.tyreOptimization.pressureDelta.FL.toFixed(1)} psi
                        </span>
                      ) : (
                        <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                      )}
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.FL.temp}</div>
                    <div className="tyre-press">
                      Hot: {parsedTelemetry.tyreStats.FL.pressure}
                    </div>
                    {parsedTelemetry.tyreOptimization && (
                      <div className="text-[11px] font-mono text-emerald-400/90 mt-1">
                        Rec. Cold: {parsedTelemetry.tyreOptimization.recommendedCold.FL.toFixed(1)} psi
                      </div>
                    )}
                  </div>

                  <div className="tyre-pod tyre-fr">
                    <div className="tyre-header">
                      <span className="tyre-pos">FRONT RIGHT</span>
                      {parsedTelemetry.tyreOptimization ? (
                        <span className={`tyre-status-badge ${Math.abs(parsedTelemetry.tyreOptimization.pressureDelta.FR) < 0.3 ? "badge-optimal" : "badge-warm"}`}>
                          {parsedTelemetry.tyreOptimization.pressureDelta.FR >= 0 ? "+" : ""}
                          {parsedTelemetry.tyreOptimization.pressureDelta.FR.toFixed(1)} psi
                        </span>
                      ) : (
                        <span className="tyre-status-badge badge-warm">LOAD AXIS</span>
                      )}
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.FR.temp}</div>
                    <div className="tyre-press">
                      Hot: {parsedTelemetry.tyreStats.FR.pressure}
                    </div>
                    {parsedTelemetry.tyreOptimization && (
                      <div className="text-[11px] font-mono text-emerald-400/90 mt-1">
                        Rec. Cold: {parsedTelemetry.tyreOptimization.recommendedCold.FR.toFixed(1)} psi
                      </div>
                    )}
                  </div>

                  <div className="tyre-pod tyre-rl">
                    <div className="tyre-header">
                      <span className="tyre-pos">REAR LEFT</span>
                      {parsedTelemetry.tyreOptimization ? (
                        <span className={`tyre-status-badge ${Math.abs(parsedTelemetry.tyreOptimization.pressureDelta.RL) < 0.3 ? "badge-optimal" : "badge-warm"}`}>
                          {parsedTelemetry.tyreOptimization.pressureDelta.RL >= 0 ? "+" : ""}
                          {parsedTelemetry.tyreOptimization.pressureDelta.RL.toFixed(1)} psi
                        </span>
                      ) : (
                        <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                      )}
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.RL.temp}</div>
                    <div className="tyre-press">
                      Hot: {parsedTelemetry.tyreStats.RL.pressure}
                    </div>
                    {parsedTelemetry.tyreOptimization && (
                      <div className="text-[11px] font-mono text-emerald-400/90 mt-1">
                        Rec. Cold: {parsedTelemetry.tyreOptimization.recommendedCold.RL.toFixed(1)} psi
                      </div>
                    )}
                  </div>

                  <div className="tyre-pod tyre-rr">
                    <div className="tyre-header">
                      <span className="tyre-pos">REAR RIGHT</span>
                      {parsedTelemetry.tyreOptimization ? (
                        <span className={`tyre-status-badge ${Math.abs(parsedTelemetry.tyreOptimization.pressureDelta.RR) < 0.3 ? "badge-optimal" : "badge-warm"}`}>
                          {parsedTelemetry.tyreOptimization.pressureDelta.RR >= 0 ? "+" : ""}
                          {parsedTelemetry.tyreOptimization.pressureDelta.RR.toFixed(1)} psi
                        </span>
                      ) : (
                        <span className="tyre-status-badge badge-optimal">OPTIMAL</span>
                      )}
                    </div>
                    <div className="tyre-temp-val">{parsedTelemetry.tyreStats.RR.temp}</div>
                    <div className="tyre-press">
                      Hot: {parsedTelemetry.tyreStats.RR.pressure}
                    </div>
                    {parsedTelemetry.tyreOptimization && (
                      <div className="text-[11px] font-mono text-emerald-400/90 mt-1">
                        Rec. Cold: {parsedTelemetry.tyreOptimization.recommendedCold.RR.toFixed(1)} psi
                      </div>
                    )}
                  </div>
                </div>

                {parsedTelemetry.tyreOptimization && (
                  <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-zinc-400">
                      Target Hot Operating Pressure: <strong className="text-zinc-200">{parsedTelemetry.tyreOptimization.targetHot.toFixed(1)} psi</strong>
                    </span>
                    <span className="text-emerald-400">
                      {parsedTelemetry.tyreOptimization.status}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* AI Results Sections (Rendered after AI analysis is run) */}
            {state === "result" && result ? (
              <>
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
                <span className="module-title">Turn-by-Turn Telemetry Analysis</span>
                <span className="module-badge">Sector Breakdowns</span>
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
                <span className="module-title">Driver Coaching & Inputs</span>
                <span className="module-badge">Pedal & Wheel Guidance</span>
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

            {/* 6b. Driver Technique vs Mechanical Chassis Separation */}
            {(result.driverVsCar || parsedTelemetry?.driverVsCar) && (
              <div className="glass-card-nested border border-zinc-800/80 rounded-lg p-4 bg-zinc-950/40">
                <div className="module-header mb-3 pb-2 border-b border-zinc-800/80 flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-200">Root-Cause Separation: Driver Technique vs. Chassis Setup</span>
                  <span className="text-[11px] font-mono text-zinc-400">Telemetry Isolation</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/60">
                    <div className="text-xs font-mono font-semibold text-sky-400 mb-2 flex items-center gap-1.5">
                      <span>•</span> Driver Technique Limitations (Lap Time in Pedals)
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {(result.driverVsCar?.driverTechniquePoints || parsedTelemetry?.driverVsCar?.driverTechniquePoints || []).map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-zinc-500 font-mono">›</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/60">
                    <div className="text-xs font-mono font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                      <span>•</span> Mechanical Chassis Limitations (Requires Setup Intervention)
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {(result.driverVsCar?.mechanicalSetupPoints || parsedTelemetry?.driverVsCar?.mechanicalSetupPoints || []).map((pt, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-zinc-500 font-mono">›</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 7. Click-by-Click Setup Adjustments */}
            <div className="setup-adjustments-module glass-card-nested">
              <div className="module-header">
                <span className="module-title">Setup Adjustments</span>
                <span className="module-badge">Mechanical & Aero Changes</span>
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
                    <span className="module-title">Adaptive Setup Sheet</span>
                    <span className="module-sub">Calibrated to your driving style</span>
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
                    <span className="philosophy-tag">Engineer Debrief Summary</span>
                    <span className="philosophy-status">Calibrated</span>
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
                </div>
                <div className="notes-label">Pit Wall Team Radio: Engineer Debrief</div>
                <div className="notes-channel font-mono text-slate-400 text-[11px]">Pit Comms</div>
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
          </>
        ) : (
          <div className="p-5 rounded-lg border border-slate-700/60 bg-slate-900/40 flex flex-col md:flex-row items-center justify-between gap-4 my-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                Ready for Chief Race Engineer Diagnosis
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Analyze braking decay, slip angles, and chassis balance to generate a calibrated setup sheet for {car}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAnalyzeSubmit}
              disabled={state === "loading"}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs tracking-tight transition-colors flex items-center gap-2 flex-shrink-0"
            >
              <span>Generate Setup & Diagnostic Debrief</span>
            </button>
          </div>
        )}
      </div>
    )}
      </section>
    </div>
  );
};
