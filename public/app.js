// =============================================================================
// SIM SETUP AI — EXECUTIVE CONTROLLER (SETUP GENERATOR + TELEMETRY ANALYZER)
// =============================================================================

// ---------- Navigation Mode Switcher (Setup vs Telemetry) ----------
const btnModeSetup = document.getElementById("btnModeSetup");
const btnModeTelemetry = document.getElementById("btnModeTelemetry");
const setupView = document.getElementById("setupView");
const telemetryView = document.getElementById("telemetryView");

function setWorkspaceMode(mode) {
  const isSetup = mode === "setup";
  btnModeSetup?.classList.toggle("active", isSetup);
  btnModeTelemetry?.classList.toggle("active", !isSetup);
  setupView?.classList.toggle("hidden", !isSetup);
  telemetryView?.classList.toggle("hidden", isSetup);

  if (!isSetup) {
    // If opening telemetry analyzer for first time and canvas is visible, trigger a resize/render
    setTimeout(() => {
      renderTelemetryCanvas();
    }, 50);
  }
}

btnModeSetup?.addEventListener("click", () => setWorkspaceMode("setup"));
btnModeTelemetry?.addEventListener("click", () => setWorkspaceMode("telemetry"));

// ---------- Segmented control buttons ----------
// Each .segmented group stores its chosen value in data-value on the active button.
document.querySelectorAll(".segmented").forEach((group) => {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    group.querySelectorAll(".seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function getSegmentValue(target) {
  const group = document.querySelector(`.segmented[data-target="${target}"]`);
  const active = group?.querySelector(".seg-btn.active");
  return active ? active.dataset.value : "";
}

function setSegmentValue(target, value) {
  const group = document.querySelector(`.segmented[data-target="${target}"]`);
  if (!group) return;
  const buttons = group.querySelectorAll(".seg-btn");
  buttons.forEach((b) => {
    b.classList.toggle("active", b.dataset.value === value);
  });
}

// ---------- FIA Start Lights Animation ----------
const lights = document.querySelectorAll("#startLights .light");
let lightInterval = null;

function startLightsSequence() {
  let i = 0;
  lights.forEach((l) => l.classList.remove("on", "go"));
  clearInterval(lightInterval);
  lightInterval = setInterval(() => {
    if (i < lights.length) {
      lights[i].classList.add("on");
      i++;
    } else {
      lights.forEach((l) => {
        l.classList.remove("on");
        l.classList.add("go");
      });
      clearInterval(lightInterval);
    }
  }, 350);
}

function stopLightsSequence() {
  clearInterval(lightInterval);
  lights.forEach((l) => l.classList.remove("on", "go"));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// =============================================================================
// WORKSPACE 1: SETUP GENERATOR LOGIC
// =============================================================================

const setupLoadingMessages = [
  "Warming tyres…",
  "Reading track temp…",
  "Balancing the diff…",
  "Dialing in the aero…",
  "Checking the radio…",
  "Printing setup sheet…",
];
let setupLoadingInterval = null;

function startSetupLoadingText() {
  const el = document.getElementById("loadingText");
  if (!el) return;
  let i = 0;
  el.textContent = setupLoadingMessages[0];
  clearInterval(setupLoadingInterval);
  setupLoadingInterval = setInterval(() => {
    i = (i + 1) % setupLoadingMessages.length;
    el.textContent = setupLoadingMessages[i];
  }, 1400);
}

function stopSetupLoadingText() {
  clearInterval(setupLoadingInterval);
}

function showSetupState(state) {
  ["emptyState", "loadingState", "errorState", "resultState"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== state);
  });
}

let lastSetupData = null;

function renderSetupResult(data) {
  lastSetupData = data;
  document.getElementById("resultSummary").textContent = data.summary || "";
  document.getElementById("resultNotes").textContent = data.engineerNotes || "";

  const sectionsEl = document.getElementById("resultSections");
  sectionsEl.innerHTML = "";

  (data.sections || []).forEach((section) => {
    const sectionDiv = document.createElement("div");
    sectionDiv.className = "setup-section";

    const titleDiv = document.createElement("div");
    titleDiv.className = "setup-section-title";
    const count = section.items?.length || 0;
    titleDiv.innerHTML = `<span>${escapeHtml(section.title)}</span><span class="section-count">${count} ${count === 1 ? 'PARAM' : 'PARAMS'}</span>`;
    sectionDiv.appendChild(titleDiv);

    (section.items || []).forEach((item) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "setup-item";
      itemDiv.innerHTML = `<span class="label">${escapeHtml(item.label)}</span><span class="value">${escapeHtml(item.value)}</span>`;
      sectionDiv.appendChild(itemDiv);
    });

    sectionsEl.appendChild(sectionDiv);
  });

  showSetupState("resultState");
}

const setupForm = document.getElementById("setupForm");
const generateBtn = document.getElementById("generateBtn");

setupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    game: document.getElementById("game").value,
    car: document.getElementById("car").value,
    track: document.getElementById("track").value,
    sessionType: getSegmentValue("sessionType"),
    weather: getSegmentValue("weather"),
    trackTemp: document.getElementById("trackTemp").value,
    airTemp: document.getElementById("airTemp").value,
    fuelLoad: document.getElementById("fuelLoad").value,
    tyreCompound: document.getElementById("tyreCompound").value,
    driverStyle: document.getElementById("driverStyle").value,
    handlingIssue: document.getElementById("handlingIssue").value,
    skillLevel: getSegmentValue("skillLevel"),
  };

  generateBtn.disabled = true;
  showSetupState("loadingState");
  startLightsSequence();
  startSetupLoadingText();

  try {
    const res = await fetch("/api/generate-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    renderSetupResult(data);
  } catch (err) {
    document.getElementById("errorState").textContent = `⚠ ${err.message}`;
    showSetupState("errorState");
  } finally {
    generateBtn.disabled = false;
    stopLightsSequence();
    stopSetupLoadingText();
  }
});

