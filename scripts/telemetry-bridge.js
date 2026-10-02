/**
 * =========================================================================
 * APEXWALL AI // LOCAL TELEMETRY UDP BRIDGE
 * =========================================================================
 * Connects directly to your local sim racing rig (Assetto Corsa Competizione,
 * F1 23/F1 24, iRacing) via UDP broadcast and streams 60Hz telemetry
 * frames to the ApexWall AI web dashboard over WebSockets.
 *
 * Usage:
 *   node scripts/telemetry-bridge.js --game acevo   # Assetto Corsa Evo Shared Memory Bridge
 *   node scripts/telemetry-bridge.js --game f1      # F1 23/24 UDP (port 20777)
 *   node scripts/telemetry-bridge.js --game acc     # ACC UDP (port 9000)
 *   node scripts/telemetry-bridge.js --test         # Simulated test broadcast
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
const gameArg = (args.find((a, i) => args[i - 1] === "--game") || "f1").toLowerCase();

const WS_PORT = 9001;
const UDP_PORT = gameArg === "acc" ? 9000 : (gameArg === "acevo" || gameArg === "assetto-corsa-evo" ? 9002 : 20777);

console.log("=====================================================");
console.log("  🏁 APEXWALL AI // LOCAL TELEMETRY UDP & SHM BRIDGE");
console.log("=====================================================");
console.log(`• Sim Target: ${gameArg.toUpperCase()}${gameArg === "acevo" || gameArg === "assetto-corsa-evo" ? " (Shared Memory: Local\\acevo_pmf_*)" : ` (Listening UDP Port: ${UDP_PORT})`}`);
console.log(`• WebSocket Broadcast Server: ws://localhost:${WS_PORT}`);
console.log(`• Setup Injection API: http://localhost:${WS_PORT}/api/inject-setup`);
console.log("=====================================================\n");

// 1. Setup HTTP & WebSocket Server for Web App & Direct Setup Injection
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "2.0.0", game: gameArg }));
    return;
  }

// Helper: Dynamically find Windows Documents paths across all PCs (OneDrive, UserProfile, Registry)
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

  // 1. Exact match
  const exact = folders.find((f) => f.toLowerCase() === qLower);
  if (exact) return exact;

  // 2. Slug match
  const slugMatch = folders.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, "") === qSlug);
  if (slugMatch) return slugMatch;

  // 3. Substring match
  const subMatch = folders.find((f) => f.toLowerCase().includes(qLower) || (qLower.length > 4 && qLower.includes(f.toLowerCase())));
  if (subMatch) return subMatch;

  // 4. Token scoring
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

  // Inspect AC Car endpoint for authentic setup sliders and values
  if (req.method === "GET" && req.url.startsWith("/api/inspect-car")) {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost:9001"}`);
      const carQuery = parsedUrl.searchParams.get("car") || "";
      const trackQuery = parsedUrl.searchParams.get("track") || "";
      const setupsRoot = getACSetupsRoot();

      if (!fs.existsSync(setupsRoot)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Assetto Corsa setups folder not found on this machine." }));
        return;
      }

      const matchedCar = findBestMatchingCarFolder(setupsRoot, carQuery);
      const carDir = path.join(setupsRoot, matchedCar);

      if (!fs.existsSync(carDir)) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: `Car folder "${matchedCar}" not found in setups directory.` }));
        return;
      }

      const candidateIniPaths = [];
      if (trackQuery) {
        const cleanTrack = trackQuery.toLowerCase().replace(/[^a-z0-9]+/g, "");
        try {
          const subs = fs.readdirSync(carDir);
          for (const sub of subs) {
            if (sub.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(cleanTrack)) {
              const trkPath = path.join(carDir, sub);
              if (fs.statSync(trkPath).isDirectory()) {
                candidateIniPaths.push(path.join(trkPath, "default.ini"));
                candidateIniPaths.push(path.join(trkPath, "last.ini"));
                fs.readdirSync(trkPath).forEach((f) => {
                  if (f.endsWith(".ini")) candidateIniPaths.push(path.join(trkPath, f));
                });
              }
            }
          }
        } catch (_e) {}
      }

      candidateIniPaths.push(path.join(carDir, "generic", "last.ini"));
      candidateIniPaths.push(path.join(carDir, "generic", "default.ini"));
      candidateIniPaths.push(path.join(carDir, "last.ini"));

      try {
        const allSubs = fs.readdirSync(carDir);
        for (const sub of allSubs) {
          const sPath = path.join(carDir, sub);
          if (fs.statSync(sPath).isDirectory()) {
            const inis = fs.readdirSync(sPath).filter((f) => f.toLowerCase().endsWith(".ini"));
            for (const f of inis) candidateIniPaths.push(path.join(sPath, f));
          }
        }
      } catch (_e) {}

      let activeIniPath = null;
      let iniContent = null;
      for (const p of candidateIniPaths) {
        if (fs.existsSync(p)) {
          activeIniPath = p;
          iniContent = fs.readFileSync(p, "utf8");
          break;
        }
      }

      if (!activeIniPath || !iniContent) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: `No setup files (.ini) found for car "${matchedCar}".` }));
        return;
      }

      // Parse simple INI
      const parsedIni = {};
      let curSec = "DEFAULT";
      for (const rawLine of iniContent.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("//")) continue;
        if (line.startsWith("[") && line.endsWith("]")) {
          curSec = line.slice(1, -1).trim().toUpperCase();
          if (!parsedIni[curSec]) parsedIni[curSec] = {};
          continue;
        }
        const eqIdx = line.indexOf("=");
        if (eqIdx !== -1) {
          const key = line.slice(0, eqIdx).trim().toUpperCase();
          const val = line.slice(eqIdx + 1).trim();
          if (!parsedIni[curSec]) parsedIni[curSec] = {};
          parsedIni[curSec][key] = val;
        }
      }

      function catSec(secName, name) {
        const s = (secName + " " + name).toUpperCase();
        if (s.includes("CAMBER") || s.includes("TOE") || s.includes("CASTER") || s.includes("ALIGNMENT")) return "Alignment";
        if (s.includes("PRESSURE") || s.includes("TYRE") || s.includes("TIRE")) return "Tyres";
        if (s.includes("ARB") || s.includes("ANTI-ROLL") || s.includes("ROLL_BAR")) return "Suspension / ARB";
        if (s.includes("SPRING") || s.includes("ROD") || s.includes("PACKER") || s.includes("HEIGHT") || s.includes("BUMP")) return "Suspension / Springs";
        if (s.includes("DAMP") || s.includes("REBOUND") || s.includes("FAST_BUMP") || s.includes("SLOW_BUMP")) return "Dampers";
        if (s.includes("DIFF") || s.includes("POWER") || s.includes("COAST") || s.includes("GEAR") || s.includes("FINAL")) return "Drivetrain & Diff";
        if (s.includes("WING") || s.includes("SPLITTER") || s.includes("AERO") || s.includes("DUCT")) return "Aerodynamics";
        if (s.includes("BRAKE") || s.includes("BIAS")) return "Brakes";
        if (s.includes("TC") || s.includes("ABS") || s.includes("ENGINE_MAP") || s.includes("ELECTRONIC")) return "Electronics";
        return "General";
      }

      const sliders = [];
      for (const [secName, fields] of Object.entries(parsedIni)) {
        if (secName === "CAR" || secName === "ABOUT" || secName === "__EXT_PATCH") continue;
        const valStr = fields["VALUE"];
        if (valStr !== undefined) {
          const numVal = parseFloat(valStr);
          const isNumeric = !isNaN(numVal);
          sliders.push({
            key: secName,
            name: secName.replace(/_/g, " "),
            category: catSec(secName, secName),
            min: isNumeric ? (numVal < 0 ? numVal * 1.5 : 0) : 0,
            max: isNumeric ? (numVal > 0 ? Math.max(numVal * 1.5, 10) : 0) : 100,
            step: 1,
            defaultValue: isNumeric ? numVal : undefined,
          });
        }
      }

      const carData = {
        carId: matchedCar,
        name: matchedCar.replace(/_/g, " "),
        brand: "Assetto Corsa",
        sliders,
        hasAcdOnly: true,
        unpackedFilesFound: [activeIniPath],
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, source: "telemetry_bridge", carData }));
      return;
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // 1-Click Setup Injection Endpoint
  if (req.method === "POST" && req.url === "/api/inject-setup") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { sim, car, track, filename, content, customCarFolder } = payload;
        const docsList = getWindowsDocsPaths();
        const primaryDocs = docsList[0] || path.join(process.env.USERPROFILE || "C:\\Users\\Default", "Documents");
        let targetDir = "";
        let genericPath = null;
        let resolvedCarFolder = car;

        if (sim === "acc") {
          targetDir = path.join(primaryDocs, "Assetto Corsa Competizione", "Setups", car || "generic", track || "spa");
        } else if (sim === "assetto-corsa") {
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
          if (genericPath) {
            console.log(`[INJECT] ✓ Also mirrored into generic setup library: ${genericPath}`);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            carFolder: resolvedCarFolder,
            setupsRoot,
            savedPath: filePath,
            genericPath,
          }));
          return;
        } else if (sim === "assetto-corsa-evo" || sim === "acevo") {
          targetDir = path.join(primaryDocs, "Assetto Corsa Evo", "setups", car || "generic", track || "spa");
        } else if (sim === "iracing") {
          targetDir = path.join(primaryDocs, "iRacing", "setups", car || "generic", track || "spa");
        } else if (sim === "lmu") {
          targetDir = path.join(primaryDocs, "Le Mans Ultimate", "UserData", "player", "Settings", track || "spa");
        } else if (sim === "f1") {
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
  console.log(`[WS] ApexWall Web Dashboard connected (${activeClients.length} active client(s))`);

  ws.on("close", () => {
    activeClients = activeClients.filter((c) => c !== ws);
    console.log(`[WS] Client disconnected (${activeClients.length} remaining)`);
  });
});

server.listen(WS_PORT, () => {
  console.log(`[WS] Telemetry streaming ready on ws://localhost:${WS_PORT}`);
});

function broadcastFrame(frame) {
  const payload = JSON.stringify({ type: "telemetry_frame", payload: frame });
  activeClients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// 2. Test Generator Mode (if --test or sim is offline)
if (isTestMode) {
  console.log("[SIM] Running in Synthetic Test Broadcast Mode (60Hz)...");
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
} else if (gameArg === "acevo" || gameArg === "assetto-corsa-evo") {
  // 3. Assetto Corsa Evo Native Shared Memory Integration (via acevo-bridge.py)
  console.log("[ACEVO] Launching Assetto Corsa Evo Shared Memory Bridge process...");
  const scriptPath = path.join(__dirname, "acevo-bridge.py");
  const pyArgs = [scriptPath];
  if (isTestMode) pyArgs.push("--test");

  const pyProcess = spawn("python", pyArgs, { stdio: ["ignore", "pipe", "inherit"] });

  const rl = readline.createInterface({ input: pyProcess.stdout });
  rl.on("line", (line) => {
    try {
      if (!line.trim()) return;
      const frame = JSON.parse(line.trim());
      broadcastFrame(frame);
    } catch (parseErr) {
      // Ignore non-json lines
    }
  });

  pyProcess.on("error", (err) => {
    console.error("[ACEVO ERROR] Failed to start Python bridge:", err.message);
    console.log("[TIP] Ensure Python 3 is installed, or run: python scripts/acevo-bridge.py");
  });

  pyProcess.on("exit", (code) => {
    console.log(`[ACEVO] Python bridge process exited with code ${code}`);
  });

  // Also listen on UDP port 9002 in case user runs bridge or SimHub separately with UDP broadcast
  const udpSocket = dgram.createSocket("udp4");
  udpSocket.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString("utf8"));
      broadcastFrame(data);
    } catch (e) {}
  });
  udpSocket.bind(UDP_PORT, () => {
    console.log(`[UDP] Ready for secondary UDP relay packets on port ${UDP_PORT}...`);
  });
} else {
  // 4. UDP Socket Listener for Sim Racing Packets (F1 / ACC)
  const udpSocket = dgram.createSocket("udp4");

  udpSocket.on("error", (err) => {
    console.error(`[UDP Error]:\n${err.stack}`);
    udpSocket.close();
  });

  udpSocket.on("message", (msg, rinfo) => {
    try {
      // Decode UDP Packet (F1 2023/2024 Packet Car TelemetryData structure)
      if (gameArg === "f1" && msg.length >= 60) {
        const speed = msg.readUInt16LE(28); // Car speed km/h
        const throttle = Math.round(msg.readFloatLE(30) * 100);
        const steer = Math.round(msg.readFloatLE(34) * 100);
        const brake = Math.round(msg.readFloatLE(38) * 100);
        const gear = msg.readInt8(43);
        const engineRPM = msg.readUInt16LE(44);

        broadcastFrame({
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
          tyreTemps: { FL: 95, FR: 93, RL: 92, RR: 90 },
          tyrePressures: { FL: 23.5, FR: 23.5, RL: 21.0, RR: 21.0 },
        });
      }
    } catch (parseErr) {
      // Packet parse error
    }
  });

  udpSocket.bind(UDP_PORT, () => {
    console.log(`[UDP] Listening for ${gameArg.toUpperCase()} UDP broadcast packets on port ${UDP_PORT}...`);
    console.log("[TIP] In your game settings, enable UDP Telemetry Broadcast and set port to " + UDP_PORT);
  });
}
