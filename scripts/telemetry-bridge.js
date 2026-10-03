/**
 * =========================================================================
 * APEXWALL AI // UNIVERSAL SIM RIG TELEMETRY BRIDGE & SETUP INJECTOR
 * =========================================================================
 * Seamless multi-sim UDP & Shared Memory listener. Streams 60Hz telemetry
 * frames to the ApexWall AI web dashboard over WebSockets, captures full laps
 * automatically, and injects engineered setups with 1 click.
 *
 * Supported Sims (Simultaneous Auto-Detection or Single-Game Mode):
 *   • Automobilista 2 & Project CARS 2 : UDP Port 5606
 *   • Forza Motorsport & Horizon       : UDP Port 5300 ("Data Out")
 *   • F1 23 / 24 / 25                 : UDP Port 20777
 *   • Assetto Corsa Competizione      : Shared Memory (Python bridge)
 *   • Assetto Corsa Evo               : Shared Memory / Relay Port 9002
 *
 * Usage:
 *   node scripts/telemetry-bridge.js             # Unified Auto-Detect (All ports open)
 *   node scripts/telemetry-bridge.js --game ams2 # Dedicated Automobilista 2
 *   node scripts/telemetry-bridge.js --game forza# Dedicated Forza Motorsport
 *   node scripts/telemetry-bridge.js --game f1   # Dedicated F1 24
 *   node scripts/telemetry-bridge.js --game acc  # Dedicated ACC
 *   node scripts/telemetry-bridge.js --test      # Synthetic 60Hz test broadcast
 * =========================================================================
 */

const dgram = require("dgram");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const { WebSocketServer } = require("ws");

const args = process.argv.slice(2);
const isTestMode = args.includes("--test");
const gameArgIndex = args.indexOf("--game");
const gameFilter = gameArgIndex !== -1 && args[gameArgIndex + 1] ? args[gameArgIndex + 1].toLowerCase() : null;

const WS_PORT = 9001;

// Port registry for multi-sim architecture
const PORTS = {
  AMS2: 5606,   // Automobilista 2 & Project CARS 2 (Packet 0)
  FORZA: 5300,  // Forza Motorsport & Horizon ("Data Out")
  F1: 20777,    // F1 23 / F1 24 / F1 25 (Packet 6 Telemetry)
  ACEVO: 9002,  // Assetto Corsa Evo UDP Relay
};

let activeGame = gameFilter ? gameFilter.toUpperCase() : "Awaiting Sim Connection";
let totalPacketsReceived = 0;
let lastPacketTime = 0;

// Telemetry Lap Recorder State
let activeLapBuffer = [];
let lastCompletedLap = null;
let lapCounter = 0;
let lapStartTime = Date.now();
let lastLapDistance = 0;

console.log("=================================================================");
console.log("  🏁 APEXWALL AI // UNIVERSAL SIM RIG TELEMETRY BRIDGE & INJECTOR");
console.log("=================================================================");
console.log(`• Mode: ${gameFilter ? `Dedicated [${gameFilter.toUpperCase()}]` : "Unified Auto-Detect (All Sims Active)"}`);
console.log(`• Listening Ports:`);
if (!gameFilter || gameFilter === "ams2" || gameFilter === "automobilista") console.log(`   - Automobilista 2 / PCars 2 : UDP ${PORTS.AMS2}`);
if (!gameFilter || gameFilter === "forza")                                console.log(`   - Forza Motorsport / Horizon: UDP ${PORTS.FORZA}`);
if (!gameFilter || gameFilter === "f1")                                   console.log(`   - F1 23 / F1 24 / F1 25     : UDP ${PORTS.F1}`);
if (!gameFilter || gameFilter === "acc")                                  console.log(`   - Assetto Corsa Competizione: Shared Memory (Python bridge)`);
if (!gameFilter || gameFilter === "acevo")                                console.log(`   - Assetto Corsa Evo         : UDP ${PORTS.ACEVO} / Shared Memory`);
console.log(`• WebSocket Dashboard Server : ws://localhost:${WS_PORT}`);
console.log(`• HTTP Setup Injection API   : http://localhost:${WS_PORT}/api/inject-setup`);
console.log(`• Lap Telemetry Ingest API   : http://localhost:${WS_PORT}/api/latest-lap`);
console.log("=================================================================\n");