document.getElementById("resetBtn")?.addEventListener("click", () => {
  showSetupState("emptyState");
  lastSetupData = null;
  setupForm.reset();
  document.querySelectorAll("#setupView .segmented").forEach((group) => {
    group.querySelectorAll(".seg-btn").forEach((b, idx) => {
      b.classList.toggle("active", idx === (group.dataset.target === "skillLevel" ? 1 : 0));
    });
  });
});

const copyBtn = document.getElementById("copyBtn");
if (copyBtn) {
  copyBtn.addEventListener("click", () => {
    if (!lastSetupData) return;
    const carVal = document.getElementById("car")?.value || "Chassis";
    const trackVal = document.getElementById("track")?.value || "Circuit";
    let text = `SIM SETUP AI // ${carVal.toUpperCase()} @ ${trackVal.toUpperCase()}\n`;
    text += `${"=".repeat(45)}\n\n`;
    if (lastSetupData.summary) {
      text += `[ENGINEER PHILOSOPHY]\n${lastSetupData.summary}\n\n`;
    }
    (lastSetupData.sections || []).forEach((sec) => {
      text += `[${sec.title.toUpperCase()}]\n`;
      (sec.items || []).forEach((it) => {
        text += `  • ${it.label}: ${it.value}\n`;
      });
      text += `\n`;
    });
    if (lastSetupData.engineerNotes) {
      text += `[TEAM RADIO / ENGINEER NOTES]\n${lastSetupData.engineerNotes}\n`;
    }
    navigator.clipboard.writeText(text).then(() => {
      const originalContent = copyBtn.innerHTML;
      copyBtn.innerHTML = `<span>COPIED ✓</span>`;
      setTimeout(() => {
        copyBtn.innerHTML = originalContent;
      }, 2000);
    }).catch(() => {});
  });
}

// =============================================================================
// WORKSPACE 2: TELEMETRY ANALYZER LOGIC
// =============================================================================

// Telemetry state management
let currentTelemetryData = null;
let currentTelemetryStats = null;
let currentTelemetryPoints = [];
let currentAnomalies = [];
let activeChartChannel = "pedals"; // "pedals", "steering", "gear"
let lastTelemetryResult = null;

const telLoadingMessages = [
  "Ingesting MoTeC telemetry channels…",
  "Computing trail-braking pressure decay rate…",
  "Analyzing steering scrub vs yaw response…",
  "Assessing 4-corner tyre thermals & pressures…",
  "Chief Race Engineer formulating turn debrief…",
];
let telLoadingInterval = null;

function startTelLoadingText() {
  const el = document.getElementById("telLoadingText");
  if (!el) return;
  let i = 0;
  el.textContent = telLoadingMessages[0];
  clearInterval(telLoadingInterval);
  telLoadingInterval = setInterval(() => {
    i = (i + 1) % telLoadingMessages.length;
    el.textContent = telLoadingMessages[i];
  }, 1300);
}

function stopTelLoadingText() {
  clearInterval(telLoadingInterval);
}

function showTelemetryState(state) {
  ["telEmptyState", "telLoadingState", "telErrorState", "telResultState"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== state);
  });
}

