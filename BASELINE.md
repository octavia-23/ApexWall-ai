# ApexWall-AI Pre-Refactor Baseline & Golden Path Verification Checklist

**Date**: 2026-10-04  
**Commit Baseline**: `5b04f65`  
**Environment**: Next.js 16 App Router, React 18, TypeScript, Tailwind CSS, Windows PowerShell  

---

## Pre-Flight Status
- [x] Project builds successfully (`npm run build` / Next.js production webpack bundle)
- [x] Dev server runs cleanly (`next dev --webpack` on `http://localhost:3000`)
- [x] TypeScript check passes

---

## Golden Path Verification Checklist

### 1. Golden Path A: Sample Monza GT3 Telemetry & Visualization
- **Action**: Load sample Monza GT3 CSV via 1-click demo (`public/sample-telemetry/monza-gt3-motec.csv` and reference `public/sample-telemetry/monza-gt3-pro-reference.csv`).
- **Expected Outcome**:
  - Multi-channel time-series graphs render (Speed, Throttle, Brake, Steering Angle, G-forces, RPM, Gear).
  - 2D/3D track map renders with GPS/spline telemetry points (1,640 points downsampled, 3 sectors mapped).
  - G-G friction circle renders 36-bin outer envelope hull at 95th percentile boundary.
- **Verification Result**: **PASS**
  - Driver Lap: `2:11.080`, Top Speed: `258 km/h`, Min Speed: `69 km/h`.
  - Friction circle computed with 36 envelope hull points.

### 2. Golden Path B: Telemetry Diagnostics Panel
- **Action**: Inspect computed diagnostics on loaded telemetry.
- **Expected Outcome**:
  - Peak grip utilization % computed (e.g., 44% on driver lap).
  - Trail-braking efficiency score computed (e.g., 90/100).
  - Apex speeds computed for key corners (e.g., 6 apex speeds captured with 69 km/h minimum corner speed).
  - Peak G metrics displayed: Peak Lat G 2.07G, Peak Decel G -1.85G.
- **Verification Result**: **PASS**

### 3. Golden Path C: Setup Generation & Export
- **Action**: Fill vehicle/session config (Porsche 992 GT3 R @ Monza GP, Qualifying, 32°C track, dry, handling complaint) and invoke setup engine (`/api/generate-setup`).
- **Expected Outcome**:
  - Calibrated setup returns with 5 setup sections (Tyres/Pressures, Electronics, Aerodynamics, Mechanical/Suspension, Dampers).
  - Target changes and engineering rationale rendered.
  - Setup Export modal can generate downloadable files (e.g. ACC JSON `basicSetup`/`advancedSetup`, AC INI, AMS2 SVM, iRacing text).
- **Verification Result**: **PASS**
  - Generated calibrated setup and verified ACC JSON export generation (2,098 characters).

### 4. Golden Path D: Race Engineer Chat
- **Action**: Send user prompt `"I'm getting understeer on entry"` to Race Engineer chat endpoint (`/api/race-engineer`).
- **Expected Outcome**:
  - Grounded race engineer reply renders with physics-accurate diagnoses (front roll stiffness, front tyre contact patch, damper rebound/bump, differential coast lock reduction, trail-braking technique).
- **Verification Result**: **PASS**
  - Returned grounded response with specific telemetry references, damper adjustments (+1 front bump, +1 front rebound), and coast lock reduction (-4%).

### 5. Golden Path E: Live Telemetry HUD Stream
- **Action**: Run `node scripts/telemetry-bridge.js --test` and connect WebSocket live rig client to `ws://localhost:9001`.
- **Expected Outcome**:
  - Synthetic test broadcast mode streams 60Hz `telemetry_frame` packets.
  - Payloads stream speed, RPM, gear, steering, throttle, brake, G-forces, tyre temps (FL, FR, RL, RR) and tyre pressures.
  - Live HUD widgets update real-time RPM shift lights, digital speedometer, gear indicator, and 4-corner tyre heatmaps.
- **Verification Result**: **PASS**
  - Verified active connection to `ws://localhost:9001` and received live `telemetry_frame` payloads.

### 6. Golden Path F: Strategy Calculators
- **Action**: Compute tyre pressures and fuel strategy for representative inputs.
- **Expected Outcome**:
  - Tyre pressure calculator adjusts for track temperature and asymmetric loading (clockwise circuits increase left tyre pressure offset).
  - Fuel strategy calculator computes total race laps, fuel required with formation lap and safety buffer, and pit window recommendations.
- **Verification Result**: **PASS**
  - Tyre calculator for ACC GT3 Dry at 32°C Monza produced recommended cold pressures of 25.8 PSI (FL) and 26.4 PSI (FR) targeting 26.85 PSI hot.
  - Fuel calculator for 45-min race with 108.5s lap time produced 25 race laps and 87.2 L fuel required.

---

## Sign-off
All 6 golden paths verified and working on current codebase without regression before initiating Phase 1.