// --- Helper Functions for Windows Paths & Setup Folders ---

function getWindowsDocsPaths() {
  const candidates = [];
  if (process.platform === "win32") {
    try {
      const { execSync } = require("child_process");
      const regCmd = 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Personal';
      const regOutput = execSync(regCmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const match = regOutput.match(/Personal\s+REG_\w+\s+(.*)/i);
      if (match && match[1]) {
        let regPath = match[1].trim();
        const userProf = process.env.USERPROFILE || "";
        regPath = regPath.replace(/%USERPROFILE%/i, userProf);
        if (regPath && fs.existsSync(regPath)) candidates.push(regPath);
      }
    } catch (_err) {}
  }

  const userProfile = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\Default";
  if (userProfile) {
    candidates.push(path.join(userProfile, "OneDrive", "Documents"));
    candidates.push(path.join(userProfile, "Documents"));
  }
  if (process.env.OneDrive) candidates.push(path.join(process.env.OneDrive, "Documents"));
  if (process.env.OneDriveConsumer) candidates.push(path.join(process.env.OneDriveConsumer, "Documents"));

  const seen = new Set();
  return candidates.filter((p) => {
    if (!p) return false;
    const n = path.normalize(p).toLowerCase();
    if (seen.has(n)) return false;
    seen.add(n);
    return fs.existsSync(p);
  });
}

function getACSetupsRoot() {
  const docsList = getWindowsDocsPaths();
  let bestRoot = null;
  let maxCars = -1;

  for (const doc of docsList) {
    const candidate = path.join(doc, "Assetto Corsa", "setups");
    if (fs.existsSync(candidate)) {
      try {
        const count = fs.readdirSync(candidate).filter((f) => {
          try {
            return fs.statSync(path.join(candidate, f)).isDirectory();
          } catch {
            return false;
          }
        }).length;
        if (count > maxCars) {
          maxCars = count;
          bestRoot = candidate;
        }
      } catch (_e) {}
    }
  }

  if (!bestRoot && docsList.length > 0) {
    bestRoot = path.join(docsList[0], "Assetto Corsa", "setups");
  } else if (!bestRoot) {
    const up = process.env.USERPROFILE || "C:\\Users\\Default";
    bestRoot = path.join(up, "Documents", "Assetto Corsa", "setups");
  }

  return bestRoot;
}

function findBestMatchingCarFolder(setupsRoot, carQuery) {
  if (!fs.existsSync(setupsRoot)) return carQuery || "generic";
  const folders = fs.readdirSync(setupsRoot).filter((f) => {
    try {
      return fs.statSync(path.join(setupsRoot, f)).isDirectory() && !f.startsWith(".");
    } catch {
      return false;
    }
  });

  if (folders.length === 0) return carQuery || "generic";

  const qLower = (carQuery || "").toLowerCase().trim();
  const qSlug = qLower.replace(/[^a-z0-9]+/g, "");
  const qTokens = qLower.split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !["the", "car", "mod", "assetto", "corsa"].includes(t));

  const exact = folders.find((f) => f.toLowerCase() === qLower);
  if (exact) return exact;

  const slugMatch = folders.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, "") === qSlug);
  if (slugMatch) return slugMatch;

  const subMatch = folders.find((f) => f.toLowerCase().includes(qLower) || (qLower.length > 4 && qLower.includes(f.toLowerCase())));
  if (subMatch) return subMatch;

  let bestFolder = null;
  let highestScore = 0;

  for (const f of folders) {
    const fLower = f.toLowerCase();
    const fTokens = fLower.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
    let score = 0;

    for (const t of qTokens) {
      if (fTokens.includes(t)) {
        if (/^\d{4}$/.test(t)) score += 6;
        else if (["rss", "vrc", "ferrari", "porsche", "bmw", "audi", "amg", "mercedes", "mclaren", "lamborghini", "redbull", "alpine", "clio"].includes(t)) score += 4;
        else score += 2;
      } else if (fLower.includes(t)) {
        score += 1;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestFolder = f;
    }
  }

  if (bestFolder && highestScore >= 2) return bestFolder;
  return qLower.replace(/[^a-z0-9]+/g, "_") || "generic";
}