// ---------- Telemetry Parser (CSV, JSON, MoTeC export) ----------
function parseTelemetryCSV(csvText, filename = "telemetry.csv") {
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
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
    if (row.includes("speed") || row.includes("throttle") || row.includes("brake") || row.includes("time") || row.includes("dist")) {
      headerIndex = i;
      break;
    }
  }

  const rawHeaders = lines[headerIndex].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));
  const headerMap = {};

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

  const parsedPoints = [];
  const dataLines = lines.slice(headerIndex + 1);

  for (let i = 0; i < dataLines.length; i++) {
    const parts = dataLines[i].split(delimiter).map(p => parseFloat(p.trim()) || 0);
    if (parts.length < 2) continue;

    const time = headerMap.time != null ? parts[headerMap.time] : i * 0.05;
    const dist = headerMap.dist != null ? parts[headerMap.dist] : i * 15;
    let speed = headerMap.speed != null ? parts[headerMap.speed] : 0;
    let throttle = headerMap.throttle != null ? parts[headerMap.throttle] : 0;
    let brake = headerMap.brake != null ? parts[headerMap.brake] : 0;
    let steer = headerMap.steer != null ? parts[headerMap.steer] : 0;
    let gear = headerMap.gear != null ? Math.round(parts[headerMap.gear]) : 3;
    let rpm = headerMap.rpm != null ? Math.round(parts[headerMap.rpm]) : 6500;
    let latG = headerMap.latG != null ? parts[headerMap.latG] : 0;
    let longG = headerMap.longG != null ? parts[headerMap.longG] : 0;

    // Normalize pedal inputs if 0..1 scale
    if (throttle > 0 && throttle <= 1.05 && brake <= 1.05) {
      throttle = Math.round(throttle * 100);
      brake = Math.round(brake * 100);
    } else {
      throttle = Math.min(100, Math.max(0, Math.round(throttle)));
      brake = Math.min(100, Math.max(0, Math.round(brake)));
    }

    parsedPoints.push({
      time: Number(time.toFixed(3)),
      dist: Math.round(dist),
      speed: Math.round(speed),
      throttle,
      brake,
      steer: Number(steer.toFixed(1)),
      gear: Math.max(1, Math.min(8, gear)),
      rpm,
      latG: Number(latG.toFixed(2)),
      longG: Number(longG.toFixed(2)),
      tempFL: headerMap.tempFL != null ? Number(parts[headerMap.tempFL].toFixed(1)) : 84.0,
      tempFR: headerMap.tempFR != null ? Number(parts[headerMap.tempFR].toFixed(1)) : 86.5,
      tempRL: headerMap.tempRL != null ? Number(parts[headerMap.tempRL].toFixed(1)) : 81.8,
      tempRR: headerMap.tempRR != null ? Number(parts[headerMap.tempRR].toFixed(1)) : 83.2,
      pressFL: headerMap.pressFL != null ? Number(parts[headerMap.pressFL].toFixed(2)) : 27.2,
      pressFR: headerMap.pressFR != null ? Number(parts[headerMap.pressFR].toFixed(2)) : 27.5,
      pressRL: headerMap.pressRL != null ? Number(parts[headerMap.pressRL].toFixed(2)) : 26.8,
      pressRR: headerMap.pressRR != null ? Number(parts[headerMap.pressRR].toFixed(2)) : 27.0,
    });
  }

  if (parsedPoints.length === 0) {
    throw new Error("Could not parse numeric telemetry data from the file.");
  }

  // Calculate Lap Time
  const startTime = parsedPoints[0].time;
  const endTime = parsedPoints[parsedPoints.length - 1].time;
  const totalDuration = endTime - startTime > 5 ? (endTime - startTime) : 137.482;
  const minutes = Math.floor(totalDuration / 60);
  const seconds = (totalDuration % 60).toFixed(3);
  const lapTimeFormatted = `${minutes}:${seconds.padStart(6, "0")}`;

  // Downsample to ~120 evenly spaced points for smooth canvas & efficient AI payload
  const targetSamples = 120;
  const step = Math.max(1, Math.floor(parsedPoints.length / targetSamples));
  const downsampled = [];
  for (let i = 0; i < parsedPoints.length; i += step) {
    downsampled.push(parsedPoints[i]);
  }
  if (downsampled[downsampled.length - 1] !== parsedPoints[parsedPoints.length - 1]) {
    downsampled.push(parsedPoints[parsedPoints.length - 1]);
  }

  // Extract statistical metrics
  let topSpeed = 0;
  let minSpeed = 999;
  let maxLatG = 0;
  let maxDecelG = 0;
  const cornerSpeeds = [];

  downsampled.forEach((p, idx) => {
    if (p.speed > topSpeed) topSpeed = p.speed;
    if (p.speed < minSpeed) minSpeed = p.speed;
    if (Math.abs(p.latG) > maxLatG) maxLatG = Math.abs(p.latG);
    if (p.longG < maxDecelG) maxDecelG = p.longG;

    // Detect corner apex (local minimum speed with steering angle > 15 deg)
    if (idx > 2 && idx < downsampled.length - 2) {
      const prev = downsampled[idx - 1].speed;
      const next = downsampled[idx + 1].speed;
      if (p.speed <= prev && p.speed <= next && Math.abs(p.steer) > 15) {
        cornerSpeeds.push({ dist: p.dist, speed: p.speed, steer: p.steer });
      }
    }
  });

  // Calculate Trail-Braking & Throttle Smoothness heuristic scores
  let abruptBrakeDrops = 0;
  let throttleHesitations = 0;
  let steeringScrubEvents = 0;

  for (let i = 1; i < downsampled.length; i++) {
    const prev = downsampled[i - 1];
    const curr = downsampled[i];

    // Abrupt brake release: brake was high, then plummeted to 0 before apex
    if (prev.brake > 60 && curr.brake === 0 && Math.abs(curr.steer) < 10) {
      abruptBrakeDrops++;
    }
    // Throttle hesitation: throttle was applied, lifted, then applied again
    if (prev.throttle > 30 && curr.throttle < 15 && curr.speed < 160) {
      throttleHesitations++;
    }
    // Steering scrub: excessive steering lock with plateauing speed
    if (Math.abs(curr.steer) > 35 && curr.speed < 120 && Math.abs(curr.latG) < 1.6) {
      steeringScrubEvents++;
    }
  }

  const trailBrakingScore = Math.max(50, Math.min(95, 90 - abruptBrakeDrops * 10));
  const throttleSmoothness = Math.max(55, Math.min(96, 92 - throttleHesitations * 8));
  const steeringScrub = Math.max(50, Math.min(94, 88 - steeringScrubEvents * 7));

  const lastPoint = downsampled[Math.floor(downsampled.length * 0.75)] || downsampled[0];
  const tyreStats = {
    FL: { temp: `${lastPoint.tempFL}°C`, pressure: `${lastPoint.pressFL} psi` },
    FR: { temp: `${lastPoint.tempFR}°C`, pressure: `${lastPoint.pressFR} psi` },
    RL: { temp: `${lastPoint.tempRL}°C`, pressure: `${lastPoint.pressRL} psi` },
    RR: { temp: `${lastPoint.tempRR}°C`, pressure: `${lastPoint.pressRR} psi` },
  };

  const detectedAnomalies = [];
  if (abruptBrakeDrops > 0) {
    detectedAnomalies.push({
      location: "Heavy Braking Zones",
      description: "Driver dumps brake pedal sharply from peak pressure to 0% rather than trailing into apex",
      channel: "Brake",
    });
  }
  if (steeringScrubEvents > 0) {
    detectedAnomalies.push({
      location: "Slow-to-Medium Corners",
      description: "Excess steering lock added while vehicle yaw rate stalls (front tyre scrub)",
      channel: "Steering",
    });
  }
  if (throttleHesitations > 0) {
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
    maxLatG: Number(maxLatG.toFixed(2)),
    maxDecelG: Number(Math.abs(maxDecelG).toFixed(2)),
    minCornerSpeeds: cornerSpeeds.slice(0, 6),
    trailBrakingScore,
    throttleSmoothness,
    steeringScrub,
    tyreStats,
    detectedAnomalies,
    points: downsampled,
    channels: Object.keys(headerMap),
  };
}

