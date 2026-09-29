import { SetupSection } from "@/types/telemetry";

export interface SetupExportContext {
  game?: string;
  car: string;
  track: string;
  sessionType?: string;
  weather?: string;
  trackTemp?: string;
  airTemp?: string;
  fuelLoad?: string;
  tyreCompound?: string;
  driverStyle?: string;
  summary?: string;
  engineerNotes?: string;
  sections: SetupSection[];
}

/**
 * Helper to extract numeric values or string values from setup sections
 */
function findItemValue(sections: SetupSection[], labelKeywords: string[]): string {
  for (const sec of sections) {
    for (const item of sec.items || []) {
      const lower = item.label.toLowerCase();
      if (labelKeywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return item.value;
      }
    }
  }
  return "";
}

function parseNumber(val: string, fallback: number = 0): number {
  const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : fallback;
}

export function sanitizeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * 1. Assetto Corsa Competizione (ACC) Native Setup JSON
 */
export function generateACCJson(ctx: SetupExportContext): string {
  const carSlug = ctx.car.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const trackSlug = ctx.track.toLowerCase().split(/[\s-]+/)[0] || "spa";

  // Tyres
  const flPsi = parseNumber(findItemValue(ctx.sections, ["front left cold", "fl cold", "front left"]), 26.5);
  const frPsi = parseNumber(findItemValue(ctx.sections, ["front right cold", "fr cold", "front right"]), 26.8);
  const rlPsi = parseNumber(findItemValue(ctx.sections, ["rear left cold", "rl cold", "rear left"]), 26.2);
  const rrPsi = parseNumber(findItemValue(ctx.sections, ["rear right cold", "rr cold", "rear right"]), 26.4);

  // Alignment
  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -3.5);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -2.8);
  const fToe = parseNumber(findItemValue(ctx.sections, ["front toe"]), -0.08);
  const rToe = parseNumber(findItemValue(ctx.sections, ["rear toe"]), 0.15);

  // ARBs & Balance
  const fArb = Math.round(parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb"]), 3));
  const rArb = Math.round(parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]), 2));
  const brakeBias = parseNumber(findItemValue(ctx.sections, ["brake bias"]), 54.5);

  // Aero
  const fRide = Math.round(parseNumber(findItemValue(ctx.sections, ["front ride height"]), 52));
  const rRide = Math.round(parseNumber(findItemValue(ctx.sections, ["rear ride height"]), 68));
  const rWing = Math.round(parseNumber(findItemValue(ctx.sections, ["rear wing"]), 8));

  // Electronics
  const tc1 = Math.round(parseNumber(findItemValue(ctx.sections, ["tc", "traction control"]), 3));
  const abs = Math.round(parseNumber(findItemValue(ctx.sections, ["abs"]), 3));
  const preload = Math.round(parseNumber(findItemValue(ctx.sections, ["preload", "diff preload"]), 60));

  const accStructure = {
    carName: carSlug,
    basicSetup: {
      tyres: {
        tyreCompound: 0,
        tyrePressure: [
          Math.round((flPsi - 20) * 10),
          Math.round((frPsi - 20) * 10),
          Math.round((rlPsi - 20) * 10),
          Math.round((rrPsi - 20) * 10),
        ],
      },
      alignment: {
        camber: [
          Math.round(Math.abs(fCamber) * 10),
          Math.round(Math.abs(fCamber) * 10),
          Math.round(Math.abs(rCamber) * 10),
          Math.round(Math.abs(rCamber) * 10),
        ],
        toe: [
          Math.round((fToe + 0.5) * 100),
          Math.round((fToe + 0.5) * 100),
          Math.round((rToe + 0.5) * 100),
          Math.round((rToe + 0.5) * 100),
        ],
        staticCamber: [fCamber, fCamber, rCamber, rCamber],
        toeOutLinear: [fToe, fToe, rToe, rToe],
        casterLF: 15,
        casterRF: 15,
        steerRatio: 13,
      },
      electronics: {
        tC1: tc1,
        tC2: 0,
        abs: abs,
        eCUMap: 1,
        fuelMix: 0,
        telemetryLaps: 0,
      },
      strategy: {
        fuel: parseNumber(ctx.fuelLoad || "35", 35),
        nPitStops: 0,
        tyreSet: 1,
        frontBrakePadPound: 1,
        rearBrakePadPound: 1,
      },
    },
    advancedSetup: {
      mechanicalBalance: {
        aRBFront: fArb,
        aRBRear: rArb,
        wheelRate: [175000, 175000, 140000, 140000],
        bumpStopRateUp: [1200, 1200, 1000, 1000],
        bumpStopWindow: [15, 15, 20, 20],
        brakeTorque: 100,
        brakeBias: brakeBias,
      },
      dampers: {
        bumpSlow: [6, 6, 5, 5],
        bumpFast: [12, 12, 10, 10],
        reboundSlow: [7, 7, 6, 6],
        reboundFast: [14, 14, 12, 12],
      },
      aeroBalance: {
        rideHeight: [fRide, fRide, rRide, rRide],
        rodLength: [0, 0, 0, 0],
        splitter: 0,
        rearWing: rWing,
        brakeDuct: [2, 2],
      },
      drivetrain: {
        preload: preload,
      },
    },
    trackBsdName: trackSlug,
    _generatedBy: "ApexWall AI — Homologated Race Engineering Engine v2.0",
    _exportedAt: new Date().toISOString(),
    _summary: ctx.summary || "",
  };

  return JSON.stringify(accStructure, null, 2);
}