// Convert recorded points buffer into MoTeC CSV standard string
function pointsToCSV(points, gameTitle = "Live Telemetry") {
  if (!points || points.length === 0) return "";
  const headers = [
    "Time", "Distance", "Speed", "Throttle", "Brake", "Steer", "Gear", "RPM", "LatG", "LongG",
    "TempFL", "TempFR", "TempRL", "TempRR", "PressFL", "PressFR", "PressRL", "PressRR"
  ];
  const rows = [headers.join(",")];
  points.forEach((p) => {
    rows.push([
      (p.time || 0).toFixed(3),
      Math.round(p.dist || 0),
      Math.round(p.speed || 0),
      Math.round(p.throttle || 0),
      Math.round(p.brake || 0),
      (p.steer || 0).toFixed(1),
      p.gear || 1,
      Math.round(p.rpm || 0),
      (p.latG || 0).toFixed(2),
      (p.longG || 0).toFixed(2),
      (p.tempFL || 85).toFixed(1),
      (p.tempFR || 85).toFixed(1),
      (p.tempRL || 85).toFixed(1),
      (p.tempRR || 85).toFixed(1),
      (p.pressFL || 27.0).toFixed(2),
      (p.pressFR || 27.0).toFixed(2),
      (p.pressRL || 27.0).toFixed(2),
      (p.pressRR || 27.0).toFixed(2),
    ].join(","));
  });
  return rows.join("\n");
}