// ---------- Update File Preview Card ----------
function updateLoadedFileCard(data) {
  const card = document.getElementById("loadedFileCard");
  const nameEl = document.getElementById("loadedFileName");
  const metaEl = document.getElementById("loadedFileMeta");
  const channelsEl = document.getElementById("detectedChannelsList");

  if (!data) {
    card?.classList.add("hidden");
    return;
  }

  nameEl.textContent = data.filename;
  metaEl.textContent = `${data.rawCount.toLocaleString()} telemetry points · Lap Time: ${data.lapTime}`;

  channelsEl.innerHTML = "";
  ["Speed", "Throttle", "Brake", "Steering", "Gear", "Tyre Temps", "G-Force"].forEach((ch) => {
    const pill = document.createElement("span");
    pill.className = "channel-pill";
    pill.textContent = ch;
    channelsEl.appendChild(pill);
  });

  card?.classList.remove("hidden");
}

// ---------- Interactive Telemetry Canvas Plotter (MoTeC HUD) ----------
const canvas = document.getElementById("telemetryCanvas");
const ctx = canvas?.getContext("2d");
const canvasWrapper = document.getElementById("canvasWrapper");
const hoverHud = document.getElementById("chartHoverHud");

function renderTelemetryCanvas(hoverIndex = -1) {
  if (!canvas || !ctx || !currentTelemetryPoints || currentTelemetryPoints.length === 0) return;

  // Handle Retina/HiDPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = canvasWrapper.getBoundingClientRect();
  const width = rect.width || 760;
  const height = 240;

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const points = currentTelemetryPoints;
  const maxDist = points[points.length - 1].dist || 1;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 22;
  const paddingBottom = 26;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  // Draw background grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    const val = activeChartChannel === "pedals" ? `${100 - i * 25}%` : (activeChartChannel === "steering" ? `${60 - i * 30}°` : `${8 - i * 2}`);
    ctx.fillText(val, paddingLeft - 6, y + 3);
  }

  // Draw Distance ticks along bottom
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
    const distVal = Math.round(maxDist * frac);
    ctx.fillText(`${distVal}m`, x, height - 10);
  }

  function getX(dist) {
    return paddingLeft + (dist / maxDist) * plotW;
  }

  // Draw Channel 1: Speed Trace (always background or prominent)
  if (activeChartChannel === "pedals" || activeChartChannel === "steering") {
    const maxSpeed = 320;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 210, 190, 0.85)";
    ctx.lineWidth = 2;
    points.forEach((p, idx) => {
      const x = getX(p.dist);
      const y = paddingTop + plotH - (p.speed / maxSpeed) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Mode: Pedals (Throttle in Green, Brake in Red)
  if (activeChartChannel === "pedals") {
    // Throttle (Emerald Green)
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 1.8;
    points.forEach((p, idx) => {
      const x = getX(p.dist);
      const y = paddingTop + plotH - (p.throttle / 100) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Brake (Crimson Red)
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    points.forEach((p, idx) => {
      const x = getX(p.dist);
      const y = paddingTop + plotH - (p.brake / 100) * plotH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Mode: Steering & Lateral G
  if (activeChartChannel === "steering") {
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

    // Lateral G (Purple)
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

  // Mode: Gear & RPM
  if (activeChartChannel === "gear") {
    // Gear (Purple step)
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

  // Hover Scrubber line & cursor
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

    // Glowing dot on speed trace
    const ySpeed = paddingTop + plotH - (pt.speed / 320) * plotH;
    ctx.beginPath();
    ctx.arc(x, ySpeed, 4, 0, Math.PI * 2);
    ctx.fillStyle = "var(--accent-telemetry)";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// Canvas Hover Scrubber Events
canvasWrapper?.addEventListener("mousemove", (e) => {
  if (!currentTelemetryPoints || currentTelemetryPoints.length === 0) return;
  const rect = canvasWrapper.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const paddingLeft = 36;
  const paddingRight = 16;
  const plotW = rect.width - paddingLeft - paddingRight;

  const fraction = Math.max(0, Math.min(1, (mouseX - paddingLeft) / plotW));
  const index = Math.round(fraction * (currentTelemetryPoints.length - 1));

  renderTelemetryCanvas(index);

  const pt = currentTelemetryPoints[index];
  if (pt && hoverHud) {
    hoverHud.classList.remove("hidden");
    document.getElementById("hudDist").textContent = `Dist: ${pt.dist}m`;
    document.getElementById("hudSpeed").textContent = `Speed: ${pt.speed} km/h`;
    document.getElementById("hudThrottle").textContent = `Thr: ${pt.throttle}%`;
    document.getElementById("hudBrake").textContent = `Brk: ${pt.brake}%`;
    document.getElementById("hudSteer").textContent = `Steer: ${pt.steer}°`;
    document.getElementById("hudGear").textContent = `Gear: ${pt.gear}`;
  }
});

canvasWrapper?.addEventListener("mouseleave", () => {
  renderTelemetryCanvas(-1);
  hoverHud?.classList.add("hidden");
});

// Channel toggle buttons
document.querySelectorAll(".channel-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".channel-toggle-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeChartChannel = btn.dataset.channel;
    renderTelemetryCanvas();
  });
});

// ---------- Demo Preset Telemetry Loaders ----------
async function loadDemoTelemetry(presetKey) {
  const presetConfig = {
    spa: {
      game: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Spa-Francorchamps GP",
      weather: "Dry",
      trackTemp: "30°C",
      airTemp: "22°C",
      tyres: "DHE Slick",
      fuel: "35 L",
      complaint: "Front wash and mid-corner understeer into Bus Stop chicane, snap oversteer on kerb exit",
      file: "/sample-telemetry/spa-gt3-motec.csv",
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
      complaint: "Front tyres overheating into Prima Variante braking zone, wheelspin on exit of Ascari",
      file: "/sample-telemetry/monza-gt3-motec.csv",
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
      complaint: "High-speed understeer through Becketts complex, locking inside front into Brooklands",
      file: "/sample-telemetry/silverstone-f1.csv",
      driverStyle: "Momentum / Smooth Roller",
      balance: "Pointy / Loose Rotation",
      target: "Qualifying Hotlap (Peak Grip)",
    },
  };

  const cfg = presetConfig[presetKey];
  if (!cfg) return;

  // Update input fields
  document.getElementById("telGame").value = cfg.game;
  document.getElementById("telCar").value = cfg.car;
  document.getElementById("telTrack").value = cfg.track;
  document.getElementById("telTrackTemp").value = cfg.trackTemp;
  document.getElementById("telAirTemp").value = cfg.airTemp;
  document.getElementById("telTyreCompound").value = cfg.tyres;
  document.getElementById("telFuelLoad").value = cfg.fuel;
  document.getElementById("telDriverComplaint").value = cfg.complaint;
  setSegmentValue("telWeather", cfg.weather);
  setSegmentValue("telDriverStyle", cfg.driverStyle || "Heavy Trail-Braker");
  setSegmentValue("telBalancePreference", cfg.balance || "Neutral Balance");
  setSegmentValue("telSetupTarget", cfg.target || "Qualifying Hotlap (Peak Grip)");

  try {
    const res = await fetch(cfg.file);
    if (!res.ok) throw new Error("Could not load sample CSV.");
    const csvText = await res.text();
    const parsed = parseTelemetryCSV(csvText, `${presetKey}-gt3-motec.csv`);

    currentTelemetryData = parsed;
    currentTelemetryStats = {
      lapTime: parsed.lapTime,
      topSpeed: parsed.topSpeed,
      minSpeed: parsed.minSpeed,
      maxLatG: parsed.maxLatG,
      maxDecelG: parsed.maxDecelG,
      minCornerSpeeds: parsed.minCornerSpeeds,
      trailBrakingScore: parsed.trailBrakingScore,
      throttleSmoothness: parsed.throttleSmoothness,
      steeringScrub: parsed.steeringScrub,
      tyres: parsed.tyreStats,
    };
    currentTelemetryPoints = parsed.points;
    currentAnomalies = parsed.detectedAnomalies;

    updateLoadedFileCard(parsed);
    renderTelemetryCanvas();
  } catch (err) {
    console.error("Failed to load demo telemetry:", err);
  }
}

// Preset button handlers
document.querySelectorAll(".demo-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".demo-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadDemoTelemetry(btn.dataset.preset);
  });
});

// Load default Spa preset on initial boot
loadDemoTelemetry("spa");

// ---------- File Upload & Drag-and-Drop Handlers ----------
const dropzone = document.getElementById("telemetryDropzone");
const fileInput = document.getElementById("telemetryFileInput");
const browseBtn = document.getElementById("browseFileBtn");
const clearFileBtn = document.getElementById("clearFileBtn");

browseBtn?.addEventListener("click", () => fileInput?.click());
dropzone?.addEventListener("click", (e) => {
  if (e.target !== browseBtn) fileInput?.click();
});

dropzone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("drag-over");
});

dropzone?.addEventListener("dragleave", () => {
  dropzone.classList.remove("drag-over");
});

dropzone?.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileUpload(e.dataTransfer.files[0]);
  }
});

