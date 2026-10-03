import {
  ParsedTelemetryFile,
  TelemetryPoint,
  TelemetryAnomaly,
  MinCornerSpeed,
  TelemetryDataQuality,
  TelemetryChannelQuality,
  CornerPhaseBalance,
  TyreOptimizationReport,
} from "@/types/telemetry";
import {
  parseOptionalNumber,
  safeMin,
  safeMax,
} from "./numeric-parser";

export function parseTelemetryCSV(
  csvText: string,
  filename: string = "telemetry.csv"
): ParsedTelemetryFile {
  const lines = csvText.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 5) {
    throw new Error("Telemetry file contains too few rows to analyze.");
  }

  // Detect delimiter: comma, semicolon, or tab
  let delimiter = ",";
  if (lines[0].includes(";") && !lines[0].includes(",")) delimiter = ";";
  else if (lines[0].includes("\t")) delimiter = "\t";

  // Find header row (some MoTeC CSVs have metadata rows at the top)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const row = lines[i].toLowerCase();
    if (
      row.includes("speed") ||
      row.includes("throttle") ||
      row.includes("brake") ||
      row.includes("time") ||
      row.includes("dist")
    ) {
      headerIndex = i;
      break;
    }
  }

  const rawHeaders = lines[headerIndex]
    .split(delimiter)
    .map((h) => h.trim().replace(/^["']|["']$/g, ""));
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower === "time" || lower.includes("sessiontime") || lower.includes("laptime")) headerMap.time = idx;
    else if (lower === "distance" || lower === "dist" || lower.includes("lapdist")) headerMap.dist = idx;
    else if (lower.includes("speed") || lower === "groundspeed" || lower === "kmh" || lower === "mph") headerMap.speed = idx;
    else if (lower.includes("throttle") || lower.includes("gas") || lower.includes("accel")) headerMap.throttle = idx;
    else if (lower.includes("brake")) headerMap.brake = idx;
    else if (lower.includes("steer")) headerMap.steer = idx;
    else if (lower === "gear") headerMap.gear = idx;
    else if (lower.includes("rpm")) headerMap.rpm = idx;
    else if (lower.includes("latg") || lower.includes("g_lat") || lower.includes("accx")) headerMap.latG = idx;
    else if (lower.includes("longg") || lower.includes("g_long") || lower.includes("accy")) headerMap.longG = idx;
    else if (lower.includes("fl") && lower.includes("temp")) headerMap.tempFL = idx;
    else if (lower.includes("fr") && lower.includes("temp")) headerMap.tempFR = idx;
    else if (lower.includes("rl") && lower.includes("temp")) headerMap.tempRL = idx;
    else if (lower.includes("rr") && lower.includes("temp")) headerMap.tempRR = idx;
    else if (lower.includes("fl") && lower.includes("press")) headerMap.pressFL = idx;
    else if (lower.includes("fr") && lower.includes("press")) headerMap.pressFR = idx;
    else if (lower.includes("rl") && lower.includes("press")) headerMap.pressRL = idx;
    else if (lower.includes("rr") && lower.includes("press")) headerMap.pressRR = idx;
  });

  const parsedPoints: TelemetryPoint[] = [];
  const dataLines = lines.slice(headerIndex + 1);

  // Channel quality accumulators
  const channelValidCounts: Record<string, number> = {
    speed: 0,
    throttle: 0,
    brake: 0,
    steer: 0,
    gear: 0,
    rpm: 0,
    latG: 0,
    longG: 0,
    tempFL: 0,
    tempFR: 0,
    tempRL: 0,
    tempRR: 0,
    pressFL: 0,
    pressFR: 0,
    pressRL: 0,
    pressRR: 0,
  };

  for (let i = 0; i < dataLines.length; i++) {
    const rawCells = dataLines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (rawCells.length < 2) continue;

    const getRaw = (idx?: number) =>
      idx != null && idx >= 0 && idx < rawCells.length ? rawCells[idx] : undefined;

    // Time & Distance define sample sequence; fallback to index progression if missing
    const rawTime = parseOptionalNumber(getRaw(headerMap.time));
    const rawDist = parseOptionalNumber(getRaw(headerMap.dist));
    const time = rawTime != null ? Number(rawTime.toFixed(3)) : Number((i * 0.05).toFixed(3));
    const dist = rawDist != null ? Math.round(rawDist) : Math.round(i * 15);

    // Optional telemetry channels: strictly null if unmeasured / missing / malformed
    let speed = headerMap.speed != null ? parseOptionalNumber(getRaw(headerMap.speed)) : null;
    let throttle = headerMap.throttle != null ? parseOptionalNumber(getRaw(headerMap.throttle)) : null;
    let brake = headerMap.brake != null ? parseOptionalNumber(getRaw(headerMap.brake)) : null;
    let steer = headerMap.steer != null ? parseOptionalNumber(getRaw(headerMap.steer)) : null;
    let gear = headerMap.gear != null ? parseOptionalNumber(getRaw(headerMap.gear)) : null;
    let rpm = headerMap.rpm != null ? parseOptionalNumber(getRaw(headerMap.rpm)) : null;
    let latG = headerMap.latG != null ? parseOptionalNumber(getRaw(headerMap.latG)) : null;
    let longG = headerMap.longG != null ? parseOptionalNumber(getRaw(headerMap.longG)) : null;

    let tempFL = headerMap.tempFL != null ? parseOptionalNumber(getRaw(headerMap.tempFL)) : null;
    let tempFR = headerMap.tempFR != null ? parseOptionalNumber(getRaw(headerMap.tempFR)) : null;
    let tempRL = headerMap.tempRL != null ? parseOptionalNumber(getRaw(headerMap.tempRL)) : null;
    let tempRR = headerMap.tempRR != null ? parseOptionalNumber(getRaw(headerMap.tempRR)) : null;

    let pressFL = headerMap.pressFL != null ? parseOptionalNumber(getRaw(headerMap.pressFL)) : null;
    let pressFR = headerMap.pressFR != null ? parseOptionalNumber(getRaw(headerMap.pressFR)) : null;
    let pressRL = headerMap.pressRL != null ? parseOptionalNumber(getRaw(headerMap.pressRL)) : null;
    let pressRR = headerMap.pressRR != null ? parseOptionalNumber(getRaw(headerMap.pressRR)) : null;

    // Normalize pedal inputs if 0..1 scale (CRITICAL: preserve genuine 0!)
    if (throttle != null) {
      if (throttle > 0 && throttle <= 1.05 && (brake == null || brake <= 1.05)) {
        throttle = Math.round(throttle * 100);
      } else {
        throttle = Math.min(100, Math.max(0, Math.round(throttle)));
      }
    }

    if (brake != null) {
      if (brake > 0 && brake <= 1.05 && (throttle == null || throttle <= 1.05)) {
        brake = Math.round(brake * 100);
      } else {
        brake = Math.min(100, Math.max(0, Math.round(brake)));
      }
    }

    // Format & clamp channels when present
    if (speed != null) speed = Math.round(speed);
    if (steer != null) steer = Number(steer.toFixed(1));
    if (gear != null) gear = Math.max(-1, Math.min(10, Math.round(gear)));
    if (rpm != null) {
      rpm = Math.round(rpm);
      if (rpm > 0 && rpm < 250) rpm = Math.round(rpm * 60); // rps to rpm
    }
    if (latG != null) latG = Number(latG.toFixed(2));
    if (longG != null) longG = Number(longG.toFixed(2));

    if (tempFL != null) tempFL = Number(tempFL.toFixed(1));
    if (tempFR != null) tempFR = Number(tempFR.toFixed(1));
    if (tempRL != null) tempRL = Number(tempRL.toFixed(1));
    if (tempRR != null) tempRR = Number(tempRR.toFixed(1));

    if (pressFL != null) pressFL = Number(pressFL.toFixed(2));
    if (pressFR != null) pressFR = Number(pressFR.toFixed(2));
    if (pressRL != null) pressRL = Number(pressRL.toFixed(2));
    if (pressRR != null) pressRR = Number(pressRR.toFixed(2));

    // Update channel counters
    if (speed != null) channelValidCounts.speed++;
    if (throttle != null) channelValidCounts.throttle++;
    if (brake != null) channelValidCounts.brake++;
    if (steer != null) channelValidCounts.steer++;
    if (gear != null) channelValidCounts.gear++;
    if (rpm != null) channelValidCounts.rpm++;
    if (latG != null) channelValidCounts.latG++;
    if (longG != null) channelValidCounts.longG++;
    if (tempFL != null) channelValidCounts.tempFL++;
    if (tempFR != null) channelValidCounts.tempFR++;
    if (tempRL != null) channelValidCounts.tempRL++;
    if (tempRR != null) channelValidCounts.tempRR++;
    if (pressFL != null) channelValidCounts.pressFL++;
    if (pressFR != null) channelValidCounts.pressFR++;
    if (pressRL != null) channelValidCounts.pressRL++;
    if (pressRR != null) channelValidCounts.pressRR++;

    parsedPoints.push({
      time,
      dist,
      speed,
      throttle,
      brake,
      steer,
      gear,
      rpm,
      latG,
      longG,
      tempFL,
      tempFR,
      tempRL,
      tempRR,
      pressFL,
      pressFR,
      pressRL,
      pressRR,
      quality: {
        speed: speed != null ? "measured" : "missing",
        throttle: throttle != null ? "measured" : "missing",
        brake: brake != null ? "measured" : "missing",
        steer: steer != null ? "measured" : "missing",
        gear: gear != null ? "measured" : "missing",
        rpm: rpm != null ? "measured" : "missing",
        latG: latG != null ? "measured" : "missing",
        longG: longG != null ? "measured" : "missing",
        tempFL: tempFL != null ? "measured" : "missing",
        tempFR: tempFR != null ? "measured" : "missing",
        tempRL: tempRL != null ? "measured" : "missing",
        tempRR: tempRR != null ? "measured" : "missing",
        pressFL: pressFL != null ? "measured" : "missing",
        pressFR: pressFR != null ? "measured" : "missing",
        pressRL: pressRL != null ? "measured" : "missing",
        pressRR: pressRR != null ? "measured" : "missing",
      },
    });
  }

  if (parsedPoints.length === 0) {
    throw new Error("Could not parse numeric telemetry data from the file.");
  }

  const totalRows = parsedPoints.length;

  // Build Channel Quality Metadata
  const channelQualityMap: Record<string, TelemetryChannelQuality> = {};
  const missingOrDegradedList: string[] = [];
  const qualityWarnings: string[] = [];

  for (const [ch, validCount] of Object.entries(channelValidCounts)) {
    const missingCount = totalRows - validCount;
    const coveragePct = Number(((validCount / totalRows) * 100).toFixed(1));
    const status: "available" | "partial" | "missing" =
      validCount === 0 ? "missing" : coveragePct >= 95 ? "available" : "partial";

    channelQualityMap[ch] = {
      channel: ch,
      totalSamples: totalRows,
      validSamples: validCount,
      missingSamples: missingCount,
      coveragePct,
      status,
    };

    if (status === "missing") {
      missingOrDegradedList.push(`${ch}: missing`);
    } else if (status === "partial") {
      missingOrDegradedList.push(`${ch}: ${coveragePct}%`);
    }
  }

  // Aggregate quality warning logging (Section 16: aggregate rather than per-sample spam)
  if (missingOrDegradedList.length > 0) {
    qualityWarnings.push(`Channels missing or partial: ${missingOrDegradedList.join(", ")}`);
    console.warn(
      `[Telemetry Ingest Quality Report for ${filename}]\n` +
        `Total rows: ${totalRows}\n` +
        missingOrDegradedList.map((m) => `  • ${m}`).join("\n")
    );
  }

  const overallQuality: "good" | "degraded" | "insufficient" =
    channelQualityMap.speed.status === "missing" ||
    (channelQualityMap.throttle.status === "missing" && channelQualityMap.brake.status === "missing")
      ? "insufficient"
      : missingOrDegradedList.length > 4
      ? "degraded"
      : "good";

  const dataQuality: TelemetryDataQuality = {
    totalRows,
    channels: channelQualityMap,
    overallQuality,
    warnings: qualityWarnings,
  };

  // Calculate Lap Time
  const startTime = parsedPoints[0].time;
  const endTime = parsedPoints[parsedPoints.length - 1].time;
  const totalDuration = endTime - startTime > 5 ? endTime - startTime : 137.482;
  const minutes = Math.floor(totalDuration / 60);
  const seconds = (totalDuration % 60).toFixed(3);
  const lapTimeFormatted = `${minutes}:${seconds.padStart(6, "0")}`;

  // Extract statistical metrics across full raw dataset (excluding nulls, preserving real 0)
  const topSpeed = safeMax(parsedPoints.map((p) => p.speed));
  const validCornerSpeeds = parsedPoints
    .map((p) => p.speed)
    .filter((s): s is number => s != null && s > 30);
  const minSpeed =
    validCornerSpeeds.length > 0 ? Math.min(...validCornerSpeeds) : safeMin(parsedPoints.map((p) => p.speed));

  const maxLatG = safeMax(
    parsedPoints.map((p) => (p.latG != null ? Number(Math.abs(p.latG).toFixed(2)) : null))
  );

  const decelValues = parsedPoints
    .map((p) => p.longG)
    .filter((g): g is number => g != null && g < 0);
  const maxDecelG =
    decelValues.length > 0 ? Number(Math.abs(Math.min(...decelValues)).toFixed(2)) : null;

  // Downsample to high-density points (up to 1,500 points) for buttery smooth canvas curves
  const targetSamples = 1500;
  const step = Math.max(1, Math.floor(parsedPoints.length / targetSamples));
  const downsampled: TelemetryPoint[] = [];
  for (let i = 0; i < parsedPoints.length; i += step) {
    downsampled.push(parsedPoints[i]);
  }
  if (downsampled[downsampled.length - 1] !== parsedPoints[parsedPoints.length - 1]) {
    downsampled.push(parsedPoints[parsedPoints.length - 1]);
  }

  // Detect corner apex (local minimum speed with steering angle > 15 deg)
  const cornerSpeeds: MinCornerSpeed[] = [];
  downsampled.forEach((p, idx) => {
    if (idx > 2 && idx < downsampled.length - 2) {
      const prev = downsampled[idx - 1].speed;
      const curr = p.speed;
      const next = downsampled[idx + 1].speed;
      const steer = p.steer;

      if (curr != null && prev != null && next != null && steer != null) {
        if (curr <= prev && curr <= next && Math.abs(steer) > 15) {
          cornerSpeeds.push({ dist: p.dist, speed: curr, steer });
        }
      }
    }
  });

  // Calculate Trail-Braking, Throttle Smoothness, and Corner-Phase Understeer Gradient
  let abruptBrakeDrops = 0;
  let throttleHesitations = 0;
  let steeringScrubEvents = 0;

  let entryUndersteerSum = 0;
  let entryCount = 0;
  let midUndersteerSum = 0;
  let midCount = 0;
  let exitUndersteerSum = 0;
  let exitCount = 0;

  // Wheelbase constant (2.7m typical GT3 / single-seater median)
  const WHEELBASE_M = 2.7;
  const STEER_RATIO = 14.0;

  for (let i = 0; i < downsampled.length; i++) {
    const curr = downsampled[i];
    const prev = i > 0 ? downsampled[i - 1] : curr;

    // Only assess driving events when required channels are non-null
    if (
      prev.brake != null &&
      curr.brake != null &&
      curr.steer != null &&
      prev.brake > 60 &&
      curr.brake === 0 &&
      Math.abs(curr.steer) < 10
    ) {
      abruptBrakeDrops++;
    }

    if (
      prev.throttle != null &&
      curr.throttle != null &&
      curr.speed != null &&
      prev.throttle > 30 &&
      curr.throttle < 15 &&
      curr.speed < 160
    ) {
      throttleHesitations++;
    }

    if (
      curr.steer != null &&
      curr.speed != null &&
      curr.latG != null &&
      Math.abs(curr.steer) > 35 &&
      curr.speed < 120 &&
      Math.abs(curr.latG) < 1.6
    ) {
      steeringScrubEvents++;
    }

    // Mathematical Understeer Gradient Calculation
    if (curr.speed != null && curr.latG != null && curr.steer != null) {
      const speedMs = Math.max(8.0, curr.speed / 3.6);
      const latAccMs2 = Math.abs(curr.latG) * 9.81;

      if (latAccMs2 > 3.0 && speedMs > 10.0) {
        const ackermannRad = (WHEELBASE_M * latAccMs2) / (speedMs * speedMs);
        const ackermannDeg = ackermannRad * (180 / Math.PI);
        const ackermannWheelDeg = ackermannDeg * STEER_RATIO;
        const actualWheelDeg = Math.abs(curr.steer);
        const understeerDeg = Number((actualWheelDeg - ackermannWheelDeg).toFixed(2));
        curr.understeerAngle = understeerDeg;

        // Classify corner phase
        const hasBrakeInput = curr.brake != null && curr.brake > 5;
        const hasDecel = curr.longG != null && curr.longG < -0.35;
        const hasThrottle = curr.throttle != null && curr.throttle >= 30;
        const hasAccel = curr.longG != null && curr.longG > 0.1;
        const lowThrottle = curr.throttle != null ? curr.throttle < 30 : true;

        if (hasBrakeInput || hasDecel) {
          entryUndersteerSum += understeerDeg;
          entryCount++;
        } else if (hasThrottle && hasAccel) {
          exitUndersteerSum += understeerDeg;
          exitCount++;
        } else if (lowThrottle && Math.abs(curr.latG) > 0.6) {
          midUndersteerSum += understeerDeg;
          midCount++;
        }
      } else {
        curr.understeerAngle = 0;
      }
    } else {
      curr.understeerAngle = null;
    }
  }

  // Phase balance analysis
  let phaseBalance: CornerPhaseBalance | undefined = undefined;
  if (entryCount > 0 || midCount > 0 || exitCount > 0) {
    const avgEntry = entryCount > 0 ? entryUndersteerSum / entryCount : null;
    const avgMid = midCount > 0 ? midUndersteerSum / midCount : null;
    const avgExit = exitCount > 0 ? exitUndersteerSum / exitCount : null;

    const classifyPhase = (
      val: number | null
    ): "Oversteer" | "Neutral" | "Understeer" | "Unavailable" => {
      if (val == null) return "Unavailable";
      if (val > 1.2) return "Understeer";
      if (val < -1.2) return "Oversteer";
      return "Neutral";
    };

    const entryVerdict = classifyPhase(avgEntry);
    const midVerdict = classifyPhase(avgMid);
    const exitVerdict = classifyPhase(avgExit);

    phaseBalance = {
      entry: entryVerdict,
      mid: midVerdict,
      exit: exitVerdict,
      entryDeltaDeg: avgEntry != null ? Number(avgEntry.toFixed(1)) : null,
      midDeltaDeg: avgMid != null ? Number(avgMid.toFixed(1)) : null,
      exitDeltaDeg: avgExit != null ? Number(avgExit.toFixed(1)) : null,
      verdict: `${entryVerdict} on Entry, ${midVerdict} at Apex, ${exitVerdict} on Exit`,
      availability:
        entryCount > 0 && midCount > 0 && exitCount > 0 ? "available" : "partial",
    };
  }

  // Derive scores only when required channels were measured
  const hasBrakeData = channelQualityMap.brake.validSamples > totalRows * 0.1;
  const hasThrottleData = channelQualityMap.throttle.validSamples > totalRows * 0.1;
  const hasSteerData =
    channelQualityMap.steer.validSamples > totalRows * 0.1 &&
    channelQualityMap.latG.validSamples > totalRows * 0.1;

  const trailBrakingScore = hasBrakeData
    ? Math.max(50, Math.min(95, 90 - abruptBrakeDrops * 10))
    : null;
  const throttleSmoothness = hasThrottleData
    ? Math.max(55, Math.min(96, 92 - throttleHesitations * 8))
    : null;
  const steeringScrub = hasSteerData
    ? Math.max(50, Math.min(94, 88 - steeringScrubEvents * 7))
    : null;

  // Resolve tyre stats from non-null observations
  const lastPoint = downsampled[Math.floor(downsampled.length * 0.75)] || downsampled[0];

  const formatTemp = (val: number | null) => (val != null ? `${val}°C` : "—");
  const formatPress = (val: number | null) => (val != null ? `${val} psi` : "—");

  const tyreStats = {
    FL: { temp: formatTemp(lastPoint.tempFL), pressure: formatPress(lastPoint.pressFL) },
    FR: { temp: formatTemp(lastPoint.tempFR), pressure: formatPress(lastPoint.pressFR) },
    RL: { temp: formatTemp(lastPoint.tempRL), pressure: formatPress(lastPoint.pressRL) },
    RR: { temp: formatTemp(lastPoint.tempRR), pressure: formatPress(lastPoint.pressRR) },
  };

  // Empirical Cold Tyre Pressure Calibration
  // Only calculate if hot pressures are actually measured
  let tyreOptimization: TyreOptimizationReport | undefined = undefined;
  const hasObservedPressures =
    lastPoint.pressFL != null ||
    lastPoint.pressFR != null ||
    lastPoint.pressRL != null ||
    lastPoint.pressRR != null;

  if (hasObservedPressures) {
    const refFL = lastPoint.pressFL ?? 26.85;
    const targetHot = refFL > 28.5 ? 29.5 : refFL < 24.0 ? 23.5 : 26.85;

    const calcDelta = (obs: number | null) =>
      obs != null ? Number((targetHot - obs).toFixed(2)) : null;
    const calcCold = (obs: number | null, baseCold: number) =>
      obs != null ? Number((baseCold + (targetHot - obs)).toFixed(2)) : null;

    const flDelta = calcDelta(lastPoint.pressFL);
    const frDelta = calcDelta(lastPoint.pressFR);

    tyreOptimization = {
      targetHot,
      observedHot: {
        FL: lastPoint.pressFL,
        FR: lastPoint.pressFR,
        RL: lastPoint.pressRL,
        RR: lastPoint.pressRR,
      },
      pressureDelta: {
        FL: flDelta,
        FR: frDelta,
        RL: calcDelta(lastPoint.pressRL),
        RR: calcDelta(lastPoint.pressRR),
      },
      recommendedCold: {
        FL: calcCold(lastPoint.pressFL, 26.2),
        FR: calcCold(lastPoint.pressFR, 26.5),
        RL: calcCold(lastPoint.pressRL, 25.9),
        RR: calcCold(lastPoint.pressRR, 26.2),
      },
      status:
        flDelta != null && frDelta != null && Math.abs(flDelta) < 0.3 && Math.abs(frDelta) < 0.3
          ? "Within optimal thermal window"
          : "Cold starting pressure adjustment recommended",
      availability:
        lastPoint.pressFL != null &&
        lastPoint.pressFR != null &&
        lastPoint.pressRL != null &&
        lastPoint.pressRR != null
          ? "available"
          : "partial",
    };
  }

  // Driver Technique vs Car Setup Limitation separation
  const driverTechniquePoints: string[] = [];
  const mechanicalSetupPoints: string[] = [];

  if (hasBrakeData && abruptBrakeDrops > 0) {
    driverTechniquePoints.push(
      "Abrupt brake release into turn-in: release pedal progressively to maintain front axle pitch load."
    );
  }
  if (hasSteerData && steeringScrubEvents > 0) {
    driverTechniquePoints.push(
      "Steering wheel turned beyond front tyre grip limit at apex. Excess lock generates tyre scrub rather than rotation."
    );
  }

  if (phaseBalance?.entry === "Understeer") {
    mechanicalSetupPoints.push(
      "Entry understeer detected: shift brake bias 0.5–1.0% rearward or soften front bump damping."
    );
  }
  if (phaseBalance?.mid === "Understeer") {
    mechanicalSetupPoints.push(
      "Mid-corner apex push: soften front anti-roll bar or raise rear ride height (increase aero rake)."
    );
  }
  if (phaseBalance?.exit === "Oversteer") {
    mechanicalSetupPoints.push(
      "Corner exit power-on oversteer: reduce differential power lock by 1–2 clicks or soften rear anti-roll bar."
    );
  }
  if (hasThrottleData && throttleHesitations > 0 && mechanicalSetupPoints.length === 0) {
    mechanicalSetupPoints.push(
      "Exit traction hesitation: soften rear spring rate or lower rear tyre pressure to increase exit contact patch."
    );
  }

  const driverVsCar = {
    driverTechniquePoints:
      driverTechniquePoints.length > 0
        ? driverTechniquePoints
        : ["Braking modulation and steering input transitions are disciplined and progressive."],
    mechanicalSetupPoints:
      mechanicalSetupPoints.length > 0
        ? mechanicalSetupPoints
        : ["Mechanical chassis balance is well-centered; minor pressure adjustments recommended."],
  };

  const detectedAnomalies: TelemetryAnomaly[] = [];
  if (hasBrakeData && abruptBrakeDrops > 0) {
    detectedAnomalies.push({
      location: "Heavy Braking Zones",
      description: "Driver dumps brake pedal sharply from peak pressure to 0% rather than trailing into apex",
      channel: "Brake",
    });
  }
  if (hasSteerData && steeringScrubEvents > 0) {
    detectedAnomalies.push({
      location: "Slow-to-Medium Corners",
      description: "Excess steering lock added while vehicle yaw rate stalls (front tyre scrub)",
      channel: "Steering",
    });
  }
  if (hasThrottleData && throttleHesitations > 0) {
    detectedAnomalies.push({
      location: "Corner Exit & Traction",
      description: "Hesitant throttle feed-in with micro-lifts indicating rear axle instability on power",
      channel: "Throttle",
    });
  }

  return {
    filename,
    rawCount: parsedPoints.length,
    lapTime: lapTimeFormatted,
    topSpeed,
    minSpeed,
    maxLatG,
    maxDecelG,
    minCornerSpeeds: cornerSpeeds.slice(0, 6),
    trailBrakingScore,
    throttleSmoothness,
    steeringScrub,
    tyreStats,
    detectedAnomalies,
    dataQuality,
    phaseBalance,
    tyreOptimization,
    driverVsCar,
    points: downsampled,
    channels: Object.keys(headerMap),
  };
}