// --- HTTP & WebSocket Server ---

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health / Status Endpoint
  if (req.method === "GET" && (req.url === "/api/health" || req.url === "/api/status")) {
    const isReceiving = (Date.now() - lastPacketTime) < 3000;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      version: "2.1.0",
      activeGame,
      isReceiving,
      totalPackets: totalPacketsReceived,
      lapCounter,
      currentLapPointsCount: activeLapBuffer.length,
      hasCompletedLap: !!lastCompletedLap,
      lastLapTime: lastCompletedLap ? lastCompletedLap.lapTime : null,
      lastLapPointCount: lastCompletedLap ? lastCompletedLap.points.length : 0,
    }));
    return;
  }

  // Latest Recorded Lap JSON Endpoint (Direct Ingest for ApexWall Analyzer)
  if (req.method === "GET" && req.url === "/api/latest-lap") {
    const lapToReturn = lastCompletedLap || (activeLapBuffer.length > 50 ? {
      game: activeGame,
      lapTime: ((Date.now() - lapStartTime) / 1000).toFixed(2),
      points: activeLapBuffer,
    } : null);

    if (!lapToReturn) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "No telemetry lap recorded yet. Drive on track to buffer telemetry." }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      game: lapToReturn.game || activeGame,
      lapTime: lapToReturn.lapTime,
      pointCount: lapToReturn.points.length,
      points: lapToReturn.points,
    }));
    return;
  }

  // Latest Recorded Lap CSV Format
  if (req.method === "GET" && req.url === "/api/latest-lap.csv") {
    const points = lastCompletedLap ? lastCompletedLap.points : activeLapBuffer;
    if (!points || points.length === 0) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("No telemetry points available.");
      return;
    }
    const csvData = pointsToCSV(points, activeGame);
    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="apexwall_${activeGame.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_lap.csv"`
    });
    res.end(csvData);
    return;
  }

  // Manual Lap Trigger
  if (req.method === "POST" && req.url === "/api/save-lap") {
    if (activeLapBuffer.length < 20) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Lap buffer too short to save." }));
      return;
    }
    const lapTime = ((Date.now() - lapStartTime) / 1000).toFixed(2);
    lastCompletedLap = {
      game: activeGame,
      lapTime,
      points: [...activeLapBuffer],
    };
    lapCounter++;
    activeLapBuffer = [];
    lapStartTime = Date.now();
    console.log(`[LAP] 🏁 Manually saved Lap ${lapCounter} (${lapTime}s, ${lastCompletedLap.points.length} points)`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, lapCounter, lapTime, pointCount: lastCompletedLap.points.length }));
    return;
  }

  // List AC Cars endpoint for dashboard autocomplete
  if (req.method === "GET" && req.url.startsWith("/api/ac-cars")) {
    const setupsRoot = getACSetupsRoot();
    let cars = [];
    if (fs.existsSync(setupsRoot)) {
      try {
        cars = fs.readdirSync(setupsRoot).filter((f) => {
          try {
            return fs.statSync(path.join(setupsRoot, f)).isDirectory() && !f.startsWith(".");
          } catch {
            return false;
          }
        }).sort((a, b) => a.localeCompare(b));
      } catch (_e) {}
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, setupsRoot, count: cars.length, cars }));
    return;
  }

  // 1-Click Setup Injection Endpoint for ALL Sim Titles
  if (req.method === "POST" && req.url === "/api/inject-setup") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { sim, car, track, filename, content, customCarFolder } = payload;
        const docsList = getWindowsDocsPaths();
        const primaryDocs = docsList[0] || path.join(process.env.USERPROFILE || "C:\\Users\\Default", "Documents");
        let targetDir = "";
        let genericPath = null;
        let resolvedCarFolder = car;

        const simNorm = (sim || "").toLowerCase();

        if (simNorm === "acc" || simNorm.includes("competizione")) {
          targetDir = path.join(primaryDocs, "Assetto Corsa Competizione", "Setups", car || "generic", track || "spa");
        } else if (simNorm === "assetto-corsa" || simNorm === "ac") {
          const setupsRoot = getACSetupsRoot();
          resolvedCarFolder = customCarFolder ? customCarFolder.trim() : findBestMatchingCarFolder(setupsRoot, car);

          targetDir = path.join(setupsRoot, resolvedCarFolder, track || "ks_silverstone");
          const genericDir = path.join(setupsRoot, resolvedCarFolder, "generic");

          fs.mkdirSync(targetDir, { recursive: true });
          const filePath = path.join(targetDir, filename);
          fs.writeFileSync(filePath, content, "utf8");

          try {
            fs.mkdirSync(genericDir, { recursive: true });
            const genFilePath = path.join(genericDir, filename);
            fs.writeFileSync(genFilePath, content, "utf8");
            genericPath = genFilePath;
          } catch (_e) {}

          console.log(`[INJECT] ✓ Successfully injected AC setup into: ${filePath}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, carFolder: resolvedCarFolder, setupsRoot, savedPath: filePath, genericPath }));
          return;
        } else if (simNorm === "ams2" || simNorm.includes("automobilista")) {
          // Native Automobilista 2 tuning tree
          targetDir = path.join(primaryDocs, "Automobilista 2", "savegame", "tuning", car || "generic", track || "spa");
        } else if (simNorm === "assetto-corsa-evo" || simNorm === "acevo") {
          targetDir = path.join(primaryDocs, "Assetto Corsa Evo", "setups", car || "generic", track || "spa");
        } else if (simNorm === "iracing") {
          targetDir = path.join(primaryDocs, "iRacing", "setups", car || "generic", track || "spa");
        } else if (simNorm === "lmu" || simNorm.includes("lemans")) {
          targetDir = path.join(primaryDocs, "Le Mans Ultimate", "UserData", "player", "Settings", track || "spa");
        } else if (simNorm === "rfactor2" || simNorm.includes("rfactor")) {
          targetDir = path.join(primaryDocs, "rFactor 2", "UserData", "player", "Settings", track || "spa");
        } else if (simNorm === "raceroom") {
          targetDir = path.join(primaryDocs, "SimBin", "RaceRoom Racing Experience", "UserData", "CarSetups", car || "generic", track || "spa");
        } else if (simNorm === "f1") {
          targetDir = path.join(primaryDocs, "My Games", "F1 24", "setups", track || "spa");
        } else {
          targetDir = path.join(primaryDocs, "ApexWall_Setups", car || "generic", track || "spa");
        }

        fs.mkdirSync(targetDir, { recursive: true });
        const filePath = path.join(targetDir, filename);
        fs.writeFileSync(filePath, content, "utf8");

        console.log(`[INJECT] ✓ Successfully injected setup into: ${filePath}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, savedPath: filePath }));
      } catch (err) {
        console.error(`[INJECT ERROR]:`, err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

const wss = new WebSocketServer({ server });
let activeClients = [];

wss.on("connection", (ws) => {
  activeClients.push(ws);
  console.log(`[WS] Dashboard connected (${activeClients.length} active client(s))`);
  ws.on("close", () => {
    activeClients = activeClients.filter((c) => c !== ws);
  });
});

server.listen(WS_PORT, () => {
  console.log(`[WS] Telemetry streaming ready on ws://localhost:${WS_PORT}`);
});