/**
 * 2. rFactor 2 / Le Mans Ultimate (.svm) Format
 */
export function generateRFactorSVM(ctx: SetupExportContext): string {
  const flPsi = findItemValue(ctx.sections, ["front left cold", "fl cold", "front left"]) || "26.5 psi";
  const frPsi = findItemValue(ctx.sections, ["front right cold", "fr cold", "front right"]) || "26.8 psi";
  const rlPsi = findItemValue(ctx.sections, ["rear left cold", "rl cold", "rear left"]) || "26.2 psi";
  const rrPsi = findItemValue(ctx.sections, ["rear right cold", "rr cold", "rear right"]) || "26.4 psi";

  const fArb = findItemValue(ctx.sections, ["front anti-roll", "front arb"]) || "3";
  const rArb = findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]) || "2";
  const fCamber = findItemValue(ctx.sections, ["front camber"]) || "-3.5°";
  const rCamber = findItemValue(ctx.sections, ["rear camber"]) || "-2.8°";
  const fToe = findItemValue(ctx.sections, ["front toe"]) || "-0.08°";
  const rToe = findItemValue(ctx.sections, ["rear toe"]) || "+0.15°";
  const brakeBias = findItemValue(ctx.sections, ["brake bias"]) || "54.2%";
  const rWing = findItemValue(ctx.sections, ["rear wing"]) || "8";
  const fRide = findItemValue(ctx.sections, ["front ride height"]) || "52 mm";

  return `// ApexWall AI Engine Setup Specification (.svm)
// Platform: rFactor 2 / Le Mans Ultimate
// Car: ${ctx.car}
// Track: ${ctx.track}
// Generated: ${new Date().toUTCString()}

[GENERAL]
Vehicle="${ctx.car}"
Track="${ctx.track}"
Session="${ctx.sessionType || "Practice"}"
FuelLoad=${parseNumber(ctx.fuelLoad || "35", 35)}

[FRONTLEFT]
Pressure=${flPsi}
Camber=${fCamber}
Toe=${fToe}

[FRONTRIGHT]
Pressure=${frPsi}
Camber=${fCamber}
Toe=${fToe}

[REARLEFT]
Pressure=${rlPsi}
Camber=${rCamber}
Toe=${rToe}

[REARRIGHT]
Pressure=${rrPsi}
Camber=${rCamber}
Toe=${rToe}

[SUSPENSION]
FrontAntiRollBar=${fArb}
RearAntiRollBar=${rArb}

[BRAKES]
BrakeBias=${brakeBias}
BrakePressure=100.0%

[AERODYNAMICS]
FrontRideHeight=${fRide}
RearWingAngle=${rWing}

[NOTES]
// ${ctx.summary ? ctx.summary.replace(/\n/g, " ") : "Calibrated baseline by ApexWall AI."}
`;
}

/**
 * 3. iRacing Setup Text Specification (.sto.txt)
 */
