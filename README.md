# ApexWall AI

ApexWall AI is an open telemetry analysis workbench and chassis setup engineering tool for sim racing.

The platform processes telemetry logs from MoTeC CSV, Popometer CSV, and Le Mans Ultimate DuckDB exports, renders multi-channel synchronized graphs and circuit heatmaps, and diagnoses handling anomalies. For vehicle setup recommendations, it pairs deterministic vehicle dynamics rules and simulator parameter constraints with bounded LLM reasoning to generate actionable setup sheets, pit strategies, and driver coaching. A local bridge utility provides UDP and shared memory telemetry streaming to an in-browser cockpit HUD.

[Live Demo](https://pitwall-ai-one.vercel.app/) · [GitHub Repository](https://github.com/octavia-23/ApexWall-ai)

---

## Overview

Sim racing setups often suffer from two extremes: generic "one-size-fits-all" spreadsheets that ignore individual driving telemetry, or unconstrained generative AI tools that hallucinate invalid damper clicks and non-existent anti-roll bar settings.

ApexWall was built to bridge deterministic engineering calculations with contextual reasoning:
- **Telemetry Analysis**: Parses CSV and DuckDB session data to evaluate pedal application, steering scrub, corner apex speeds, time deltas, Ackermann understeer angle, and friction circle grip utilization.
- **Setup Generation**: Combines simulator-specific parameter catalogs, chassis archetypes, and aero profiles with bounded AI reasoning to suggest adjustments that adhere strictly to parameter ranges and step increments.
- **Race Engineer Debrief**: Provides a conversational interface grounded in loaded session telemetry and chassis settings to discuss handling balance and propose targeted fixes.
- **Live Bridge & Cockpit HUD**: Ingests UDP packets and Windows shared memory from supported simulators and broadcasts 60 Hz frames over WebSockets to an interactive browser HUD.
- **Strategy & Utility Tools**: Includes temperature-based tyre pressure compensation with documented simulator presets, endurance fuel stint planning with lift-and-coast analysis, and a versioned setup vault with parameter diffing.

---

## What ApexWall Does

ApexWall follows a structured engineering workflow that separates deterministic computation from qualitative reasoning:

```
Telemetry File / Live Bridge
         ↓
1. Telemetry Ingestion (CSV / DuckDB-WASM)
         ↓
2. Deterministic Calculation (Friction circle hull, deltas, apex speeds, Ackermann angle)
         ↓
3. Causal Diagnosis (Driver input check → Tyre state → Balance → Aero/Mechanical → Drivetrain → Dampers)
         ↓
4. Setup Baseline & Constraint Resolution (Catalog limits, step grids, archetype rules)
         ↓
5. Bounded AI Reasoning (Evaluates primary causes, trade-offs, and driver complaints)
         ↓
6. Deterministic Validation & Repair (Boundary clamping, step-snapping, parameter verification)
         ↓
7. Export & On-Track Testing (Formatted .json, .ini, .svm, .pc, .xml, run sheets, or local injection)
```

The system does not ask a language model to compute raw telemetry mathematics or guess vehicle physics:
- **Deterministic**: Numerical statistics, coordinate projections, distance-based interpolations, heuristic event thresholds, tyre temperature compensation formulas, setup step-snapping, and export file serialization are handled programmatically in TypeScript and WebAssembly.
- **AI Reasoning**: Handling complaint interpretation, mapping symptoms to vehicle dynamics subsystems, proposing targeted 1–3 parameter setup adjustments, explaining physical trade-offs in natural language, and conducting active debriefs with the driver are handled via bounded LLM reasoning.

The model is neither restricted to cosmetic prose nor entrusted with unverified floating-point physics calculations.

---

## Telemetry Analysis

The telemetry workspace provides an interactive environment for inspecting session data:

- **Multi-Format Ingestion**:
  - **CSV Parser**: Ingests MoTeC i2, Popometer, and generic CSV exports containing speed, throttle, brake, steer, RPM, gear, lateral G, longitudinal G, and 4-corner tyre temperatures/pressures. When optional channels (such as tyre surface temperatures or pressures) are omitted in the export, fallback baselines are used to preserve visualization continuity while missing channel notices are surfaced in the diagnostic brief.
  - **DuckDB-WASM Parser**: Mounts and queries Le Mans Ultimate (and generic sim) `.duckdb` SQLite/DuckDB binary database files entirely client-side in the browser using WebAssembly.
- **Synchronized Canvas Graphs**: High-DPI canvas scrubber displaying speed ($km/h$), throttle (%), brake (%), steering angle ($^\circ$), gear, RPM, lateral/longitudinal G, Ackermann understeer angle, and running time delta. Moving the cursor updates the track position marker and friction circle crosshair simultaneously.
- **G-G Friction Circle (Kamm's Circle)**:
  - Constructs a 36-bin radial hull at the 90th percentile to establish the vehicle's grip envelope while filtering out single-frame kerb spikes.
  - Peak scalar normalization references the 95th percentile G-force threshold to prevent aberrant sensor spikes from distorting chart scaling.
  - Computes peak combined acceleration ($G$), peak deceleration ($G$), and peak lateral acceleration ($G$).
  - Evaluates overall grip utilization percentage and trail-braking transition efficiency across four distinct corner phases: entry-left, entry-right, exit-left, and exit-right.
- **2D Circuit Track Visualization**:
  - Renders circuit geometry generated from surveyed GPS track coordinates (covering 60 racing circuits across F1, WEC, and GT championships).
  - Four selectable overlay heatmaps: **Speed**, **Time Delta vs Reference**, **Pedal Inputs**, and **Lateral G**.
  - Interactive corner apex markers with sector boundaries and DRS zones.
- **Lap Comparison & Corner Attribution**:
  - Interpolates driver laps against reference laps across normalized lap distance using binary search and linear interpolation.
  - Calculates running time delta ($\Delta t$), speed delta ($\Delta v$), apex minimum speed, and braking point distance offset in meters.
- **Heuristic Driver Technique Diagnostics**:
  - Flags abrupt brake releases where brake pressure drops from >60% to 0% with steering angle under 10° rather than trailing off smoothly into the apex.
  - Identifies steering scrub where steering input exceeds 35° at speeds below 120 km/h while lateral acceleration remains below 1.6 G.
  - Detects throttle hesitation and micro-lifts on corner exit indicating rear axle instability.
  - Computes geometric Ackermann angle versus actual steering angle to measure phase-specific understeer and oversteer gradients on corner entry, apex, and exit.
- **4-Corner Thermal & Pressure Monitoring**: Visualizes Front-Left, Front-Right, Rear-Left, and Rear-Right core/surface temperatures, hot operating pressures, and camber-induced temperature gradients.

---

## Setup Generation

The setup engine generates or adjusts vehicle setups using a hybrid model: deterministic engineering constraints enforce parameter validity, while the AI explores trade-offs based on driver complaints and telemetry evidence.

- **Telemetry-Informed vs. Context-Based Operation**:
  - **When dynamic telemetry is loaded**: Recommendations are informed by measured session data (wheel slip, Ackermann understeer angle, trail-braking score, tyre hot pressure offsets).
  - **When telemetry is not provided**: The engine falls back to context-based reasoning, validated defaults, and vehicle dynamics priors, explicitly logging that recommendations are derived without dynamic slip evidence.
- **Simulator Parameter Catalogs**:
  - Simulator-specific parameter catalogs define known parameter names, ranges, units, and step grids for supported titles (ACC GT3, EA Sports F1, Assetto Corsa Formula).
  - Custom Assetto Corsa mods can provide exact slider definitions directly from `setup.ini` via in-browser JSZip archive ingestion.
- **Chassis & Aerodynamic Archetypes**:
  - Classifies cars into physical layouts: Front-Engine RWD, Mid-Engine GT3, Rear-Engine (e.g., 911 platform), High-Downforce Formula/Prototype, and FWD Touring.
  - Applies track aero profiles (e.g., Monza low-drag vs. Monaco / Hungaroring high-downforce).
- **Causal Diagnostic Ordering**:
  - Enforces vehicle dynamics hierarchy to prevent "shotgun" changes: checks driver input technique first, followed by tyre state, mechanical balance (anti-roll bars and springs), aerodynamic rake, drivetrain (differential locks), and damper transitions.
  - Restricts primary modifications to 1–3 target parameters with conservative delta limits, preventing destabilizing secondary reactions.
- **Deterministic Validation & Step-Snapping**:
  - Every model output passes through `validateAndRepairSetup()`.
  - Values outside legal limits are clamped to simulator minimums and maximums.
  - Continuous float values are snapped to the nearest valid simulator increment (step grid).
  - Parameters non-existent in the target game are rejected or preserved from the baseline.
  - Cross-parameter sanity rules ensure aerodynamic rake remains positive and differential coast lock remains below power lock where applicable.
- **Heuristic Engineering Confidence**:
  - Diagnostic plans assign heuristic confidence ratings (`HIGH`, `MEDIUM`, `LOW`) based on presence of active telemetry evidence, channel availability, and symptom specificity. These represent heuristic engineering confidence, not statistically calibrated probabilities.
- **Structured Parameter Diff & Testing Protocol**:
  - Generates a structured diff (`oldValue → newValue`, delta, evidence, rationale, and trade-off) comparing the validated output against the baseline.
  - Generates a sequential 2–3 lap test procedure for on-track validation of each adjusted subsystem.
- **Setup Exporters**:
  - **Assetto Corsa**: Formatted `.ini` setup file (scales camber to tenths, standard AC sections)
  - **Assetto Corsa Competizione**: `.json` setup payload formatted for ACC garage structure
  - **Assetto Corsa Evo**: Formatted `.ini` setup file
  - **rFactor 2 / Le Mans Ultimate**: Formatted `.svm` setup script
  - **Automobilista 2**: Formatted `.svm` setup script
  - **EA Sports F1 (23 / 24)**: Formatted `.json` setup structure and readable text run sheet
  - **BeamNG.drive**: Formatted `.pc` part configuration file
  - **RaceRoom**: Formatted `.xml` setup file
  - **iRacing & Forza GT**: Parameter run sheet guides / text specifications
  - **Printable HTML Run Sheet**: Formatted for tablet and pit-bench viewing

---

## Race Engineer

The Race Engineer is a conversational interface grounded directly in the user's active session data rather than an isolated generic chatbot.

- **Telemetry & Setup Grounding**:
  - Automatically incorporates the currently loaded car, track, parameter settings, lap time, top speed, trail-braking score, grip utilization, tyre thermals, and corner delta summary into the conversation context.
- **Physical Reasoning**:
  - Evaluates driver complaints (e.g., high-speed rear instability, low-speed apex push, power-oversteer on exit) against vehicle archetype rules.
  - Distinguishes driving technique issues (such as abrupt brake release) from mechanical or aerodynamic setup issues before recommending hardware changes.
- **Measured Recommendations**:
  - Constrained to advise incremental changes (e.g., 1–2 clicks of anti-roll bar, 2–4% differential ramp adjustments, 2–3 mm ride height changes) rather than polar extremes, avoiding destabilizing secondary characteristics.

---

## Live Telemetry & Bridge

ApexWall includes a local bridge service for streaming live telemetry from active racing simulators to the web dashboard.

- **Local Telemetry Bridge (`scripts/telemetry-bridge.js`)**:
  - **F1 23 / F1 24**: Listens on UDP port 20777, decoding `CarTelemetryData` binary packets (speed, throttle, brake, steer, gear, engine RPM, and tyre pressures).
  - **Assetto Corsa Competizione**: Windows shared memory via scripts/acc-bridge.py (requires the local bridge running on the same PC as ACC).
  - **Assetto Corsa Evo (`scripts/acevo-bridge.py`)**: Uses Python `mmap` and `ctypes` to read Kunos Windows shared memory mappings (`Local\acevo_pmf_physics` and `Local\acevo_pmf_graphics`), piping normalized JSON frames to the bridge.
  - **WebSocket Server**: Normalizes telemetry into standard frames and broadcasts to connected web clients over `ws://localhost:9001` at ~60 Hz.
  - **Local Setup Injection API**: Exposes `http://localhost:9001/api/inject-setup` to write generated setup files directly into the correct Windows Documents directory on the local machine.
  - **Synthetic Test Mode**: Includes a `--test` flag that emits simulated 60 Hz telemetry curves for testing without a simulator running.
- **Browser Cockpit HUD (`LiveTelemetryHUD`)**:
  - 15-LED progressive RPM shift light cluster (5 Green → 5 Red → 5 Blue) with redline flash.
  - Digital speedometer (switchable KM/H and MPH), tachometer gauge, current gear, and delta split.
  - Real-time G-G crosshair dot tracking instantaneous vehicle acceleration vectors.
  - Real-time car marker traversing the 2D circuit map.
  - 4-wheel tyre pressure and temperature indicators.

---

## Engineering Tools

- **Tyre Pressure & Temperature Compensator**:
  - Calculates cold starting tyre pressures required to reach target hot operating pressures.
  - Incorporates ambient air and asphalt temperature deltas using empirical temperature compensation (~0.10 psi per °C).
  - Adjusts for asymmetric circuit loading based on clockwise vs. counter-clockwise track layouts.
  - **Empirical Stint Calibration**: When observed hot pressures and cold starting pressures from a previous run are provided, calibrates cold offsets directly from measured telemetry (`Delta Cold = Target Hot - Observed Hot`).
  - **Supported Simulator Presets with Technical Provenance**:
    - **Assetto Corsa Competizione**: GT3 Slick (Pirelli DHE: 26.85 psi target, 26.6–27.0 psi window), GT3 Wet (Pirelli Rain: 30.0 psi target), GT4 Slick (Medium Slick: 27.0 psi target).
    - **Automobilista 2**: GT3 / GTE Dry Slick (25.4 psi target hot, 24.0–26.8 psi window; models Madness Engine carcass flex and IMO temperature spread), Formula Ultimate Gen2 Slick (23.5 psi target hot, 22.0–25.0 psi window), Stock Car Brasil V8 Slick (26.0 psi target hot, 24.5–27.5 psi window).
    - **iRacing**: GT3 / IMSA Slick (Michelin: 22.5 psi target hot, 21.8–23.2 psi window).
    - **EA Sports F1 (24 / 25)**: Dry Slick (Pirelli C3: 23.5 psi target hot, 22.5–24.5 psi window).
    - **Le Mans Ultimate**: Hypercar / GTP Slick (Medium Slick: 26.5 psi target hot, 26.0–27.0 psi window).
    - **Assetto Corsa Evo**: Semi-Slick / Sport (32.0 psi target hot, 31.0–33.0 psi window).
- **Fuel & Pit Strategy Calculator**:
  - Supports timed endurance formats (with formation lap and safety margin allowances) and lap-count sprint races.
  - Computes stint lengths, required pit stops, optimal pit lap windows, and fuel volume to add.
  - **Lift-and-Coast Simulator**: Evaluates whether lifting into heavy braking zones can save enough fuel per lap to extend a stint and eliminate a pit stop.
- **Setup Morph Tool**:
  - Takes an existing setup and adapts tyre pressures, aerodynamic balance, and suspension stiffness when session conditions change (e.g., track temperature shifts, rain, or fuel load variations).
- **Setup Vault & Parameter Diff**:
  - Persists setups locally via `localStorage` and optionally syncs to Supabase PostgreSQL when authenticated.
  - Side-by-side diff tool (`Setup A` vs `Setup B`) highlights parameter adjustments with directional increase/decrease badges.
  - Generates public shareable links (`/setup/[id]`) for team setup distribution.

---

## Architecture

```
                    ┌────────────────────────┐
                    │      Sim Rig / PC      │
                    │  (ACC, F1, ACEvo, etc.)│
                    └───────────┬────────────┘
                                │ UDP / Shared Memory
                                ▼
                    ┌────────────────────────┐
                    │ Local Telemetry Bridge │
                    │ (telemetry-bridge.js)  │
                    └───────────┬────────────┘
                                │ WebSockets (ws://9001) / CSV / DuckDB
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ ApexWall Web Client (Next.js 16 App Router)                           │
│                                                                        │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │   Telemetry Ingestion   │         │      Engineering Tools       │  │
│  │ (CSV & DuckDB-WASM)     │         │ (Tyre, Fuel, Setup Morph)    │  │
│  └────────────┬────────────┘         └──────────────┬───────────────┘  │
│               │                                     │                  │
│               ▼                                     ▼                  │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │  Deterministic Analytics│         │ Parameter Catalog & Baseline │  │
│  │  - G-G Friction Circle  │         │ - Game profiles & tab schemas│  │
│  │  - Distance Interp / Δt │         │ - Chassis archetypes         │  │
│  │  - Canvas Track Map     │         │ - Circuit aero demands       │  │
│  │  - Ackermann & Scrub    │         │                              │  │
│  └────────────┬────────────┘         └──────────────┬───────────────┘  │
│               │                                     │                  │
│               └──────────────────┬──────────────────┘                  │
│                                  │ Structured Context                  │
│                                  ▼                                     │
│               ┌─────────────────────────────────────┐                  │
│               │   AI Inference Layer (Groq SDK)     │                  │
│               │   - Causal reasoning on complaints  │                  │
│               │   - Race engineer chat responses    │                  │
│               │   - Setup parameter delta proposals │                  │
│               └──────────────────┬──────────────────┘                  │
│                                  │ Proposed Parameters                 │
│                                  ▼                                     │
│               ┌─────────────────────────────────────┐                  │
│               │ Deterministic Validator & Repair    │                  │
│               │ - Boundary clamping & step-snapping │                  │
│               │ - Cross-parameter consistency       │                  │
│               └──────────────────┬──────────────────┘                  │
│                                  │ Validated Setup Sheet               │
│                                  ▼                                     │
│               ┌─────────────────────────────────────┐                  │
│               │ Export Modals & Direct Sim Injector │                  │
│               │ (.json, .ini, .svm, .pc, .xml, run) │                  │
│               └─────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Major Layers

1. **Ingestion Layer**: Reads telemetry files in the browser (CSV via text tokenizer; DuckDB via in-memory WebAssembly worker) or ingests live UDP/shared-memory frames via the local Node.js bridge.
2. **Deterministic Analytics Layer**: Computes mathematical values (running lap delta, 90th percentile friction circle hull, apex speeds, Ackermann angle, tyre temperature adjustments, pit window arithmetic) without model dependency.
3. **Knowledge Base & Catalog Layer**: Contains simulator-specific parameter definitions, unit systems, slider limits, chassis layouts, and track geometries.
4. **AI Reasoning Layer**: Groq-hosted open LLMs receive the structured diagnostic brief, driver handling complaints, and telemetry metrics to formulate targeted setup adjustments and conversational debriefs.
5. **Validation Layer**: Deterministically post-processes all model proposals against the game's parameter catalog, snapping values to legal step increments and enforcing boundary safety.
6. **Export & Storage Layer**: Serializes setups into simulator-specific file formats, writes files to disk via the local bridge when available, or stores records in Supabase and `localStorage`.

---

## How AI Is Used

To ensure technical validity, ApexWall maintains a strict boundary between programmatic calculation and language model inference:

| Responsibility | Handled By | Mechanism |
| :--- | :--- | :--- |
| **Telemetry Parsing** | Deterministic | Regex tokenizer & `@duckdb/duckdb-wasm` |
| **Lap Time & Speed Deltas** | Deterministic | Distance-based linear interpolation |
| **Grip Envelope (G-G Hull)** | Deterministic | 36-bin radial 90th percentile hull calculation |
| **Circuit Geometry & Heatmaps** | Deterministic | Coordinate projection & HTML5 Canvas drawing |
| **Understeer / Ackermann Angle** | Deterministic | Geometric Ackermann equation ($L \cdot a_y / v^2$) vs steering angle |
| **Fuel & Pit Window Math** | Deterministic | Stint consumption arithmetic & lap time modeling |
| **Tyre Pressure Adjustments** | Deterministic | Empirical temp coefficients (~0.10 psi/°C) & stint delta calibration |
| **Setup Constraints & Snapping** | Deterministic | Min/max bounds, legal step grid, catalog validation |
| **Setup File Serialization** | Deterministic | Game-specific syntax formatters (`.json`, `.ini`, `.svm`, `.pc`, `.xml`) |
| **Handling Complaint Analysis** | AI Reasoning | Maps driver symptoms to vehicle dynamics systems |
| **Setup Adjustment Proposals** | AI Reasoning | Proposes deltas for 1–3 target parameters based on balance |
| **Trade-Off Explanations** | AI Reasoning | Explains mechanical vs. aerodynamic impacts in plain text |
| **Race Engineer Chat** | AI Reasoning | Conversational debrief conditioned on active telemetry |

---

## Supported Simulators & Formats

### Telemetry Inputs
- **CSV**: MoTeC i2 CSV export, Popometer CSV export, and generic delimited telemetry.
- **DuckDB**: Le Mans Ultimate `.duckdb` binary telemetry databases parsed via DuckDB WebAssembly.
- **Live Stream**: UDP packets (F1, ACC) and Windows Shared Memory (Assetto Corsa Evo).

### Setup Outputs
- **Assetto Corsa**: Formatted `.ini` setup file (scales camber to tenths, matches standard AC sections)
- **Assetto Corsa Competizione**: `.json` setup payload formatted for ACC garage structure
- **Assetto Corsa Evo**: Formatted `.ini` setup file
- **rFactor 2 / Le Mans Ultimate**: Formatted `.svm` setup script
- **Automobilista 2**: Formatted `.svm` setup script
- **EA Sports F1 (23 / 24)**: Formatted `.json` setup structure and readable text run sheet
- **BeamNG.drive**: Formatted `.pc` part configuration file
- **RaceRoom Racing Experience**: Formatted `.xml` setup file
- **iRacing & Forza GT**: Parameter run sheet guides / text specifications
- **Generic**: Formatted printable HTML setup sheet

### Live Telemetry Sources
- **EA Sports F1 (23 / 24)**: UDP port 20777 (`CarTelemetryData` packet parsing)
- **Assetto Corsa Competizione**: Windows shared memory via scripts/acc-bridge.py (requires the local bridge running on the same PC as ACC)
- **Assetto Corsa Evo**: Windows Shared Memory (`Local\acevo_pmf_physics` and `Local\acevo_pmf_graphics`) via `acevo-bridge.py`
- **Synthetic Test Stream**: Built-in 60 Hz test generator (`node scripts/telemetry-bridge.js --test`)

---

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Visualization**: HTML5 Canvas (high-DPI multi-channel graph scrubber, 2D track map, friction circle)
- **In-Browser Analytics**: `@duckdb/duckdb-wasm` (client-side database queries), `jszip` (mod archive inspection)
- **Realtime Networking**: Node.js `dgram` (UDP socket listener), `ws` (WebSocket server), native WebSockets
- **Shared Memory Bridge**: Python 3 (`ctypes`, `mmap`, `socket`)
- **Database & Auth**: Supabase (PostgreSQL with Row-Level Security, Auth, `@supabase/ssr`), browser `localStorage`
- **AI Inference**: Groq SDK (`groq-sdk`) calling open models (e.g. LLaMA 3.3 70B) with structured JSON response formatting

---

## Repository Structure

```
ApexWall-ai/
├── public/                       # Static web assets & sample mod templates
├── sample-telemetry/             # Sample telemetry files (Monza, Spa, Silverstone)
├── scripts/
│   ├── acevo-bridge.py           # Assetto Corsa Evo Windows shared memory reader
│   └── telemetry-bridge.js       # Local UDP & WebSocket bridge server (port 9001)
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── api/
│   │   │   ├── analyze-telemetry # Telemetry summary evaluation & setup endpoint
│   │   │   ├── generate-setup    # Setup generation & causal diagnostic endpoint
│   │   │   ├── inject-setup      # Local setup disk write endpoint
│   │   │   ├── race-engineer     # Conversational race engineer endpoint
│   │   │   └── sim-cars          # Car & track metadata endpoint
│   │   ├── auth/callback         # Supabase OAuth redirect handler
│   │   ├── setup/[id]/           # Public shared setup view
│   │   ├── globals.css           # Global layout & cockpit theme styling
│   │   ├── layout.tsx            # Root layout & providers
│   │   └── page.tsx              # Main workspace mode controller
│   ├── components/
│   │   ├── auth/                 # Supabase authentication modal
│   │   ├── engineer/             # Race Engineer chat component
│   │   ├── setup/                # Setup Generator, exporter, and direct injector
│   │   ├── telemetry/            # Graph scrubber, TrackMap2D, G-G circle, live HUD
│   │   ├── tools/                # Tyre pressure, fuel strategy, and setup morph tools
│   │   └── vault/                # Setup Vault & side-by-side diff modal
│   ├── lib/
│   │   ├── circuits/             # Surveyed circuit geometry registry (60 tracks)
│   │   ├── setup-engine/         # Parameter catalogs, baseline generator, validator
│   │   ├── duckdb-parser.ts      # Client-side DuckDB-WASM binary telemetry parser
│   │   ├── telemetry-parser.ts   # CSV telemetry parser and heuristic analyzers
│   │   ├── telemetry-comparison.ts # Distance interpolation & lap delta comparison
│   │   ├── telemetry-friction-circle.ts # G-G 90th percentile hull & quadrant calculations
│   │   ├── fuel-calculator.ts    # Stint range, pit windows & lift-and-coast math
│   │   ├── tyre-calculator.ts    # Temperature-based pressure compensator & presets
│   │   ├── setup-exporter.ts     # Game-specific setup file formatters
│   │   └── setup-vault.ts        # Setup storage, diffing, and version tracking
│   └── types/                    # TypeScript interfaces for telemetry and setups
├── supabase/
│   └── schema.sql                # PostgreSQL schema with Row-Level Security policies
├── package.json
└── tsconfig.json
```

---

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/octavia-23/ApexWall-ai.git
cd ApexWall-ai
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

Set the required environment keys in `.env`:
```env
# Groq API Key for AI setup generation and race engineer debrief
GROQ_API_KEY=your_groq_api_key_here

# Supabase Auth & Cloud Database (Optional: falls back to localStorage if omitted)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Local dev server port (default 3000)
PORT=3000
```

> **Service Requirements**:
> - **Core Telemetry & Tools**: Telemetry CSV parsing, DuckDB analysis, multi-channel graphing, 2D track maps, friction circle evaluation, tyre calculators, and fuel strategy tools run client-side without any API keys.
> - **AI Reasoning**: Setup generation and the conversational Race Engineer require a valid `GROQ_API_KEY`.
> - **Cloud Persistence**: The Setup Vault operates in browser `localStorage` by default; Supabase credentials are only required for cloud sync across devices and public URL sharing.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. (Optional) Run the Local Telemetry Bridge
To stream live telemetry from your simulator into the Live Cockpit HUD:

```bash
# EA Sports F1 23 / F1 24 (Listening on UDP port 20777)
npm run telemetry-bridge -- --game f1

# Assetto Corsa Competizione (Windows shared memory bridge via scripts/acc-bridge.py)
npm run telemetry-bridge -- --game acc

# Assetto Corsa Evo (Shared Memory bridge via Python)
npm run telemetry-bridge:acevo

# Synthetic test mode (no game required)
node scripts/telemetry-bridge.js --test
```

---

## Limitations

- **Telemetry Completeness & Synthetic Fallbacks**: Analysis quality is directly constrained by the channels present in the telemetry export. When non-critical channels (such as tyre surface temperatures or dynamic pressures) are absent from a generic CSV, the parser populates static baseline values (e.g. 84.0°C / 27.2 psi) to allow charting without crash. These fallback values do not represent physical sensor readings, and the diagnostic plan flags missing channels in its limitations brief.
- **Live Telemetry Constraints**: F1 UDP live frames do not carry tyre channels and display standard placeholder baselines; ACC live telemetry is struct-verified and requires on-track confirmation with ACC running.
- **Heuristic Diagnostic Rules**: Technique diagnostics (such as steering scrub when steering exceeds 35° under 120 km/h with low lateral G, or abrupt brake releases) are based on empirical vehicle dynamics heuristics rather than vehicle-specific multi-body tire models. They provide actionable engineering direction rather than absolute mathematical truths.
- **Project-Authored Simulator Catalogs**: While custom Assetto Corsa mods can ingest exact slider definitions directly from `setup.ini`, built-in simulator parameter catalogs are project-authored schemas reflecting known game menus, units, and click grids. They are engineering approximations, not official game source code.
- **Title-Specific Physics Differences**: Simulators implement tire models, suspension geometry, and setup effects differently. An adjustment that resolves mid-corner push in Assetto Corsa Competizione may behave differently in Automobilista 2 or iRacing due to carcass flex and contact patch modeling differences.
- **On-Track Driver Verification Required**: While generated setup proposals are clamped to legal ranges, snapped to valid step increments, and checked for positive aerodynamic rake, all setup changes must be verified on track by the driver under live stint conditions.
- **Reference Lap Availability**: Turn-by-turn delta attribution requires providing a reference lap or selecting a session that contains benchmark telemetry data.
- **Local File Injection**: The 1-click setup injection feature requires the Node.js bridge running locally with write permissions to your user `Documents` folder; browser security prevents web applications from writing directly to local disk without this bridge.

---

## License

This project is source-available for personal sim racing use, driver training, and technical portfolio review. All rights reserved © 2026.