// Broadcast frame to WebSocket clients & buffer into active lap
function broadcastFrame(frame) {
  totalPacketsReceived++;
  lastPacketTime = Date.now();

  const payload = JSON.stringify({ type: "telemetry_frame", payload: frame });
  activeClients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });

  // Record into lap buffer if car is moving
  if (frame.speed > 3) {
    const elapsedSec = (Date.now() - lapStartTime) / 1000;
    const dist = frame.lapDistance || (activeLapBuffer.length * 6);

    // Auto-detect lap completion (lap distance reset or lap distance > 3000m with distance drop)
    if (frame.lapDistance && frame.lapDistance < 100 && lastLapDistance > 1000 && activeLapBuffer.length > 200) {
      lapCounter++;
      lastCompletedLap = {
        game: activeGame,
        lapTime: elapsedSec.toFixed(2),
        points: [...activeLapBuffer],
      };
      console.log(`[LAP] 🏁 Lap ${lapCounter} Completed (${elapsedSec.toFixed(2)}s, ${lastCompletedLap.points.length} points)`);
      activeLapBuffer = [];
      lapStartTime = Date.now();

      // Notify web clients of completed lap
      const lapMsg = JSON.stringify({
        type: "lap_completed",
        payload: { lapNumber: lapCounter, lapTime: lastCompletedLap.lapTime, pointCount: lastCompletedLap.points.length }
      });
      activeClients.forEach((c) => { if (c.readyState === 1) c.send(lapMsg); });
    }

    lastLapDistance = frame.lapDistance || 0;

    activeLapBuffer.push({
      time: Number(elapsedSec.toFixed(3)),
      dist: Math.round(dist),
      speed: Math.round(frame.speed || 0),
      throttle: Math.round(frame.throttle || 0),
      brake: Math.round(frame.brake || 0),
      steer: Number((frame.steer || 0).toFixed(1)),
      gear: frame.gear === "N" ? 0 : frame.gear === "R" ? -1 : Number(frame.gear) || 3,
      rpm: Math.round(frame.rpm || 0),
      latG: Number((frame.latG || 0).toFixed(2)),
      longG: Number((frame.longG || 0).toFixed(2)),
      tempFL: frame.tyreTemps?.FL || 85,
      tempFR: frame.tyreTemps?.FR || 85,
      tempRL: frame.tyreTemps?.RL || 85,
      tempRR: frame.tyreTemps?.RR || 85,
      pressFL: frame.tyrePressures?.FL || 27.0,
      pressFR: frame.tyrePressures?.FR || 27.0,
      pressRL: frame.tyrePressures?.RL || 27.0,
      pressRR: frame.tyrePressures?.RR || 27.0,
    });

    // Cap at 20,000 points (~5-6 mins of driving) to avoid memory explosion
    if (activeLapBuffer.length > 20000) activeLapBuffer.shift();
  }
}

// =========================================================================
// SIM TELEMETRY DECODERS
// =========================================================================