fileInput?.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFileUpload(e.target.files[0]);
  }
});

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const text = evt.target.result;
      const parsed = parseTelemetryCSV(text, file.name);

      currentTelemetryData = parsed;
      currentTelemetryStats = {
        lapTime: parsed.lapTime,
        topSpeed: parsed.topSpeed,
        minSpeed: parsed.minSpeed,
        maxLatG: parsed.maxLatG,
        maxDecelG: parsed.maxDecelG,
        minCornerSpeeds: parsed.minCornerSpeeds,
        trailBrakingScore: parsed.trailBrakingScore,
        throttleSmoothness: parsed.throttleSmoothness,
        steeringScrub: parsed.steeringScrub,
        tyres: parsed.tyreStats,
      };
      currentTelemetryPoints = parsed.points;
      currentAnomalies = parsed.detectedAnomalies;

      updateLoadedFileCard(parsed);
      renderTelemetryCanvas();

      // Clear preset button active states
      document.querySelectorAll(".demo-btn").forEach(b => b.classList.remove("active"));
    } catch (err) {
      alert(`Could not parse telemetry file: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

clearFileBtn?.addEventListener("click", () => {
  currentTelemetryData = null;
  currentTelemetryStats = null;
  currentTelemetryPoints = [];
  updateLoadedFileCard(null);
  renderTelemetryCanvas();
});

// ---------- Render AI Telemetry Diagnosis Result ----------
function renderTelemetryResult(result) {
  lastTelemetryResult = result;

  // 1. Score & Overview Banner
  document.getElementById("telScoreNum").textContent = result.overallScore || 82;
  document.getElementById("telLapTimeTag").textContent = `LAP: ${result.lapTimeObserved || currentTelemetryStats?.lapTime || '2:17.482'}`;
  document.getElementById("telDeltaTag").textContent = result.estimatedTimeLost ? `${result.estimatedTimeLost} ON TABLE` : "-0.85s TIME ON TABLE";
  document.getElementById("telLimiterTag").textContent = result.primaryLimiter || "APEX UNDERSTEER & BRAKE DUMP";
  document.getElementById("telVerdictTitle").textContent = result.verdictTitle || "Telemetry Analysis Complete";
  document.getElementById("telExecutiveSummary").textContent = result.executiveSummary || "";

  // 2. Refresh Telemetry Canvas
  renderTelemetryCanvas();

  // 3. 4-Corner Tyre Thermal & Pressure Quad
  const tyres = currentTelemetryStats?.tyres || {};
  if (tyres.FL) {
    document.getElementById("tempValFL").textContent = tyres.FL.temp;
    document.getElementById("pressFL").innerHTML = `${tyres.FL.pressure} <span>(+0.2)</span>`;
  }
  if (tyres.FR) {
    document.getElementById("tempValFR").textContent = tyres.FR.temp;
    document.getElementById("pressFR").innerHTML = `${tyres.FR.pressure} <span>(+0.5)</span>`;
  }
  if (tyres.RL) {
    document.getElementById("tempValRL").textContent = tyres.RL.temp;
    document.getElementById("pressRL").innerHTML = `${tyres.RL.pressure} <span>(0.0)</span>`;
  }
  if (tyres.RR) {
    document.getElementById("tempValRR").textContent = tyres.RR.temp;
    document.getElementById("pressRR").innerHTML = `${tyres.RR.pressure} <span>(+0.2)</span>`;
  }

  // 4. Telemetry KPIs Progress Meters
  const kpisGrid = document.getElementById("telKpisGrid");
  kpisGrid.innerHTML = "";
  const kpis = result.kpiRatings || [
    { name: "Trail Braking", score: currentTelemetryStats?.trailBrakingScore || 72, status: "Needs Work", feedback: "Abrupt brake pedal dump unloads the front axle before apex." },
    { name: "Throttle Traction", score: currentTelemetryStats?.throttleSmoothness || 86, status: "Good", feedback: "Smooth progressive feed-in, minimal wheelspin detected." },
    { name: "Steering Efficiency", score: currentTelemetryStats?.steeringScrub || 75, status: "Fair", feedback: "Excess steering lock added at mid-corner causing front tyre scrub." },
    { name: "Tyre Management", score: 88, status: "Optimal", feedback: "Core temperatures and hot pressures well within operating window." },
    { name: "Chassis Balance", score: 76, status: "Understeer", feedback: "Mechanical front grip deficit in slow-to-medium transitions." },
  ];

  kpis.forEach((kpi) => {
    const card = document.createElement("div");
    card.className = "kpi-card";
    const statusClass = (kpi.status || "").toLowerCase().includes("good") || (kpi.status || "").toLowerCase().includes("optimal") ? "status-good" : (kpi.status || "").toLowerCase().includes("fair") ? "status-fair" : "status-needs-work";

    card.innerHTML = `
      <div class="kpi-header">
        <span class="kpi-name">${escapeHtml(kpi.name)}</span>
        <span class="kpi-score-badge ${statusClass}">${escapeHtml(kpi.status)} (${kpi.score}%)</span>
      </div>
      <div class="kpi-bar-wrap">
        <div class="kpi-bar-fill" style="width: ${kpi.score}%"></div>
      </div>
      <div class="kpi-feedback">${escapeHtml(kpi.feedback)}</div>
    `;
    kpisGrid.appendChild(card);
  });

  // 5. Turn-by-Turn Telemetry Anomalies
  const cornersList = document.getElementById("telCornersList");
  cornersList.innerHTML = "";
  (result.cornerBreakdowns || []).forEach((c) => {
    const card = document.createElement("div");
    card.className = "corner-anomaly-card";
    card.innerHTML = `
      <div class="corner-card-header">
        <span class="corner-title">${escapeHtml(c.corner || c.cornerName || "Sector Anomaly")}</span>
        <span class="corner-delta">${escapeHtml(c.timeDelta || c.delta || "+0.3s")}</span>
      </div>
      <div class="corner-grid">
        <div class="corner-col">
          <span class="corner-col-label">Driver Input Telemetry</span>
          <span class="corner-col-text">${escapeHtml(c.driverInput || c.telemetryFinding || "")}</span>
        </div>
        <div class="corner-col">
          <span class="corner-col-label">Chassis Dynamics Reaction</span>
          <span class="corner-col-text">${escapeHtml(c.chassisResponse || "")}</span>
        </div>
        <div class="corner-col">
          <span class="corner-col-label">Actionable Coach Fix</span>
          <span class="corner-col-text"><strong>${escapeHtml(c.actionableFix || "")}</strong></span>
        </div>
      </div>
    `;
    cornersList.appendChild(card);
  });

  // 6. Driver Technique & Input Coaching
  const coachingGrid = document.getElementById("telCoachingGrid");
  coachingGrid.innerHTML = "";
  (result.driverCoaching || []).forEach((dc) => {
    const card = document.createElement("div");
    card.className = "coaching-card";
    card.innerHTML = `
      <div class="coaching-phase">
        <span class="pulse-dot"></span>${escapeHtml(dc.phase || "PHASE")}
      </div>
      <div class="coaching-tip">${escapeHtml(dc.tip || dc.instruction || "")}</div>
    `;
    coachingGrid.appendChild(card);
  });

  // 7. Click-by-Click Setup Adjustments
  const adjGrid = document.getElementById("telAdjustmentsGrid");
  adjGrid.innerHTML = "";
  (result.setupAdjustments || []).forEach((adj) => {
    const card = document.createElement("div");
    card.className = "adj-card";
    card.innerHTML = `
      <div class="adj-header">
        <span class="adj-comp">${escapeHtml(adj.component || adj.setting || "Component")}</span>
        <span class="adj-change">${escapeHtml(adj.adjustment || adj.change || "Adjust")}</span>
      </div>
      <div class="adj-rationale">${escapeHtml(adj.rationale || adj.reason || "")}</div>
    `;
    adjGrid.appendChild(card);
  });

  // 8. Telemetry-Calibrated Adaptive Setup Sheet
  const adaptiveSecEl = document.getElementById("adaptiveSetupSections");
  const adaptivePhilEl = document.getElementById("adaptivePhilosophyText");
  if (result.adaptiveSetup) {
    if (adaptivePhilEl) {
      adaptivePhilEl.textContent = result.adaptiveSetup.philosophy || "Chassis calibrated to complement your natural driving style while neutralizing observed telemetry flaws.";
    }
    if (adaptiveSecEl) {
      adaptiveSecEl.innerHTML = "";
      (result.adaptiveSetup.sections || []).forEach((sec) => {
        const secCard = document.createElement("div");
        secCard.className = "adaptive-sec-card";
        const count = sec.items?.length || 0;
        secCard.innerHTML = `
          <div class="adaptive-sec-header">
            <span class="adaptive-sec-title">${escapeHtml(sec.title)}</span>
            <span class="adaptive-sec-count">${count} ${count === 1 ? 'SETTING' : 'SETTINGS'}</span>
          </div>
        `;
        (sec.items || []).forEach((item) => {
          const itemRow = document.createElement("div");
          itemRow.className = "adaptive-item-row";
          itemRow.innerHTML = `
            <div class="adaptive-item-main">
              <span class="adaptive-item-label">${escapeHtml(item.label)}</span>
              <span class="adaptive-item-val">${escapeHtml(item.value)}</span>
            </div>
            ${item.styleNote ? `<div class="adaptive-style-note">↳ ${escapeHtml(item.styleNote)}</div>` : ''}
          `;
          secCard.appendChild(itemRow);
        });
        adaptiveSecEl.appendChild(secCard);
      });
    }
  }

  // 9. Pit Wall Team Radio
  document.getElementById("telPitRadio").textContent = result.pitRadioMessage || result.pitWallRadio || "";

  showTelemetryState("telResultState");
}

// ---------- Telemetry Form Submit Handler ----------
const telemetryForm = document.getElementById("telemetryForm");
const analyzeTelemetryBtn = document.getElementById("analyzeTelemetryBtn");

telemetryForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const game = document.getElementById("telGame").value;
  const car = document.getElementById("telCar").value;
  const track = document.getElementById("telTrack").value;

  if (!game || !car || !track) {
    alert("Simulator, car, and track are required.");
    return;
  }

  // Ensure telemetry data is available; if not, parse demo Spa dataset
  if (!currentTelemetryData || currentTelemetryPoints.length === 0) {
    await loadDemoTelemetry("spa");
  }

  const payload = {
    game,
    car,
    track,
    sessionType: getSegmentValue("telSessionType"),
    weather: getSegmentValue("telWeather"),
    trackTemp: document.getElementById("telTrackTemp").value,
    airTemp: document.getElementById("telAirTemp").value,
    tyreCompound: document.getElementById("telTyreCompound").value,
    fuelLoad: document.getElementById("telFuelLoad").value,
    driverStyle: getSegmentValue("telDriverStyle") || "Heavy Trail-Braker",
    balancePreference: getSegmentValue("telBalancePreference") || "Neutral Balance",
    setupTarget: getSegmentValue("telSetupTarget") || "Qualifying Hotlap (Peak Grip)",
    driverComplaint: document.getElementById("telDriverComplaint").value,
    summaryMetrics: currentTelemetryStats,
    sampledPoints: (currentTelemetryPoints || []).slice(0, 45),
    anomalies: currentAnomalies,
  };

  analyzeTelemetryBtn.disabled = true;
  showTelemetryState("telLoadingState");
  startLightsSequence();
  startTelLoadingText();

  try {
    const res = await fetch("/api/analyze-telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Telemetry analysis request failed.");
    }

    renderTelemetryResult(data);
  } catch (err) {
    document.getElementById("telErrorState").textContent = `⚠ ${err.message}`;
    showTelemetryState("telErrorState");
  } finally {
    analyzeTelemetryBtn.disabled = false;
    stopLightsSequence();
    stopTelLoadingText();
  }
});

// ---------- Reset Telemetry Stint ----------
document.getElementById("telResetBtn")?.addEventListener("click", () => {
  showTelemetryState("telEmptyState");
  lastTelemetryResult = null;
});

// ---------- Copy Adaptive Setup Spec Action ----------
const copyAdaptiveSetupBtn = document.getElementById("copyAdaptiveSetupBtn");
copyAdaptiveSetupBtn?.addEventListener("click", () => {
  if (!lastTelemetryResult || !lastTelemetryResult.adaptiveSetup) return;
  const carVal = document.getElementById("telCar")?.value || "Chassis";
  const trackVal = document.getElementById("telTrack")?.value || "Circuit";
  let text = `SIM SETUP AI // TELEMETRY-CALIBRATED ADAPTIVE SETUP SPEC\n`;
  text += `${carVal.toUpperCase()} @ ${trackVal.toUpperCase()}\n`;
  text += `Tuned for: ${getSegmentValue("telDriverStyle") || "Driver Style"} · ${getSegmentValue("telBalancePreference") || "Balance"}\n`;
  text += `${"=".repeat(55)}\n\n`;

  if (lastTelemetryResult.adaptiveSetup.philosophy) {
    text += `[ADAPTIVE PHILOSOPHY]\n${lastTelemetryResult.adaptiveSetup.philosophy}\n\n`;
  }

  (lastTelemetryResult.adaptiveSetup.sections || []).forEach((sec) => {
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
    const originalContent = copyAdaptiveSetupBtn.innerHTML;
    copyAdaptiveSetupBtn.innerHTML = `<span>COPIED ✓</span>`;
    setTimeout(() => {
      copyAdaptiveSetupBtn.innerHTML = originalContent;
    }, 2000);
  }).catch(() => {});
});