export function generateIRacingText(ctx: SetupExportContext): string {
  let out = `================================================================================\n`;
  out += `APEXWALL AI // iRACING SETUP SPECIFICATION SHEET\n`;
  out += `CAR:   ${ctx.car.toUpperCase()}\n`;
  out += `TRACK: ${ctx.track.toUpperCase()}\n`;
  out += `DATE:  ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
  out += `================================================================================\n\n`;

  if (ctx.summary) {
    out += `[RACE ENGINEER PHILOSOPHY]\n${ctx.summary}\n\n`;
  }

  (ctx.sections || []).forEach((sec) => {
    out += `[${sec.title.toUpperCase()}]\n`;
    sec.items.forEach((it) => {
      out += `  • ${it.label.padEnd(28, " ")}: ${it.value}\n`;
      if (it.styleNote) {
        out += `    ↳ Style Note: ${it.styleNote}\n`;
      }
    });
    out += `\n`;
  });

  if (ctx.engineerNotes) {
    out += `[PIT WALL ENGINEER BRIEFING]\n${ctx.engineerNotes}\n\n`;
  }

  out += `[APEXWALL AI RUN NOTICE]\n`;
  out += `Setup values are calibrated baselines. Hot lap stints should verify hot pressures\n`;
  out += `reach target operating window (GT3: 26.5-27.0 psi, GTP/LMP2: 21.0-22.5 psi).\n`;

  return out;
}

/**
 * 4. Open Printable Run Sheet in New Window
 */
export function openPrintableRunSheet(ctx: SetupExportContext): void {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup blocked! Please allow popups to open the printable run sheet.");
    return;
  }

  const sectionsHtml = (ctx.sections || [])
    .map(
      (sec) => `
      <div class="run-section">
        <div class="section-title">${sec.title.toUpperCase()}</div>
        <table class="spec-table">
          <thead>
            <tr>
              <th style="width: 45%;">Parameter</th>
              <th style="width: 25%;">Calibrated Value</th>
              <th style="width: 30%;">Driver Style Note</th>
            </tr>
          </thead>
          <tbody>
            ${sec.items
              .map(
                (it) => `
              <tr>
                <td class="param-name">${it.label}</td>
                <td class="param-val"><strong>${it.value}</strong></td>
                <td class="param-note">${it.styleNote || "—"}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>Pit Wall Run Sheet — ${ctx.car} @ ${ctx.track}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #ffffff;
          color: #111827;
          margin: 0;
          padding: 28px;
          font-size: 12.5px;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }
        .brand {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .meta-pill {
          font-size: 10px;
          font-family: monospace;
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .summary-card {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .summary-card h4 {
          margin: 0 0 6px 0;
          font-size: 11px;
          text-transform: uppercase;
          color: #4b5563;
        }
        .summary-card p {
          margin: 0;
          font-size: 12px;
          color: #1f2937;
        }
        .run-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .run-section {
          margin-bottom: 16px;
          break-inside: avoid;
        }
        .section-title {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          border-bottom: 1px solid #d1d5db;
          padding-bottom: 4px;
          margin-bottom: 6px;
          color: #111827;
        }
        .spec-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
        }
        .spec-table th {
          text-align: left;
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          padding: 4px 6px;
          border-bottom: 1px solid #e5e7eb;
        }
        .spec-table td {
          padding: 5px 6px;
          border-bottom: 1px solid #f3f4f6;
        }
        .param-name { color: #374151; }
        .param-val { font-family: monospace; color: #111827; }
        .param-note { font-size: 10.5px; color: #6b7280; }
        .notes-box {
          background: #f3f4f6;
          border-left: 3px solid #3b82f6;
          padding: 10px 14px;
          margin-top: 16px;
          font-size: 11.5px;
        }
        .btn-bar {
          margin-bottom: 18px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .print-btn {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        @media print {
          .btn-bar { display: none; }
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="btn-bar">
        <button class="print-btn" onclick="window.print()">Print Run Sheet / Save as PDF</button>
      </div>

      <div class="header">
        <div>
          <div class="brand">APEXWALL AI // CHASSIS RUN SHEET</div>
          <div style="font-size: 12px; color: #4b5563; margin-top: 2px;">
            <strong>${ctx.car}</strong> @ <strong>${ctx.track}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="meta-pill">HOMOLOGATED BASELINE</span>
          <div style="font-size: 10.5px; color: #6b7280; margin-top: 4px;">
            Date: ${new Date().toLocaleDateString()} · Sim: ${ctx.game || "ACC / iRacing"}
          </div>
        </div>
      </div>

      ${
        ctx.summary
          ? `
        <div class="summary-card">
          <h4>Chief Race Engineer Philosophy</h4>
          <p>${ctx.summary}</p>
        </div>
      `
          : ""
      }

      <div class="run-grid">
        ${sectionsHtml}
      </div>

      ${
        ctx.engineerNotes
          ? `
        <div class="notes-box">
          <strong>Team Radio / Pit Wall Briefing:</strong><br />
          ${ctx.engineerNotes}
        </div>
      `
          : ""
      }
    </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

/**
 * 5. Assetto Corsa (Original AC) Native Setup INI Format
 */
export function generateAssettoCorsaINI(ctx: SetupExportContext): string {
  const flPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["front left", "fl cold", "pressure lf"]), 25));
  const frPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["front right", "fr cold", "pressure rf"]), 25));
  const rlPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold", "pressure lr"]), 24));
  const rrPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["rear right", "rr cold", "pressure rr"]), 24));

  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -3.2);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -2.5);
  const fToe = Math.round(parseNumber(findItemValue(ctx.sections, ["front toe"]), -5));
  const rToe = Math.round(parseNumber(findItemValue(ctx.sections, ["rear toe"]), 12));

  const fArb = Math.round(parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb"]), 4));
  const rArb = Math.round(parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]), 2));

  const fWing = Math.round(parseNumber(findItemValue(ctx.sections, ["front splitter", "front wing"]), 0));
  const rWing = Math.round(parseNumber(findItemValue(ctx.sections, ["rear wing"]), 7));

  const bumpSlow = Math.round(parseNumber(findItemValue(ctx.sections, ["bump", "slow bump", "dampers"]), 14));
  const reboundSlow = Math.round(parseNumber(findItemValue(ctx.sections, ["rebound", "slow rebound"]), 18));

  const diffPower = Math.round(parseNumber(findItemValue(ctx.sections, ["diff power", "power lock", "differential"]), 45));
  const diffCoast = Math.round(parseNumber(findItemValue(ctx.sections, ["diff coast", "coast lock"]), 60));
  const diffPreload = Math.round(parseNumber(findItemValue(ctx.sections, ["diff preload", "preload"]), 40));

  const brakeBias = Math.round(parseNumber(findItemValue(ctx.sections, ["brake bias", "bias"]), 56));
  const fuel = Math.round(parseNumber(ctx.fuelLoad || "30", 30));

  return `[HEADER]
VERSION=1
CAR=${ctx.car}
TRACK=${ctx.track}
CREATED_BY=ApexWall AI Homologated Engineering Engine v2.0
DATE=${new Date().toISOString()}

[TYRES]
VALUE=0
PRESSURE_LF=${flPsi}
PRESSURE_RF=${frPsi}
PRESSURE_LR=${rlPsi}
PRESSURE_RR=${rrPsi}

[CAMBER_LF]
VALUE=${fCamber}
[CAMBER_RF]
VALUE=${fCamber}
[TOE_OUT_LF]
VALUE=${fToe}
[TOE_OUT_RF]
VALUE=${fToe}

[CAMBER_LR]
VALUE=${rCamber}
[CAMBER_RR]
VALUE=${rCamber}
[TOE_OUT_LR]
VALUE=${rToe}
[TOE_OUT_RR]
VALUE=${rToe}

[ARB_FRONT]
VALUE=${fArb}
[ARB_REAR]
VALUE=${rArb}

[SPRING_RATE_LF]
VALUE=125
[SPRING_RATE_RF]
VALUE=125
[SPRING_RATE_LR]
VALUE=95
[SPRING_RATE_RR]
VALUE=95

[ROD_LENGTH_LF]
VALUE=0
[ROD_LENGTH_RF]
VALUE=0
[ROD_LENGTH_LR]
VALUE=0
[ROD_LENGTH_RR]
VALUE=0

[DAMP_BUMP_LF]
VALUE=${bumpSlow}
[DAMP_BUMP_RF]
VALUE=${bumpSlow}
[DAMP_BUMP_LR]
VALUE=${bumpSlow}
[DAMP_BUMP_RR]
VALUE=${bumpSlow}

[DAMP_FAST_BUMP_LF]
VALUE=${Math.max(1, bumpSlow - 4)}
[DAMP_FAST_BUMP_RF]
VALUE=${Math.max(1, bumpSlow - 4)}
[DAMP_FAST_BUMP_LR]
VALUE=${Math.max(1, bumpSlow - 4)}
[DAMP_FAST_BUMP_RR]
VALUE=${Math.max(1, bumpSlow - 4)}

[DAMP_REBOUND_LF]
VALUE=${reboundSlow}
[DAMP_REBOUND_RF]
VALUE=${reboundSlow}
[DAMP_REBOUND_LR]
VALUE=${reboundSlow}
[DAMP_REBOUND_RR]
VALUE=${reboundSlow}

[DAMP_FAST_REBOUND_LF]
VALUE=${Math.max(1, reboundSlow - 5)}
[DAMP_FAST_REBOUND_RF]
VALUE=${Math.max(1, reboundSlow - 5)}
[DAMP_FAST_REBOUND_LR]
VALUE=${Math.max(1, reboundSlow - 5)}
[DAMP_FAST_REBOUND_RR]
VALUE=${Math.max(1, reboundSlow - 5)}

[WING_FRONT]
VALUE=${fWing}
[WING_REAR]
VALUE=${rWing}

[DIFF_POWER]
VALUE=${diffPower}
[DIFF_COAST]
VALUE=${diffCoast}
[DIFF_PRELOAD]
VALUE=${diffPreload}

[BRAKE_POWER_MULT]
VALUE=100
[FRONT_BIAS]
VALUE=${brakeBias}

[GENERIC]
FUEL=${fuel}
`;
}

/**
 * 6. Assetto Corsa Evo (.ini) — modernised per-wheel garage format
 */
export function generateACEvoINI(ctx: SetupExportContext): string {
  const flPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["front left", "fl cold", "pressure fl"]), 27));
  const frPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["front right", "fr cold", "pressure fr"]), 27));
  const rlPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold", "pressure rl"]), 26));
  const rrPsi = Math.round(parseNumber(findItemValue(ctx.sections, ["rear right", "rr cold", "pressure rr"]), 26));

  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -3.0);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -2.2);
  // AC Evo toe is in mm (0.1 precision)
  const fToe = parseNumber(findItemValue(ctx.sections, ["toe fl", "front toe"]), -1.0);
  const rToe = parseNumber(findItemValue(ctx.sections, ["toe rl", "rear toe"]), 1.6);

  const fArb = Math.round(parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb"]), 5));
  const rArb = Math.round(parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]), 4));

  const fSpring = Math.round(parseNumber(findItemValue(ctx.sections, ["spring rate fl", "spring rate front"]), 145));
  const rSpring = Math.round(parseNumber(findItemValue(ctx.sections, ["spring rate rl", "spring rate rear"]), 120));

  const fRide = Math.round(parseNumber(findItemValue(ctx.sections, ["ride height fl", "front ride"]), 72));
  const rRide = Math.round(parseNumber(findItemValue(ctx.sections, ["ride height rl", "rear ride"]), 78));

  const bumpF = Math.round(parseNumber(findItemValue(ctx.sections, ["bump fl", "bump front"]), 12));
  const fbumpF = Math.round(parseNumber(findItemValue(ctx.sections, ["fast bump fl", "fast bump front"]), 8));
  const rebF = Math.round(parseNumber(findItemValue(ctx.sections, ["rebound fl", "rebound front"]), 18));
  const frebF = Math.round(parseNumber(findItemValue(ctx.sections, ["fast rebound fl", "fast rebound front"]), 12));
  const bumpR = Math.round(parseNumber(findItemValue(ctx.sections, ["bump rl", "bump rear"]), 10));
  const fbumpR = Math.round(parseNumber(findItemValue(ctx.sections, ["fast bump rl", "fast bump rear"]), 6));
  const rebR = Math.round(parseNumber(findItemValue(ctx.sections, ["rebound rl", "rebound rear"]), 15));
  const frebR = Math.round(parseNumber(findItemValue(ctx.sections, ["fast rebound rl", "fast rebound rear"]), 10));

  const fWing = Math.round(parseNumber(findItemValue(ctx.sections, ["front splitter", "front wing"]), 2));
  const rWing = Math.round(parseNumber(findItemValue(ctx.sections, ["rear wing"]), 8));

  const diffPower = Math.round(parseNumber(findItemValue(ctx.sections, ["diff power", "power lock"]), 55));
  const diffCoast = Math.round(parseNumber(findItemValue(ctx.sections, ["diff coast", "coast lock"]), 45));
  const diffPreload = Math.round(parseNumber(findItemValue(ctx.sections, ["diff preload", "preload"]), 55));

  const brakeBias = Math.round(parseNumber(findItemValue(ctx.sections, ["brake bias"]), 67));
  const fuel = Math.round(parseNumber(ctx.fuelLoad || "35", 35));

  return `[HEADER]
VERSION=2
CAR=${ctx.car}
TRACK=${ctx.track}
SIM=Assetto Corsa Evo
CREATED_BY=ApexWall AI Homologated Engineering Engine v2.0
DATE=${new Date().toISOString()}

[TYRES]
VALUE=0
PRESSURE_FL=${flPsi}
PRESSURE_FR=${frPsi}
PRESSURE_RL=${rlPsi}
PRESSURE_RR=${rrPsi}

[CAMBER_FL]
VALUE=${fCamber.toFixed(1)}
[CAMBER_FR]
VALUE=${fCamber.toFixed(1)}
[CAMBER_RL]
VALUE=${rCamber.toFixed(1)}
[CAMBER_RR]
VALUE=${rCamber.toFixed(1)}

; Toe in mm (0.1mm precision) — negative = toe-out
[TOE_FL]
VALUE=${fToe.toFixed(1)}
[TOE_FR]
VALUE=${fToe.toFixed(1)}
[TOE_RL]
VALUE=${rToe.toFixed(1)}
[TOE_RR]
VALUE=${rToe.toFixed(1)}

[ARB_FRONT]
VALUE=${fArb}
[ARB_REAR]
VALUE=${rArb}

[SPRING_RATE_FL]
VALUE=${fSpring}
[SPRING_RATE_FR]
VALUE=${fSpring}
[SPRING_RATE_RL]
VALUE=${rSpring}
[SPRING_RATE_RR]
VALUE=${rSpring}

[RIDE_HEIGHT_FL]
VALUE=${fRide}
[RIDE_HEIGHT_FR]
VALUE=${fRide}
[RIDE_HEIGHT_RL]
VALUE=${rRide}
[RIDE_HEIGHT_RR]
VALUE=${rRide}

[DAMP_BUMP_FL]
VALUE=${bumpF}
[DAMP_BUMP_FR]
VALUE=${bumpF}
[DAMP_BUMP_RL]
VALUE=${bumpR}
[DAMP_BUMP_RR]
VALUE=${bumpR}

[DAMP_FAST_BUMP_FL]
VALUE=${fbumpF}
[DAMP_FAST_BUMP_FR]
VALUE=${fbumpF}
[DAMP_FAST_BUMP_RL]
VALUE=${fbumpR}
[DAMP_FAST_BUMP_RR]
VALUE=${fbumpR}

[DAMP_REBOUND_FL]
VALUE=${rebF}
[DAMP_REBOUND_FR]
VALUE=${rebF}
[DAMP_REBOUND_RL]
VALUE=${rebR}
[DAMP_REBOUND_RR]
VALUE=${rebR}

[DAMP_FAST_REBOUND_FL]
VALUE=${frebF}
[DAMP_FAST_REBOUND_FR]
VALUE=${frebF}
[DAMP_FAST_REBOUND_RL]
VALUE=${frebR}
[DAMP_FAST_REBOUND_RR]
VALUE=${frebR}

[WING_FRONT]
VALUE=${fWing}
[WING_REAR]
VALUE=${rWing}

[DIFF_POWER]
VALUE=${diffPower}
[DIFF_COAST]
VALUE=${diffCoast}
[DIFF_PRELOAD]
VALUE=${diffPreload}

[BRAKE_POWER_MULT]
VALUE=100
[FRONT_BIAS]
VALUE=${brakeBias}

[ELECTRONICS]
TC=3
ABS=2
ENGINE_MAP=1

[GENERIC]
FUEL=${fuel}
`;
}

/**
 * 7. EA Sports F1 (F1 23 / 24) Native Setup JSON Specification
 */
export function generateF1SetupJson(ctx: SetupExportContext): string {
  const fWing = Math.round(parseNumber(findItemValue(ctx.sections, ["front wing", "front downforce"]), 36));
  const rWing = Math.round(parseNumber(findItemValue(ctx.sections, ["rear wing", "rear downforce"]), 30));

  const onThrottle = Math.round(parseNumber(findItemValue(ctx.sections, ["on throttle", "on-throttle diff"]), 55));
  const offThrottle = Math.round(parseNumber(findItemValue(ctx.sections, ["off throttle", "off-throttle diff"]), 52));
  const engineBraking = Math.round(parseNumber(findItemValue(ctx.sections, ["engine braking"]), 60));

  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -2.7);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -1.2);
  const fToe = parseNumber(findItemValue(ctx.sections, ["front toe"]), 0.05);
  const rToe = parseNumber(findItemValue(ctx.sections, ["rear toe"]), 0.12);

  const fSusp = Math.round(parseNumber(findItemValue(ctx.sections, ["front suspension", "front spring"]), 32));
  const rSusp = Math.round(parseNumber(findItemValue(ctx.sections, ["rear suspension", "rear spring"]), 12));
  const fArb = Math.round(parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb"]), 18));
  const rArb = Math.round(parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]), 8));
  const fRide = Math.round(parseNumber(findItemValue(ctx.sections, ["front ride height"]), 35));
  const rRide = Math.round(parseNumber(findItemValue(ctx.sections, ["rear ride height"]), 58));

  const brakePressure = Math.round(parseNumber(findItemValue(ctx.sections, ["brake pressure"]), 100));
  const brakeBias = Math.round(parseNumber(findItemValue(ctx.sections, ["brake bias"]), 54));

  const flPsi = parseNumber(findItemValue(ctx.sections, ["front left", "fl pressure"]), 23.5);
  const frPsi = parseNumber(findItemValue(ctx.sections, ["front right", "fr pressure"]), 23.5);
  const rlPsi = parseNumber(findItemValue(ctx.sections, ["rear left", "rl pressure"]), 21.0);
  const rrPsi = parseNumber(findItemValue(ctx.sections, ["rear right", "rr pressure"]), 21.0);

  const f1Setup = {
    game: "EA SPORTS F1 24",
    car: ctx.car,
    track: ctx.track,
    sessionType: ctx.sessionType || "Qualifying / Race",
    aerodynamics: {
      frontWingAero: fWing,
      rearWingAero: rWing,
    },
    transmission: {
      differentialAdjustmentOnThrottle: `${onThrottle}%`,
      differentialAdjustmentOffThrottle: `${offThrottle}%`,
      engineBraking: `${engineBraking}%`,
    },
    suspensionGeometry: {
      frontCamber: `${fCamber}°`,
      rearCamber: `${rCamber}°`,
      frontToeOut: `${fToe}°`,
      rearToeIn: `${rToe}°`,
    },
    suspension: {
      frontSuspension: fSusp,
      rearSuspension: rSusp,
      frontAntiRollBar: fArb,
      rearAntiRollBar: rArb,
      frontRideHeight: fRide,
      rearRideHeight: rRide,
    },
    brakes: {
      brakePressure: `${brakePressure}%`,
      frontBrakeBias: `${brakeBias}%`,
    },
    tyres: {
      frontRightPressure: `${frPsi} psi`,
      frontLeftPressure: `${flPsi} psi`,
      rearRightPressure: `${rrPsi} psi`,
      rearLeftPressure: `${rlPsi} psi`,
    },
    engineerNotes: ctx.engineerNotes || "",
    _generatedBy: "ApexWall AI Autonomous Sim Racing Engineering",
    _timestamp: new Date().toISOString(),
  };

  return JSON.stringify(f1Setup, null, 2);
}

/**
 * 7. EA Sports F1 Garage Quick-Menu Reference Sheet (.txt)
 */
export function generateF1SetupText(ctx: SetupExportContext): string {
  let out = `================================================================================\n`;
  out += `APEXWALL AI // EA SPORTS F1 23 & F1 24 GARAGE SPECIFICATION\n`;
  out += `CAR:   ${ctx.car.toUpperCase()}\n`;
  out += `TRACK: ${ctx.track.toUpperCase()}\n`;
  out += `DATE:  ${new Date().toLocaleDateString()}\n`;
  out += `================================================================================\n\n`;

  (ctx.sections || []).forEach((sec) => {
    out += `[${sec.title.toUpperCase()}]\n`;
    sec.items.forEach((it) => {
      out += `  • ${it.label.padEnd(30, " ")}: ${it.value}\n`;
    });
    out += `\n`;
  });

  if (ctx.engineerNotes) {
    out += `[PIT WALL ENGINEER BRIEFING]\n${ctx.engineerNotes}\n`;
  }

  return out;
}

/**
 * 8. Automobilista 2 (AMS2) Setup Specification (.svm)
 */
export function generateAMS2SVM(ctx: SetupExportContext): string {
  const flPsi = findItemValue(ctx.sections, ["front left", "fl cold", "pressure lf"]) || "26.5 psi";
  const frPsi = findItemValue(ctx.sections, ["front right", "fr cold", "pressure rf"]) || "26.8 psi";
  const rlPsi = findItemValue(ctx.sections, ["rear left", "rl cold", "pressure lr"]) || "26.2 psi";
  const rrPsi = findItemValue(ctx.sections, ["rear right", "rr cold", "pressure rr"]) || "26.4 psi";

  const fArb = findItemValue(ctx.sections, ["front anti-roll", "front arb"]) || "3";
  const rArb = findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]) || "2";
  const fCamber = findItemValue(ctx.sections, ["front camber"]) || "-3.2°";
  const rCamber = findItemValue(ctx.sections, ["rear camber"]) || "-2.5°";
  const fToe = findItemValue(ctx.sections, ["front toe"]) || "-0.10°";
  const rToe = findItemValue(ctx.sections, ["rear toe"]) || "+0.18°";
  const brakeBias = findItemValue(ctx.sections, ["brake bias"]) || "54.5%";
  const rWing = findItemValue(ctx.sections, ["rear wing"]) || "7";
  const fRide = findItemValue(ctx.sections, ["front ride height"]) || "54 mm";

  return `// ApexWall AI Engine Setup Specification (.svm)
// Platform: Automobilista 2 (Madness Engine)
// Car: ${ctx.car}
// Track: ${ctx.track}
// Generated: ${new Date().toUTCString()}

[GENERAL]
Vehicle="${ctx.car}"
Track="${ctx.track}"
Session="${ctx.sessionType || "Practice / Race"}"
FuelLoad=${parseNumber(ctx.fuelLoad || "35", 35)}

[FRONTLEFT]
Pressure=${flPsi}
Camber=${fCamber}
Toe=${fToe}

[FRONTRIGHT]
Pressure=${frPsi}
Camber=${fCamber}
Toe=${fToe}

[REARLEFT]
Pressure=${rlPsi}
Camber=${rCamber}
Toe=${rToe}

[REARRIGHT]
Pressure=${rrPsi}
Camber=${rCamber}
Toe=${rToe}

[SUSPENSION]
FrontAntiRollBar=${fArb}
RearAntiRollBar=${rArb}

[BRAKES]
BrakeBias=${brakeBias}
BrakePressure=100.0%

[AERODYNAMICS]
FrontRideHeight=${fRide}
RearWingAngle=${rWing}

[NOTES]
// ${ctx.summary ? ctx.summary.replace(/\n/g, " ") : "Calibrated baseline by ApexWall AI."}
`;
}