// 1. Automobilista 2 & Project CARS 2 (Port 5606, Packet 0: eCarPhysics)
function parseAMS2Packet(msg) {
  if (msg.length < 180) return null;
  const packetType = msg.readUInt8(10);
  if (packetType !== 0) return null; // 0 = eCarPhysics

  const brakeRaw = msg.readUInt8(29);
  const throttleRaw = msg.readUInt8(30);
  const speedMs = msg.readFloatLE(36);
  const speedKmh = Math.max(0, Math.round(speedMs * 3.6));
  const rpm = msg.readUInt16LE(40);
  const maxRpm = msg.readUInt16LE(42) || 8500;
  const steerRaw = msg.readInt8(44);
  const gearByte = msg.readUInt8(45);
  const gearNum = gearByte & 0x0f;
  const gear = gearNum === 0 ? "N" : gearNum === 15 ? "R" : gearNum;

  const throttle = Math.min(100, Math.max(0, Math.round((throttleRaw / 255) * 100)));
  const brake = Math.min(100, Math.max(0, Math.round((brakeRaw / 255) * 100)));
  const steer = Math.round((steerRaw / 127) * 45);

  const latAcc = msg.readFloatLE(100);
  const longAcc = msg.readFloatLE(108);
  const latG = Math.round((latAcc / 9.80665) * 100) / 100;
  const longG = Math.round((longAcc / 9.80665) * 100) / 100;

  const tempFL = msg.readUInt8(176);
  const tempFR = msg.readUInt8(177);
  const tempRL = msg.readUInt8(178);
  const tempRR = msg.readUInt8(179);

  return {
    game: "Automobilista 2",
    speed: speedKmh,
    rpm,
    maxRpm,
    gear,
    throttle,
    brake,
    steer,
    latG: isNaN(latG) ? 0 : latG,
    longG: isNaN(longG) ? 0 : longG,
    lapDistance: 0,
    totalDistance: 5000,
    lapTime: 0,
    delta: 0,
    tyreTemps: { FL: tempFL || 85, FR: tempFR || 85, RL: tempRL || 85, RR: tempRR || 85 },
    tyrePressures: { FL: 26.8, FR: 26.8, RL: 26.4, RR: 26.4 },
  };
}

// 2. Forza Motorsport & Forza Horizon (Port 5300, 324-byte Data Out)
function parseForzaPacket(msg) {
  if (msg.length < 311) return null;
  const isRaceOn = msg.readInt32LE(0);
  if (isRaceOn === 0 && msg.length < 324) return null;

  const maxRpm = Math.round(msg.readFloatLE(8)) || 8000;
  const currentRpm = Math.round(msg.readFloatLE(16));
  const accelX = msg.readFloatLE(20);
  const accelZ = msg.readFloatLE(28);
  const latG = Math.round((accelX / 9.80665) * 100) / 100;
  const longG = Math.round((accelZ / 9.80665) * 100) / 100;

  let speedKmh = 0;
  if (msg.length >= 236) {
    const speedMs = msg.readFloatLE(232);
    speedKmh = Math.max(0, Math.round(speedMs * 3.6));
  }

  let tFL = 85, tFR = 85, tRL = 85, tRR = 85;
  if (msg.length >= 260) {
    const fFL = msg.readFloatLE(244);
    const fFR = msg.readFloatLE(248);
    const fRL = msg.readFloatLE(252);
    const fRR = msg.readFloatLE(256);
    if (fFL > 50) tFL = Math.round((fFL - 32) * (5 / 9));
    if (fFR > 50) tFR = Math.round((fFR - 32) * (5 / 9));
    if (fRL > 50) tRL = Math.round((fRL - 32) * (5 / 9));
    if (fRR > 50) tRR = Math.round((fRR - 32) * (5 / 9));
  }

  let lapDist = 0;
  if (msg.length >= 272) lapDist = Math.round(msg.readFloatLE(268));

  let throttle = 0, steer = 0, brake = 0, gear = "N";
  if (msg.length >= 297) {
    throttle = Math.min(100, Math.max(0, Math.round((msg.readUInt8(291) / 255) * 100)));
    steer = Math.round((msg.readInt8(292) / 127) * 45);
    brake = Math.min(100, Math.max(0, Math.round((msg.readUInt8(293) / 255) * 100)));
    const gVal = msg.readUInt8(296);
    gear = gVal === 0 ? "R" : gVal === 11 ? "N" : gVal;
  }

  return {
    game: "Forza Motorsport",
    speed: speedKmh,
    rpm: currentRpm,
    maxRpm,
    gear,
    throttle,
    brake,
    steer,
    latG: isNaN(latG) ? 0 : latG,
    longG: isNaN(longG) ? 0 : longG,
    lapDistance: lapDist,
    totalDistance: 5000,
    lapTime: 0,
    delta: 0,
    tyreTemps: { FL: tFL, FR: tFR, RL: tRL, RR: tRR },
    tyrePressures: { FL: 28.0, FR: 28.0, RL: 27.5, RR: 27.5 },
  };
}