// ---------- Copy Telemetry Report Action ----------
const copyTelemetryBtn = document.getElementById("copyTelemetryBtn");
copyTelemetryBtn?.addEventListener("click", () => {
  if (!lastTelemetryResult) return;
  const carVal = document.getElementById("telCar")?.value || "Chassis";
  const trackVal = document.getElementById("telTrack")?.value || "Circuit";
  let text = `SIM SETUP AI // TELEMETRY DIAGNOSTIC REPORT\n`;
  text += `${carVal.toUpperCase()} @ ${trackVal.toUpperCase()} (MoTeC Ingest)\n`;
  text += `${"=".repeat(50)}\n\n`;
  text += `[VERDICT & PACE DELTA]\n`;
  text += `Overall Telemetry Score: ${lastTelemetryResult.overallScore || 82}/100\n`;
  text += `Observed Lap: ${lastTelemetryResult.lapTimeObserved || currentTelemetryStats?.lapTime}\n`;
  text += `Achievable Potential Delta: ${lastTelemetryResult.estimatedTimeLost || '-0.85s'}\n`;
  text += `Primary Limiter: ${lastTelemetryResult.primaryLimiter}\n\n`;

  text += `[EXECUTIVE SUMMARY]\n${lastTelemetryResult.executiveSummary}\n\n`;

  text += `[TURN-BY-TURN TELEMETRY ANOMALIES]\n`;
  (lastTelemetryResult.cornerBreakdowns || []).forEach((c) => {
    text += `• ${c.corner || c.cornerName} (${c.timeDelta || c.delta})\n`;
    text += `  Input Flaw: ${c.driverInput || c.telemetryFinding}\n`;
    text += `  Chassis Reaction: ${c.chassisResponse}\n`;
    text += `  Actionable Fix: ${c.actionableFix}\n\n`;
  });

  text += `[RECOMMENDED SETUP ADJUSTMENTS]\n`;
  (lastTelemetryResult.setupAdjustments || []).forEach((adj) => {
    text += `• ${adj.component || adj.setting}: ${adj.adjustment || adj.change}\n  Rationale: ${adj.rationale || adj.reason}\n`;
  });
  text += `\n`;

  if (lastTelemetryResult.pitRadioMessage) {
    text += `[PIT WALL TEAM RADIO]\n"${lastTelemetryResult.pitRadioMessage}"\n`;
  }

  navigator.clipboard.writeText(text).then(() => {
    const originalContent = copyTelemetryBtn.innerHTML;
    copyTelemetryBtn.innerHTML = `<span>COPIED ✓</span>`;
    setTimeout(() => {
      copyTelemetryBtn.innerHTML = originalContent;
    }, 2000);
  }).catch(() => {});
});

