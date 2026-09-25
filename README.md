# ApexWall AI 🏁
### Autonomous Sim Racing Telemetry Analytics, Chassis Engineering & Tactical Pit Strategy

[![Live Deployment](https://img.shields.io/badge/Production%20URL-pitwall--ai--one.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://pitwall-ai-one.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Database](https://img.shields.io/badge/Supabase-Auth%20%26%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Inference Engine](https://img.shields.io/badge/AI%20Inference-Groq%20LLaMA%203.3%2070B-F55036?style=for-the-badge)](https://groq.com/)

**ApexWall AI** is a universal, open race engineering platform and MoTeC telemetry workbench designed for competitive sim racers. Unlike single-sim subscription tools, ApexWall provides universal vehicle dynamics calculations, authentic GPS track mapping, friction circle physics, and real-time AI reasoning across **Assetto Corsa Competizione**, **iRacing**, **F1 23/24**, **Le Mans Ultimate**, and **Automobilista 2**.

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

### 4. Live Cockpit HUD & 60Hz UDP Telemetry Streamer
* **15-LED Shift Light Cluster**: 5 Green $\rightarrow$ 5 Red $\rightarrow$ 5 Blue LEDs with shift point flash.
* **Digital Cockpit Cluster**: Speedometer (KM/H & MPH), dynamic RPM gauge, delta split, and large gear indicator.
* **Live G-G Vector Dot**: Real-time crosshair dot plotting instantaneous grip utilization during cornering and heavy braking.
* **Live 2D Track Map Position**: Real-time car marker moving along official GPS circuits.
* **Local Sim Bridge**: Standalone Node.js script connecting to ACC (port 9000) or F1 23/24 (port 20777).

---

### 5. Setup Vault, Cloud Database & Team Sharing
* **Supabase Cloud Sync**: Log in with Google or Email to persist setups across all devices.
* **Side-by-Side Parameter Diff Engine**: Compare any two setup versions (`Setup A` vs `Setup B`) across all components with automatic delta calculation and directional status badges.
* **Public Setup Sharing**: 1-click generation of public shareable links (`/setup/[id]`) for teammates to clone or export directly into their sim.

---

## 🛠️ Architecture & Tech Stack

```
apexwall/
├── src/
│   ├── app/                      # Next.js 14 App Router
│   │   ├── api/
│   │   │   ├── analyze-telemetry # Telemetry ML analysis & coaching endpoint
│   │   │   └── generate-setup    # Vehicle dynamics setup synthesis endpoint
│   │   ├── auth/callback         # Supabase OAuth redirect handler
│   │   ├── setup/[id]            # Public shared setup view page
│   │   ├── globals.css           # ApexWall dark liquid-glass theme
│   │   └── page.tsx              # Reactive unified workspace controller
│   ├── components/
│   │   ├── auth/                 # Google & Email AuthModal
│   │   ├── setup/                # Setup Generator & Export Modals
│   │   ├── telemetry/            # MoTeC Canvas HUD, TrackMap2D & Live Cockpit
│   │   ├── tools/                # Tyre Compensator & Fuel Strategy Calculators
│   │   ├── vault/                # Setup Vault & Side-by-Side Diff Modal
│   │   └── ModeNavigation.tsx    # 4-Mode Workspace switcher
│   ├── lib/
│   │   ├── circuit-geometries.ts # Official 135-point FIA GPS track coordinates
│   │   ├── cloud-vault.ts        # Unified Supabase + LocalStorage sync
│   │   ├── fuel-calculator.ts    # Stint range, pit windows & lift-and-coast math
│   │   ├── tyre-calculator.ts    # Thermodynamic atmospheric pressure compensator
│   │   ├── setup-vault.ts        # Version storage & parameter diff engine
│   │   └── telemetry-parser.ts   # MoTeC i2 / Popometer CSV parser
│   └── types/telemetry.ts        # Strongly-typed chassis & telemetry schemas
```

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
Add your Groq and Supabase keys:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
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