// 3. F1 22 / 23 / 24 / 25 (Port 20777, Packet 6: Car Telemetry)
function parseF1Packet(msg) {
  if (!msg || msg.length < 24) return null;

  const packetFormat = msg.readUInt16LE(0);
  let headerSize;
  let packetId;
  let playerCarIndex;

  if (packetFormat >= 2023) {
    if (msg.length < 29) return null;
    headerSize = 29;
    packetId = msg.readUInt8(6);
    playerCarIndex = msg.readUInt8(27);
  } else if (packetFormat === 2022) {
    if (msg.length < 24) return null;
    headerSize = 24;
    packetId = msg.readUInt8(5);
    playerCarIndex = msg.readUInt8(22);
  } else {
    return null;
  }

  // Validate packetId == 6 (CarTelemetry)
  if (packetId !== 6) return null;
  if (playerCarIndex < 0 || playerCarIndex >= 22) return null;

  const recordStride = 60;
  const recordOffset = headerSize + playerCarIndex * recordStride;
  if (msg.length < recordOffset + recordStride) return null;

  const speed = msg.readUInt16LE(recordOffset + 0);
  const throttleRaw = msg.readFloatLE(recordOffset + 2);
  const steerRaw = msg.readFloatLE(recordOffset + 6);
  const brakeRaw = msg.readFloatLE(recordOffset + 10);
  const gear = msg.readInt8(recordOffset + 15);
  const engineRPM = msg.readUInt16LE(recordOffset + 16);

  const throttle = Math.min(100, Math.max(0, Math.round(throttleRaw * 100)));
  const brake = Math.min(100, Math.max(0, Math.round(brakeRaw * 100)));
  const steer = Math.round(steerRaw * 100);

  return {
    game: packetFormat === 2022 ? "F1 22" : packetFormat === 2023 ? "F1 23" : "F1 24",
    speed,
    rpm: engineRPM,
    maxRpm: 15000,
    gear: gear === 0 ? "N" : gear === -1 ? "R" : gear,
    throttle,
    brake,
    steer,
    latG: 0,
    longG: 0,
    lapDistance: 0,
    totalDistance: 5891,
    lapTime: 0,
    delta: 0,
  };
}

// =========================================================================
// SOCKET INITIALIZATION & LISTENERS
// =========================================================================