/**
 * 9. BeamNG.drive Vehicle Tuning Configuration (.pc JSON)
 */
export function generateBeamNGPC(ctx: SetupExportContext): string {
  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -3.0);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -2.2);
  const flPsi = parseNumber(findItemValue(ctx.sections, ["front left", "fl cold"]), 28);
  const rlPsi = parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold"]), 26);
  const brakeBias = parseNumber(findItemValue(ctx.sections, ["brake bias"]), 58) / 100;

  const beamConfig = {
    format: 2,
    mainPartName: sanitizeSlug(ctx.car) || "custom_vehicle",
    model: sanitizeSlug(ctx.car) || "custom_vehicle",
    description: `ApexWall AI Race Setup — ${ctx.car} @ ${ctx.track}`,
    vars: {
      $camber_FR: Number((fCamber * 0.015).toFixed(4)),
      $camber_RR: Number((rCamber * 0.012).toFixed(4)),
      $toe_FR: 0.001,
      $toe_RR: 0.002,
      $tirepressure_F: Math.round(flPsi),
      $tirepressure_R: Math.round(rlPsi),
      $brakebias: Number(brakeBias.toFixed(3)),
      $arb_F: 3500000,
      $arb_R: 1800000,
    },
    _generatedBy: "ApexWall AI Engine v2.0",
    _exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(beamConfig, null, 2);
}

