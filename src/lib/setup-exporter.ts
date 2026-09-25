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
    _generatedBy: "SimSetup AI — Homologated Race Engineering Engine v2.5",
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

  return `// SimSetup AI Engine Setup Specification (.svm)
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
// ${ctx.summary ? ctx.summary.replace(/\n/g, " ") : "Calibrated baseline by SimSetup AI."}
`;
}

/**
 * 3. iRacing Setup Text Specification (.sto.txt)
 */
export function generateIRacingText(ctx: SetupExportContext): string {
  let out = `================================================================================\n`;
  out += `SIMSETUP AI // iRACING SETUP SPECIFICATION SHEET\n`;
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

  out += `[SIMSETUP AI RUN NOTICE]\n`;
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
          <div class="brand">SIMSETUP AI // CHASSIS RUN SHEET</div>
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
