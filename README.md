# PitWall AI 🏁
### Autonomous Sim Racing Telemetry Analytics, Chassis Engineering & Tactical Pit Strategy

[![Live Deployment](https://img.shields.io/badge/Production%20URL-pitwall--ai--one.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://pitwall-ai-one.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Inference Engine](https://img.shields.io/badge/AI%20Inference-Groq%20LLaMA%203.3%2070B-F55036?style=for-the-badge)](https://groq.com/)

**PitWall AI** is a professional-grade race engineering platform and MoTeC telemetry workbench designed for competitive sim racers. It combines high-precision vehicle dynamics calculations, authentic GPS track mapping, friction circle physics, and real-time AI reasoning to provide turn-by-turn driver coaching, tailored chassis setups, atmospheric tire compensations, and optimal pit stop strategies.

---

## ⚡ Live Demo
Experience the platform live in your browser:  
👉 **[https://pitwall-ai-one.vercel.app/](https://pitwall-ai-one.vercel.app/)**

---

## 🏎️ Key Engineering Modules

### 1. MoTeC-Grade Telemetry Analytics & AI Coaching
* **Synchronized Multi-Channel Canvas Scrubber**: Interactive high-DPI rendering of Speed ($km/h$), Throttle %, Brake %, Steering Angle ($^\circ$), Lateral G ($G$), and Gear / RPM across exact track distance.
* **Authentic 2D GPS Circuit Track Maps**: Official 1:1 isometric coordinates for circuits like **Silverstone**, **Monza**, and **Spa-Francorchamps**. Features live cursor synchronization, apex navigation, and customizable heatmaps for **Speed**, **Time Delta vs Pro**, **Pedal Inputs**, and **Lateral G**.
* **G-G Friction Circle (Kamm's Circle)**: Computes grip utilization percentage ($100 \times \frac{G_{actual}}{G_{limit}}$), trail-braking transition efficiency score ($0-100$), peak decel/lat vectors, and actionable grip deficit verdicts.
* **Pro Driver Benchmark & Corner Attribution**: Compares user telemetry against homologated pro reference laps. Attributes time loss corner-by-corner with delta speed ($\Delta v$), delta time ($\Delta t$), braking point offset (meters), and throttle commitment markers.
* **4-Corner Thermal & Pressure Wireframe**: Live telemetry monitoring of Front-Left, Front-Right, Rear-Left, and Rear-Right core/surface temperatures, hot pressures with target delta, and Inner-Middle-Outer (IMO) camber thermal gradients.
* **Turn-by-Turn Anomaly Diagnostics**: Diagnoses root causes behind chassis misbehavior (e.g., front tire wash, snap exit oversteer, diff locking) into actionable driver fixes.
* **Sim Setup Exporters**: 1-click export to native simulator file formats:
  - **Assetto Corsa Competizione**: `.json` setup payload
  - **iRacing**: `.sto` setup specification
  - **rFactor 2 / Automobilista 2**: `.svm` setup script
  - Universal CSV & Plain Text reports

---

### 2. Autonomous Chassis Setup Synthesizer
* **Multi-Simulator Support**: Tailored physics knowledge bases for **Assetto Corsa Competizione**, **iRacing**, **Le Mans Ultimate**, **Automobilista 2**, **rFactor 2**, **Assetto Corsa**, and **F1 23/24**.
* **Chassis Parameterization**: Synthesizes complete engineering setup sheets:
  - **Aerodynamics**: Front/rear ride heights, rear wing angles, front splitter rake, brake ducts.
  - **Suspension Geometry**: Camber angles, toe-in/toe-out, caster, anti-roll bar (ARB) stiffness.
  - **Damper Curves**: Fast/slow bump and fast/slow rebound damping.
  - **Drivetrain & Differential**: Power/coast ramp angles, preload torque, traction control cut profiles.
  - **Braking**: Bias percentage, master cylinder diameter, brake pad friction coefficients.
* **Driver-Adaptive Setup Tuning**: Optimizes chassis balance specifically around driver archetypes (**Heavy Trail-Braker**, **Momentum Roller**, **Throttle-Steerer**, or **Point & Squirt**).

---

### 3. Tactical Strategy & Engineering Tools
* **Target Cold Tyre Pressure & Atmospheric Compensator**:
  - Homologated operating window specifications (ACC GT3 DHE $26.8-27.2\,\text{psi}$, iRacing $24.0-25.4\,\text{psi}$, F1, LMU).
  - Ambient air & track temperature thermodynamic compensation ($\sim 0.1\,\text{psi}/^\circ\text{C}$).
  - Asymmetric circuit load compensation (clockwise vs. counter-clockwise lateral stress weighting).
  - Empirical hot-to-cold pit offset calibration with 1-click apply to the chassis brief.
* **Race Fuel & Pit Strategy Window Calculator**:
  - Supports both **Timed Endurance** races (with formation lap and safety buffers) and **Lap-Count Grand Prix**.
  - Dynamic stint range analysis and chronological pit window schedules (**Window Open**, **Optimal Pit Lap**, **Window Close**, **Fuel to Add**).
  - **Lift-and-Coast Tactical Simulator**: Evaluates range extension and lap-time trade-offs to eliminate splash-and-dash stops.

---

### 4. Setup Vault & Side-by-Side Version Diff Engine
* **Persistent Library**: Save, label, and manage setups directly in local storage.
* **Side-by-Side Parameter Diff Engine**: Compare any two setup versions (`Setup A` vs `Setup B`) across all components with automatic delta calculation and directional status badges (`+1 Click`, `-0.50° Camber`, `Stiffened`, `Softened`).
* **"Differences Only" Filter**: Filter out unchanged parameters to instantly review what changed between session iterations.
* **1-Click Save**: Integrated "SAVE TO VAULT" actions across both generated setups and telemetry-calibrated sheets.

---

## 🛠️ Architecture & Tech Stack

```
pitwall-ai/
├── src/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── api/
│   │   │   ├── analyze-telemetry # Telemetry ML analysis & coaching endpoint
│   │   │   └── generate-setup    # Vehicle dynamics setup synthesis endpoint
│   │   ├── globals.css           # Pit wall liquid-glass dark theme
│   │   └── page.tsx              # Reactive unified workspace controller
│   ├── components/
│   │   ├── setup/                # Setup Generator & Export Modals
│   │   ├── telemetry/            # MoTeC Canvas HUD, TrackMap2D & Friction Circle
│   │   ├── tools/                # Tyre Compensator & Fuel Strategy Calculators
│   │   ├── vault/                # Setup Vault & Side-by-Side Diff Modal
│   │   └── ModeNavigation.tsx    # Workspace tab switcher & Vault counter
│   ├── lib/
│   │   ├── circuit-geometries.ts # Official 135-point FIA GPS track coordinates
│   │   ├── fuel-calculator.ts    # Stint range, pit windows & lift-and-coast math
│   │   ├── tyre-calculator.ts    # Thermodynamic atmospheric pressure compensator
│   │   ├── setup-vault.ts        # Version storage & parameter diff engine
│   │   ├── setup-exporter.ts     # ACC .json / iRacing .sto / rF2 .svm serializers
│   │   └── telemetry-parser.ts   # MoTeC i2 / Popometer CSV parser
│   └── types/telemetry.ts        # Strongly-typed chassis & telemetry schemas
```

* **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons, High-DPI HTML5 Canvas.
* **Physics & Telemetry Engine**: Zero-dependency client-side numerical math for friction circles, dead-reckoning coordinate transformation, and aerodynamic balance equations.
* **AI Engine**: Groq Cloud running `llama-3.3-70b-versatile` with structured JSON schema outputs and low-latency inference.

---

## 🚀 Quick Start (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/octavia-23/pitwall-ai.git
cd pitwall-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your free Groq API key (available from [console.groq.com](https://console.groq.com/keys)):
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=3000
```

### 4. Run Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000` in your browser.

---

## 📄 License
This project is source-available for personal sim racing use, driver training, and technical portfolio review. All rights reserved © 2026.