/**
 * 10. RaceRoom Racing Experience (.xml)
 */
export function generateRaceRoomXML(ctx: SetupExportContext): string {
  const flPsi = parseNumber(findItemValue(ctx.sections, ["front left", "fl cold"]), 26.5);
  const frPsi = parseNumber(findItemValue(ctx.sections, ["front right", "fr cold"]), 26.8);
  const rlPsi = parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold"]), 26.2);
  const rrPsi = parseNumber(findItemValue(ctx.sections, ["rear right", "rr cold"]), 26.4);
  const fCamber = parseNumber(findItemValue(ctx.sections, ["front camber"]), -3.2);
  const rCamber = parseNumber(findItemValue(ctx.sections, ["rear camber"]), -2.5);
  const fArb = parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb"]), 4);
  const rArb = parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb"]), 2);
  const brakeBias = parseNumber(findItemValue(ctx.sections, ["brake bias"]), 55.5);
  const rWing = parseNumber(findItemValue(ctx.sections, ["rear wing"]), 6);

  return `<?xml version="1.0" encoding="utf-8"?>
<setup version="1.0">
  <header>
    <game>RaceRoom Racing Experience</game>
    <car>${ctx.car}</car>
    <track>${ctx.track}</track>
    <date>${new Date().toISOString()}</date>
    <author>ApexWall AI</author>
  </header>
  <tyres>
    <pressure_front_left>${flPsi.toFixed(1)}</pressure_front_left>
    <pressure_front_right>${frPsi.toFixed(1)}</pressure_front_right>
    <pressure_rear_left>${rlPsi.toFixed(1)}</pressure_rear_left>
    <pressure_rear_right>${rrPsi.toFixed(1)}</pressure_rear_right>
  </tyres>
  <alignment>
    <camber_front>${fCamber.toFixed(2)}</camber_front>
    <camber_rear>${rCamber.toFixed(2)}</camber_rear>
  </alignment>
  <suspension>
    <arb_front>${Math.round(fArb)}</arb_front>
    <arb_rear>${Math.round(rArb)}</arb_rear>
  </suspension>
  <aerodynamics>
    <rear_wing>${Math.round(rWing)}</rear_wing>
  </aerodynamics>
  <brakes>
    <balance_front>${brakeBias.toFixed(1)}</balance_front>
  </brakes>
</setup>
`;
}

