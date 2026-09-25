# Sim Setup AI & Telemetry Analyzer

A professional AI race engineering suite that generates full car setups and analyzes real sim racing telemetry logs. Built with a dark "pit wall telemetry" UI, interactive MoTeC-style multi-channel traces, and AI-powered driver coaching and chassis diagnostics.

## Features

### 1. 🏎 Setup Generator (`01 // SETUP GENERATOR`)
- Select simulator title (**iRacing, Assetto Corsa Competizione, Assetto Corsa, rFactor 2, Automobilista 2, Le Mans Ultimate, F1 24/25, GT7**, etc.).
- Input car model, circuit layout, track condition (Dry / Damp / Wet), session type (Practice, Quali, Race), temperatures, and fuel load.
- Define driver handling complaints (e.g. mid-corner understeer, snap exit oversteer, high tire wear).
- Generates engineering-grade setup sheets with Tyres & Pressures, Suspension, Aero, Drivetrain, Brakes, Gearing, and Electronics, plus race engineer notes.

### 2. 📊 Telemetry Analyzer (`02 // TELEMETRY ANALYZER`)
- **Telemetry Log Ingest**: Upload telemetry files (**MoTeC i2 CSV, Popometer, ACC CSV, iRacing Telemetry, JSON logs, or plain text**).
- **1-Click Demo Motorsport Presets**:
  - `Spa-Francorchamps GP` — Ferrari 296 GT3 (2:17.482)
  - `Monza GP` — Porsche 992 GT3 R (1:47.310)
  - `Silverstone GP` — Red Bull RB20 F1 (1:28.150)
- **Interactive MoTeC-Grade Telemetry HUD**:
  - High-precision Canvas trace showing **Speed (km/h)**, **Throttle %**, **Brake %**, **Steering Angle (deg)**, **Lateral G**, and **Gear / Engine RPM**.
  - Interactive hover scrubber showing exact meter-by-meter telemetry values in real time.
- **4-Corner Tyre Thermal & Pressure Quad HUD**:
  - Visual car wireframe with FL, FR, RL, RR tires.
  - Live core & surface temperatures, hot pressures with delta from target, and Inner-Middle-Outer (IMO) camber gradients.
- **Computed Telemetry Metrics Engine**:
  - Trail-Braking Linearity & Release Score (detects abrupt brake dumps).
  - Throttle Application & Traction Score (detects wheelspin and hesitation).
  - Steering Scrub & Understeer Index (detects excess lock vs yaw rate).
- **AI Race Engineer Comprehensive Report & Telemetry-Calibrated Setup**:
  - **Telemetry-Driven Adaptive Setup Synthesis**: Automatically generates a complete, tailored setup sheet (Tyres, Suspension, Aero, Dampers, Differential, Brakes/Electronics) engineered specifically around the driver's natural style (**Heavy Trail-Braker**, **Momentum Roller**, **Throttle-Steerer**, or **Point & Squirt**) and balance preference to neutralize observed telemetry flaws.
  - **Parameter Style Notes**: Explains why each parameter was specifically tuned for that driver's telemetry tendencies.
  - Executive lap pace verdict & achievable lap time delta (e.g. `-0.85s achievable`).
  - Turn-by-turn anomaly breakdown (Driver Input flaw vs Chassis reaction vs Actionable fix).
  - Phase-based driver coaching (Braking & Entry, Apex & Rotation, Exit & Traction).
  - Click-by-click setup adjustments (ARBs, Brake Bias, Tyre Pressures, Preload).
  - **"Copy Adaptive Spec" & "Apply to Setup" buttons**: copy or transfer calibrated setups instantly.
  - Team radio debrief with simulated pit wall audio comms.

## Folder Structure

```
sim-setup-ai/
├── server.js               ← Node/Express backend with Groq AI integration
├── package.json
├── .env                    ← GROQ_API_KEY and PORT
├── sample-telemetry/       ← Sample MoTeC CSV telemetry logs (Spa, Monza, Silverstone)
└── public/
    ├── index.html          ← Dual-mode workspace (Setup Generator + Telemetry Analyzer)
    ├── styles.css          ← Executive liquid-glass motorsport dark UI
    ├── app.js              ← Telemetry parsing, Canvas plotting & API controllers
    └── sample-telemetry/   ← Public static sample files
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Your API Key
Ensure `.env` contains your key (get a free key at https://console.groq.com/keys):
```bash
GROQ_API_KEY=gsk_your_key_here
PORT=3000
```

### 3. Run the Server
```bash
npm start
```
Open **http://localhost:3000** in your web browser.

## Using the Telemetry Analyzer
1. Click **`02 // TELEMETRY ANALYZER`** in the top navigation bar.
2. Select your sim title, car, track, and atmospheric conditions.
3. Either:
   - Click one of the **Quick Load Realistic Motorsport Samples** (Spa, Monza, or Silverstone) to test immediately, or
   - Drag and drop your own telemetry `.csv` or `.json` file from MoTeC i2 Pro, Popometer, or your sim.
4. Click **Analyze Telemetry & Coach**.
5. Explore the interactive multi-channel chart, 4-corner tyre thermal HUD, turn-by-turn breakdowns, and click **Apply to Setup** to automatically tune your car setup based on the telemetry findings!