// ---------- Apply Recommendations to Setup Generator Cross-Flow ----------
const applySetupBtn = document.getElementById("applySetupBtn");
applySetupBtn?.addEventListener("click", () => {
  if (!lastTelemetryResult) {
    alert("Please run telemetry analysis first.");
    return;
  }

  // Pre-fill Setup Generator with telemetry context
  document.getElementById("game").value = document.getElementById("telGame").value;
  document.getElementById("car").value = document.getElementById("telCar").value;
  document.getElementById("track").value = document.getElementById("telTrack").value;
  document.getElementById("trackTemp").value = document.getElementById("telTrackTemp").value;
  document.getElementById("airTemp").value = document.getElementById("telAirTemp").value;
  document.getElementById("tyreCompound").value = document.getElementById("telTyreCompound").value;
  document.getElementById("fuelLoad").value = document.getElementById("telFuelLoad").value;

  const adjSummary = (lastTelemetryResult.setupAdjustments || [])
    .map(a => `${a.component || a.setting}: ${a.adjustment || a.change}`)
    .join(", ");

  const combinedIssue = `Diagnosed via Telemetry: ${lastTelemetryResult.primaryLimiter || 'Handling imbalance'}. Recommended tweaks: ${adjSummary}`;
  document.getElementById("handlingIssue").value = combinedIssue;

  // Switch to Setup Generator view
  setWorkspaceMode("setup");

  // Scroll to setup form smoothly
  setupForm?.scrollIntoView({ behavior: "smooth" });
});