/**
 * 11. Forza Motorsport & Gran Turismo 7 In-Game Tuning Card (Text / Markdown)
 */
export function generateForzaGTText(ctx: SetupExportContext): string {
  let out = `================================================================================\n`;
  out += `APEXWALL AI // FORZA MOTORSPORT & GRAN TURISMO 7 TUNING GUIDE\n`;
  out += `CAR:   ${ctx.car.toUpperCase()}\n`;
  out += `TRACK: ${ctx.track.toUpperCase()}\n`;
  out += `DATE:  ${new Date().toLocaleDateString()}\n`;
  out += `================================================================================\n\n`;

  out += `[IN-GAME TUNING MENU CLICK-BY-CLICK SPECIFICATION]\n\n`;

  (ctx.sections || []).forEach((sec) => {
    out += `--- ${sec.title.toUpperCase()} ---\n`;
    sec.items.forEach((it) => {
      out += `  • ${it.label.padEnd(28, " ")}: ${it.value}\n`;
      if (it.styleNote) {
        out += `    ↳ In-game advice: ${it.styleNote}\n`;
      }
    });
    out += `\n`;
  });

  if (ctx.summary) {
    out += `[DRIVING & SETUP STRATEGY]\n${ctx.summary}\n\n`;
  }

  return out;
}

