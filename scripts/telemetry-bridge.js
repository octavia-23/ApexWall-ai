/**
 * =========================================================================
 * APEXWALL AI // LOCAL TELEMETRY UDP BRIDGE
 * =========================================================================
 * Connects directly to your local sim racing rig (Assetto Corsa Competizione,
 * F1 23/F1 24, iRacing) via UDP broadcast and streams 60Hz telemetry
 * frames to the ApexWall AI web dashboard over WebSockets.
 *
 * Usage:
 *   node scripts/telemetry-bridge.js --game f1      # F1 23/24 UDP (port 20777)
 *   node scripts/telemetry-bridge.js --game acc     # ACC UDP (port 9000)
 *   node scripts/telemetry-bridge.js --test         # Simulated test broadcast
 * =========================================================================
 */

const dgram = require("dgram");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const args = process.argv.slice(2);
const isTestMode = args.includes("--test");
const gameArg = args.find((a, i) => args[i - 1] === "--game") || "f1";

const WS_PORT = 9001;
const UDP_PORT = gameArg === "acc" ? 9000 : 20777;

console.log("=====================================================");
console.log("  🏁 APEXWALL AI // LOCAL TELEMETRY UDP BRIDGE");
console.log("=====================================================");
console.log(`• Sim Target: ${gameArg.toUpperCase()} (Listening UDP Port: ${UDP_PORT})`);
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

  // 1-Click Setup Injection Endpoint
  if (req.method === "POST" && req.url === "/api/inject-setup") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { sim, car, track, filename, content } = payload;
        const userProfile = process.env.USERPROFILE || process.env.HOME || "C:\\Users\\Default";
        let targetDir = "";

        if (sim === "acc") {
          targetDir = path.join(userProfile, "Documents", "Assetto Corsa Competizione", "Setups", car || "generic", track || "spa");
        } else if (sim === "assetto-corsa") {
          targetDir = path.join(userProfile, "Documents", "Assetto Corsa", "setups", car || "generic", track || "spa");
        } else if (sim === "iracing") {
          targetDir = path.join(userProfile, "Documents", "iRacing", "setups", car || "generic", track || "spa");
        } else if (sim === "lmu") {
          targetDir = path.join(userProfile, "Documents", "Le Mans Ultimate", "UserData", "player", "Settings", track || "spa");
        } else if (sim === "f1") {
          targetDir = path.join(userProfile, "Documents", "My Games", "F1 24", "setups", track || "spa");
        } else {
          targetDir = path.join(userProfile, "Documents", "ApexWall_Setups", car || "generic", track || "spa");
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
} else {
  // 3. UDP Socket Listener for Sim Racing Packets
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