if (isTestMode) {
  console.log("[SIM] Running in Synthetic Test Broadcast Mode (60Hz)...");
  activeGame = "Synthetic Rig Test";
  let progress = 0;
  setInterval(() => {
    progress = (progress + 0.002) % 1;
    const speed = 120 + Math.sin(progress * 15) * 80;
    const thr = Math.max(0, Math.sin(progress * 10) * 100);
    const brk = thr > 20 ? 0 : 85;
    const steer = Math.sin(progress * 25) * 45;

    broadcastFrame({
      speed: Math.round(speed),
      rpm: 7200,
      maxRpm: 8500,
      gear: speed > 180 ? 5 : speed > 130 ? 4 : 3,
      throttle: Math.round(thr),
      brake: Math.round(brk),
      steer: Math.round(steer),
      latG: Math.round((steer / 45) * 2.5 * 100) / 100,
      longG: Math.round((brk > 0 ? -3.2 : 1.1) * 100) / 100,
      lapDistance: Math.round(progress * 7004),
      totalDistance: 7004,
      lapTime: Math.round(progress * 137.4 * 10) / 10,
      delta: -0.15,
      tyreTemps: { FL: 90, FR: 88, RL: 85, RR: 84 },
      tyrePressures: { FL: 26.9, FR: 27.1, RL: 26.8, RR: 27.0 },
    });
  }, 1000 / 60);
} else {
  // Helper to attach a UDP listener safely
  function startUDPListener(name, port, parserFn) {
    if (gameFilter && gameFilter !== name.toLowerCase()) return;
    try {
      const sock = dgram.createSocket("udp4");
      sock.on("error", (err) => {
        console.warn(`[UDP ${name}]: ${err.message}`);
        try { sock.close(); } catch (_e) {}
      });

      sock.on("message", (msg) => {
        try {
          const frame = parserFn(msg);
          if (frame) {
            if (activeGame !== frame.game) {
              activeGame = frame.game;
              console.log(`[AUTO-DETECT] 🏁 Active Rig Stream Connected: [${activeGame}] on port ${port}`);
            }
            broadcastFrame(frame);
          }
        } catch (_err) {}
      });

      sock.bind(port, () => {
        console.log(`[UDP] ✓ Listening for ${name.padEnd(22)} on port ${port}`);
      });
    } catch (e) {
      console.warn(`[UDP ${name}] Could not bind port ${port}: ${e.message}`);
    }
  }

  // 1. Automobilista 2 & Project CARS 2
  startUDPListener("Automobilista 2", PORTS.AMS2, parseAMS2Packet);

  // 2. Forza Motorsport
  startUDPListener("Forza Motorsport", PORTS.FORZA, parseForzaPacket);

  // 3. F1 23/24/25
  startUDPListener("F1 24 / F1 23", PORTS.F1, parseF1Packet);

  // 4. Assetto Corsa Evo Relay
  startUDPListener("AC Evo Relay", PORTS.ACEVO, (msg) => {
    try {
      const data = JSON.parse(msg.toString("utf8"));
      return { game: "Assetto Corsa Evo", ...data };
    } catch {
      return null;
    }
  });

  // 5. Launch Assetto Corsa Evo Python Bridge if requested
  if (gameFilter === "acevo" || gameFilter === "assetto-corsa-evo") {
    console.log("[ACEVO] Launching Assetto Corsa Evo Shared Memory Bridge process...");
    const scriptPath = path.join(__dirname, "acevo-bridge.py");
    if (fs.existsSync(scriptPath)) {
      const pyProcess = spawn("python", [scriptPath], { stdio: ["ignore", "pipe", "inherit"] });
      const rl = readline.createInterface({ input: pyProcess.stdout });
      rl.on("line", (line) => {
        try {
          if (!line.trim()) return;
          const frame = JSON.parse(line.trim());
          activeGame = "Assetto Corsa Evo";
          broadcastFrame(frame);
        } catch (_e) {}
      });
    }
  }

  // 6. Launch Assetto Corsa Competizione Python Bridge if requested
  if (gameFilter === "acc" || gameFilter === "assetto-corsa-competizione") {
    console.log("[ACC] Launching Assetto Corsa Competizione Shared Memory Bridge process...");
    const scriptPath = path.join(__dirname, "acc-bridge.py");
    if (fs.existsSync(scriptPath)) {
      const pyProcess = spawn("python", [scriptPath], { stdio: ["ignore", "pipe", "inherit"] });
      const rl = readline.createInterface({ input: pyProcess.stdout });
      rl.on("line", (line) => {
        try {
          if (!line.trim()) return;
          const frame = JSON.parse(line.trim());
          activeGame = "Assetto Corsa Competizione";
          broadcastFrame(frame);
        } catch (_e) {}
      });
    }
  }
}