/**
 * 12. Universal 1-Click Windows Batch Auto-Installer (.bat)
 */
export function generateWindowsInstallBat(
  targetDirWindows: string,
  filename: string,
  setupName: string
): string {
  return `@echo off
chcp 65001 >nul
title ApexWall AI - Setup Auto-Installer

echo ===============================================================================
echo   🏁 APEXWALL AI // DIRECT SIM SETUP INJECTOR
echo ===============================================================================
echo Installing setup: "${setupName}"
echo Target Directory:
echo %USERPROFILE%\\${targetDirWindows}
echo ===============================================================================
echo.

set "FULL_DIR=%USERPROFILE%\\${targetDirWindows}"
if not exist "%FULL_DIR%" (
  echo [INFO] Creating missing directory...
  mkdir "%FULL_DIR%"
)

copy /Y "%~dp0${filename}" "%FULL_DIR%\\${filename}" >nul
if %ERRORLEVEL% EQU 0 (
  echo.
  echo [SUCCESS] Setup successfully injected into:
  echo   "%FULL_DIR%\\${filename}"
  echo.
  echo Open your simulator, go to Setup / Garage, and load "${setupName}".
  echo.
) else (
  echo.
  echo [ERROR] Failed to write setup file. Check directory permissions.
  echo.
)

echo Press any key to close this installer...
pause >nul
`;
}

/**
 * Browser file download helper
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
