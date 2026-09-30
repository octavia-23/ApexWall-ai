import { SetupSection } from "@/types/telemetry";
import { detectChassisArchetype } from "./chassis-archetypes";

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
function findItemValue(sections: SetupSection[], labelKeywords: string[], excludeKeywords?: string[]): string {
  for (const sec of sections) {
    for (const item of sec.items || []) {
      const lower = item.label.toLowerCase();
      if (excludeKeywords && excludeKeywords.some((ex) => lower.includes(ex.toLowerCase()))) {
        continue;
      }
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
 * Resolves Assetto Corsa car folder ID from human-readable car name or mod title
 */
export function resolveACCarId(carName: string): string {
  const raw = (carName || "").trim();
  const lower = raw.toLowerCase();

  // If already prefixed with common AC mod/kunos patterns, preserve it
  if (
    /^(ks_|rss_|fsr_|urd_|vrc_|ven_|yzd_|aw_|bsk_|cim_|ddm_|f1_|gue_|j8_|jvs_|mby_|pk_|rtp_|simt_|syn_|zr_)/i.test(
      raw
    )
  ) {
    return sanitizeSlug(raw);
  }

  // RSS Formula cars
  if (lower.includes("hybrid") && (lower.includes("2021") || lower.includes("21"))) return "rss_formula_hybrid_2021";
  if (lower.includes("hybrid") && (lower.includes("2022") || lower.includes("22"))) return "rss_formula_hybrid_2022";
  if (lower.includes("hybrid") && (lower.includes("2023") || lower.includes("23"))) return "rss_formula_hybrid_2023";
  if (lower.includes("formula hybrid")) return "rss_formula_hybrid_2021";
  if (lower.includes("formula 2010")) return "rss_formula_2010";
  if (lower.includes("formula rss supreme") || lower.includes("rss supreme")) return "rss_formula_rss_supreme";
  if (lower.includes("callahan")) return "rss_mph_callahan_v8";

  // Clio Cup
  if (lower.includes("clio")) return "fsr_clio_cup_2023";

  // Ferrari GT & Road
  if (lower.includes("488") && lower.includes("challenge")) return "ks_ferrari_488_challenge_evo";
  if (lower.includes("488") && lower.includes("gt3")) return "ks_ferrari_488_gt3";
  if (lower.includes("488") && lower.includes("gtb")) return "ks_ferrari_488_gtb";
  if (lower.includes("458") && lower.includes("gt2")) return "ferrari_458_gt2";
  if (lower.includes("458")) return "ferrari_458";
  if (lower.includes("fxx")) return "ks_ferrari_fxx_k";
  if (lower.includes("sf70h")) return "ks_ferrari_sf70h";
  if (lower.includes("sf15t")) return "ks_ferrari_sf15t";
  if (lower.includes("f2004")) return "ks_ferrari_f2004";
  if (lower.includes("f138")) return "ks_ferrari_f138";

  // Porsche
  if (lower.includes("911") && (lower.includes("gt3 r") || lower.includes("gt3_r") || lower.includes("gt3-r"))) return "ks_porsche_911_gt3_r_2016";
  if (lower.includes("911") && lower.includes("cup")) return "ks_porsche_911_gt3_cup_2017";
  if (lower.includes("911") && lower.includes("rsr")) return "ks_porsche_911_rsr_2017";
  if (lower.includes("911") && lower.includes("gt1")) return "ks_porsche_911_gt1";
  if (lower.includes("919") && lower.includes("hybrid")) return "ks_porsche_919_hybrid_2016";
  if (lower.includes("cayman") && lower.includes("gt4")) return "ks_porsche_cayman_gt4_clubsport";
  if (lower.includes("darche") || (lower.includes("992") && lower.includes("gt3"))) return "urd_darche_992_23";

  // Mercedes
  if (lower.includes("amg") && lower.includes("gt3")) return "ks_mercedes_amg_gt3";
  if (lower.includes("sls") && lower.includes("gt3")) return "mercedes_sls_gt3";

  // Audi
  if (lower.includes("r8") && (lower.includes("lms") || lower.includes("gt3"))) return "ks_audi_r8_lms_2016";
  if (lower.includes("tt") && lower.includes("cup")) return "ks_audi_tt_cup";

  // Lamborghini
  if (lower.includes("huracan") && lower.includes("gt3")) return "ks_lamborghini_huracan_gt3";
  if (lower.includes("huracan") && (lower.includes("st") || lower.includes("trofeo"))) return "ks_lamborghini_huracan_st";

  // McLaren
  if (lower.includes("650") && lower.includes("gt3")) return "ks_mclaren_650_gt3";
  if (lower.includes("mp4") && lower.includes("gt3")) return "mclaren_mp412c_gt3";

  // BMW
  if (lower.includes("m3") && lower.includes("gt2")) return "bmw_m3_gt2";
  if (lower.includes("z4") && lower.includes("gt3")) return "bmw_z4_gt3";
  if (lower.includes("m235i")) return "ks_bmw_m235i_racing";
  if (lower.includes("m4") && lower.includes("akrapovic")) return "ks_bmw_m4_akrapovic";

  // Nissan & Japanese
  if (lower.includes("gtr") && lower.includes("gt3")) return "ks_nissan_gtr_gt3";
  if (lower.includes("mx-5") || lower.includes("mx5") || lower.includes("miata")) return "ks_mazda_mx5_cup";
  if (lower.includes("supra") && lower.includes("gt4")) return "toyota_supra_gt4_cup_2019";
  if (lower.includes("supra")) return "ks_toyota_supra_mkiv";
  if (lower.includes("ae86")) return "ks_toyota_ae86";

  // Other prototypes & open wheel
  if (lower.includes("tatuus")) return "tatuusfa1";
  if (lower.includes("exos")) return "lotus_exos_125";
  if (lower.includes("scg003") || lower.includes("glickenhaus")) return "ks_glickenhaus_scg003";
  if (lower.includes("praga")) return "ks_praga_r1";
  if (lower.includes("corvette") && (lower.includes("c7r") || lower.includes("c7.r"))) return "ks_corvette_c7r";
  if (lower.includes("vantage") || lower.includes("amr gt3")) return "urd_amr_gt3_evo";
  if (lower.includes("radical")) return "urd_radical_sr3xxr_2023";
  if (lower.includes("oreca")) return "oreca_07";
  if (lower.includes("ligier")) return "ven_ligierjsp325lmp3";
  if (lower.includes("formula alpha")) return "vrc_formula_alpha_2007_mc22";
  if (lower.includes("alpine a424")) return "yzd_alpine_a424";

  return sanitizeSlug(raw);
}

/**
 * Scales Camber to Assetto Corsa internal .ini units (tenths of a degree).
 * In AC setup INI, -3.3° camber is stored as VALUE=-33.
 * Storing -3.3 causes AC to display -0.3° in garage.
 */
export function scaleACCamber(val: number): number {
  if (Math.abs(val) <= 12) {
    return Math.round(val * 10);
  }
  return Math.round(val);
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
 * Fully calibrated & physics-compliant across car classes:
 * - Formula / Open-wheel (RSS Formula Hybrid, VRC, Lotus Exos, Tatuus, F1):
 *   15 psi cold pressures, -33 / -15 camber (tenths of deg), 100,000 N/m ARB,
 *   +5 / +95 rod lengths (clears 20mm min floor, authentic aero high-rake),
 *   heave springs [SPRING_RATE_HF/HR] & bumpstop packers [PACKER_RANGE_LF/LR],
 *   wing channels [WING_0] and [WING_1], low diff power lock (15%).
 * - GT3 / GT4 / GTE:
 *   25-27 psi, -32 / -24 camber, 15 / 25 rod lengths (>55mm clearance),
 *   [WING_1], [WING_2], [WING_FRONT], [WING_REAR].
 * - Touring / Cup / FWD:
 *   28/26 psi, -32 / -18 camber, 15 / 10 rod lengths.
 */
export function generateAssettoCorsaINI(ctx: SetupExportContext): string {
  const carId = resolveACCarId(ctx.car);
  const archetype = detectChassisArchetype(ctx.car, "Assetto Corsa");
  const isGT3 = archetype.id === "gt3";

  // ============================================================================
  // AUTHENTIC ASSETTO CORSA GT3 CALIBRATION (Kunos Physics Grounded)
  // ============================================================================
  if (isGT3) {
    const defaultFlPsi = 18;
    const defaultFrPsi = 17;
    const defaultRlPsi = 16;
    const defaultRrPsi = 17;

    const rawFl = parseNumber(findItemValue(ctx.sections, ["front left", "fl cold", "pressure lf", "pressure fl"]), defaultFlPsi);
    const rawFr = parseNumber(findItemValue(ctx.sections, ["front right", "fr cold", "pressure rf", "pressure fr"]), defaultFrPsi);
    const rawRl = parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold", "pressure lr", "pressure rl"]), defaultRlPsi);
    const rawRr = parseNumber(findItemValue(ctx.sections, ["rear right", "rr cold", "pressure rr"]), defaultRrPsi);

    // Enforce authentic AC GT3 slick cold pressure bounds [15 - 20 psi]
    const flPsi = Math.max(14, Math.min(20, Math.round(rawFl > 22 ? defaultFlPsi : rawFl)));
    const frPsi = Math.max(14, Math.min(20, Math.round(rawFr > 22 ? defaultFrPsi : rawFr)));
    const rlPsi = Math.max(14, Math.min(20, Math.round(rawRl > 22 ? defaultRlPsi : rawRl)));
    const rrPsi = Math.max(14, Math.min(20, Math.round(rawRr > 22 ? defaultRrPsi : rawRr)));

    // Camber in tenths of a degree (-2.8 deg -> -28)
    const rawFCamber = parseNumber(findItemValue(ctx.sections, ["front camber", "camber lf"]), -2.8);
    const rawRCamber = parseNumber(findItemValue(ctx.sections, ["rear camber", "camber lr"]), -2.4);
    const fCamber = Math.round(rawFCamber < 0 ? (rawFCamber > -10 ? rawFCamber * 10 : rawFCamber) : -28);
    const rCamber = Math.round(rawRCamber < 0 ? (rawRCamber > -10 ? rawRCamber * 10 : rawRCamber) : -24);

    // Toe in integer clicks (standard 4 front toe-out, 5 rear toe-in)
    const rawFToe = parseNumber(findItemValue(ctx.sections, ["front toe", "toe lf"]), 4);
    const rawRToe = parseNumber(findItemValue(ctx.sections, ["rear toe", "toe lr"]), 5);
    const fToe = Math.max(0, Math.min(10, Math.round(Math.abs(rawFToe) <= 2 ? 4 : Math.abs(rawFToe))));
    const rToe = Math.max(0, Math.min(10, Math.round(Math.abs(rawRToe) <= 2 ? 5 : Math.abs(rawRToe))));

    // Anti-Roll Bars (1-8 scale, front 6, rear 4)
    const rawFArb = parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb", "arb front"]), 6);
    const rawRArb = parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb", "arb rear"]), 4);
    const fArb = Math.max(1, Math.min(8, Math.round(rawFArb)));
    const rArb = Math.max(1, Math.min(8, Math.round(rawRArb)));

    // Rod Lengths (0-15 scale, standard flat low drag 5 / 5)
    const rawRodF = parseNumber(findItemValue(ctx.sections, ["rod length lf", "rod length front", "front ride"]), 5);
    const rawRodR = parseNumber(findItemValue(ctx.sections, ["rod length lr", "rod length rear", "rear ride"]), 5);
    const rodF = Math.max(0, Math.min(15, Math.round(rawRodF > 15 ? 5 : rawRodF)));
    const rodR = Math.max(0, Math.min(15, Math.round(rawRodR > 15 ? 5 : rawRodR)));

    // Springs (N/mm: front 120, rear 115)
    const rawSpringF = parseNumber(findItemValue(ctx.sections, ["front wheel rate", "spring lf"]), 120);
    const rawSpringR = parseNumber(findItemValue(ctx.sections, ["rear wheel rate", "spring lr"]), 115);
    const springF = Math.round(rawSpringF > 60 && rawSpringF < 200 ? rawSpringF : 120);
    const springR = Math.round(rawSpringR > 60 && rawSpringR < 200 ? rawSpringR : 115);

    // Packers (49mm front, 62mm rear)
    const rawPackerF = parseNumber(findItemValue(ctx.sections, ["front packers travel", "packer lf"]), 49);
    const rawPackerR = parseNumber(findItemValue(ctx.sections, ["rear packers travel", "packer lr"]), 62);
    const packerF = Math.round(rawPackerF < 25 ? 49 : rawPackerF);
    const packerR = Math.round(rawPackerR < 25 ? 62 : rawPackerR);

    // Dampers (0-12/16 scale: bump 9/8, fast bump 8/8, rebound 7/8, fast rebound 9/9)
    const rawBumpF = parseNumber(findItemValue(ctx.sections, ["bump lf", "slow bump lf"]), 9);
    const rawBumpR = parseNumber(findItemValue(ctx.sections, ["bump lr", "slow bump lr"]), 8);
    const bumpF = Math.max(1, Math.min(16, Math.round(rawBumpF > 16 ? 9 : rawBumpF)));
    const bumpR = Math.max(1, Math.min(16, Math.round(rawBumpR > 16 ? 8 : rawBumpR)));

    const rawFastBumpF = parseNumber(findItemValue(ctx.sections, ["fast bump lf"]), 8);
    const rawFastBumpR = parseNumber(findItemValue(ctx.sections, ["fast bump lr"]), 8);
    const fastBumpF = Math.max(1, Math.min(16, Math.round(rawFastBumpF > 16 ? 8 : rawFastBumpF)));
    const fastBumpR = Math.max(1, Math.min(16, Math.round(rawFastBumpR > 16 ? 8 : rawFastBumpR)));

    const rawReboundF = parseNumber(findItemValue(ctx.sections, ["rebound lf", "slow rebound lf"]), 7);
    const rawReboundR = parseNumber(findItemValue(ctx.sections, ["rebound lr", "slow rebound lr"]), 8);
    const reboundF = Math.max(1, Math.min(16, Math.round(rawReboundF > 16 ? 7 : rawReboundF)));
    const reboundR = Math.max(1, Math.min(16, Math.round(rawReboundR > 16 ? 8 : rawReboundR)));

    const rawFastReboundF = parseNumber(findItemValue(ctx.sections, ["fast rebound lf"]), 9);
    const rawFastReboundR = parseNumber(findItemValue(ctx.sections, ["fast rebound lr"]), 9);
    const fastReboundF = Math.max(1, Math.min(16, Math.round(rawFastReboundF > 16 ? 9 : rawFastReboundF)));
    const fastReboundR = Math.max(1, Math.min(16, Math.round(rawFastReboundR > 16 ? 9 : rawFastReboundR)));

    // Differential (30% power, 50% coast)
    const rawDiffPower = parseNumber(findItemValue(ctx.sections, ["diff power", "power lock"]), 30);
    const rawDiffCoast = parseNumber(findItemValue(ctx.sections, ["diff coast", "coast lock"]), 50);
    const diffPower = Math.max(15, Math.min(50, Math.round(rawDiffPower > 50 ? 30 : rawDiffPower)));
    const diffCoast = Math.max(30, Math.min(70, Math.round(rawDiffCoast < 35 ? 50 : rawDiffCoast)));

    // Aero: Splitter [Wing 1] = 1, Wing [Wing 2] = 6 (low drag Spa) or 8
    const isSpaOrHighSpeed = /spa|monza|silverstone|lemans|le_mans/i.test(ctx.track);
    const wing1 = 1;
    const wing2 = isSpaOrHighSpeed ? 6 : 8;

    // Electronics
    const rawAbs = parseNumber(findItemValue(ctx.sections, ["abs"]), 6);
    const rawTc = parseNumber(findItemValue(ctx.sections, ["traction control", "tc"]), 5);
    const abs = Math.max(1, Math.min(12, Math.round(rawAbs)));
    const tc = Math.max(1, Math.min(12, Math.round(rawTc)));

    const brakeBias = Math.round(parseNumber(findItemValue(ctx.sections, ["brake bias", "bias"]), 64));
    const fuel = Math.round(parseNumber(ctx.fuelLoad || "30", 30));

    return `[ABOUT]
AUTHOR=APEXWALL AI
DESCRIPTION=${ctx.summary ? ctx.summary.replace(/[\\r\\n]+/g, " ") : "Championship Calibrated Baseline"}

[ABS]
VALUE=${abs}

[ARB_FRONT]
VALUE=${fArb}

[ARB_REAR]
VALUE=${rArb}

[BRAKE_POWER_MULT]
VALUE=100

[CAMBER_LF]
VALUE=${fCamber}

[CAMBER_LR]
VALUE=${rCamber}

[CAMBER_RF]
VALUE=${fCamber}

[CAMBER_RR]
VALUE=${rCamber}

[CAR]
MODEL=${carId}

[DAMP_BUMP_LF]
VALUE=${bumpF}

[DAMP_BUMP_LR]
VALUE=${bumpR}

[DAMP_BUMP_RF]
VALUE=${bumpF}

[DAMP_BUMP_RR]
VALUE=${bumpR}

[DAMP_FAST_BUMP_LF]
VALUE=${fastBumpF}

[DAMP_FAST_BUMP_LR]
VALUE=${fastBumpR}

[DAMP_FAST_BUMP_RF]
VALUE=${fastBumpF}

[DAMP_FAST_BUMP_RR]
VALUE=${fastBumpR}

[DAMP_FAST_REBOUND_LF]
VALUE=${fastReboundF}

[DAMP_FAST_REBOUND_LR]
VALUE=${fastReboundR}

[DAMP_FAST_REBOUND_RF]
VALUE=${fastReboundF}

[DAMP_FAST_REBOUND_RR]
VALUE=${fastReboundR}

[DAMP_REBOUND_LF]
VALUE=${reboundF}

[DAMP_REBOUND_LR]
VALUE=${reboundR}

[DAMP_REBOUND_RF]
VALUE=${reboundF}

[DAMP_REBOUND_RR]
VALUE=${reboundR}

[DIFF_COAST]
VALUE=${diffCoast}

[DIFF_POWER]
VALUE=${diffPower}

[DIFF_PRELOAD]
VALUE=40

[ENGINE_LIMITER]
VALUE=100

[FINAL_RATIO]
VALUE=1

[FRONT_BIAS]
VALUE=${brakeBias}

[FUEL]
VALUE=${fuel}

[INTERNAL_GEAR_2]
VALUE=0

[INTERNAL_GEAR_3]
VALUE=3

[INTERNAL_GEAR_4]
VALUE=6

[INTERNAL_GEAR_5]
VALUE=14

[INTERNAL_GEAR_6]
VALUE=12

[INTERNAL_GEAR_7]
VALUE=18

[PACKER_RANGE_LF]
VALUE=${packerF}

[PACKER_RANGE_LR]
VALUE=${packerR}

[PACKER_RANGE_RF]
VALUE=${packerF}

[PACKER_RANGE_RR]
VALUE=${packerR}

[PRESSURE_LF]
VALUE=${flPsi}

[PRESSURE_LR]
VALUE=${rlPsi}

[PRESSURE_RF]
VALUE=${frPsi}

[PRESSURE_RR]
VALUE=${rrPsi}

[ROD_LENGTH_LF]
VALUE=${rodF}

[ROD_LENGTH_LR]
VALUE=${rodR}

[ROD_LENGTH_RF]
VALUE=${rodF}

[ROD_LENGTH_RR]
VALUE=${rodR}

[SPRING_RATE_LF]
VALUE=${springF}

[SPRING_RATE_LR]
VALUE=${springR}

[SPRING_RATE_RF]
VALUE=${springF}

[SPRING_RATE_RR]
VALUE=${springR}

[TOE_OUT_LF]
VALUE=${fToe}

[TOE_OUT_LR]
VALUE=${rToe}

[TOE_OUT_RF]
VALUE=${fToe}

[TOE_OUT_RR]
VALUE=${rToe}

[TRACTION_CONTROL]
VALUE=${tc}

[TYRES]
VALUE=1

[WING_1]
VALUE=${wing1}

[WING_2]
VALUE=${wing2}

[__EXT_PATCH]
VERSION=0.3.0-preview342
`;
  }

  // ============================================================================
  // UNIVERSAL ARCHETYPE-GROUNDED ASSETTO CORSA CALIBRATION
  // (Formula Modern & Historic, Prototypes/Hypercar, Cup/GT4, Touring/FWD, Street)
  // ============================================================================
  const p = archetype.coldPsi;
  const rawFlPsi = parseNumber(findItemValue(ctx.sections, ["front left", "fl cold", "pressure lf", "pressure fl"]), p.fl.recommended);
  const rawFrPsi = parseNumber(findItemValue(ctx.sections, ["front right", "fr cold", "pressure rf", "pressure fr"]), p.fr.recommended);
  const rawRlPsi = parseNumber(findItemValue(ctx.sections, ["rear left", "rl cold", "pressure lr", "pressure rl"]), p.rl.recommended);
  const rawRrPsi = parseNumber(findItemValue(ctx.sections, ["rear right", "rr cold", "pressure rr"]), p.rr.recommended);

  // Enforce authentic archetype cold tyre pressure bounds
  const flPsi = Math.max(p.fl.min, Math.min(p.fl.max, Math.round(rawFlPsi > p.fl.max + 3 ? p.fl.recommended : rawFlPsi)));
  const frPsi = Math.max(p.fr.min, Math.min(p.fr.max, Math.round(rawFrPsi > p.fr.max + 3 ? p.fr.recommended : rawFrPsi)));
  const rlPsi = Math.max(p.rl.min, Math.min(p.rl.max, Math.round(rawRlPsi > p.rl.max + 3 ? p.rl.recommended : rawRlPsi)));
  const rrPsi = Math.max(p.rr.min, Math.min(p.rr.max, Math.round(rawRrPsi > p.rr.max + 3 ? p.rr.recommended : rawRrPsi)));

  // Camber (Stored in tenths of a degree in AC INI: -3.3 deg -> -33)
  const align = archetype.alignment;
  const rawFCamber = parseNumber(findItemValue(ctx.sections, ["front camber", "camber lf"]), align.camberFrontDeg.recommended);
  const rawRCamber = parseNumber(findItemValue(ctx.sections, ["rear camber", "camber lr"]), align.camberRearDeg.recommended);
  const fCamber = scaleACCamber(rawFCamber);
  const rCamber = scaleACCamber(rawRCamber);

  // Toe (Integer clicks)
  const rawFToe = parseNumber(findItemValue(ctx.sections, ["front toe", "toe lf"]), align.toeFrontClicks);
  const rawRToe = parseNumber(findItemValue(ctx.sections, ["rear toe", "toe lr"]), align.toeRearClicks);
  const fToe = Math.round(rawFToe);
  const rToe = Math.round(rawRToe);

  // Anti-Roll Bars
  const susp = archetype.suspension;
  const rawFArb = parseNumber(findItemValue(ctx.sections, ["front anti-roll", "front arb", "arb front"]), susp.arbFrontStep);
  const rawRArb = parseNumber(findItemValue(ctx.sections, ["rear anti-roll", "rear arb", "arb rear"]), susp.arbRearStep);
  let fArb = Math.round(rawFArb);
  let rArb = Math.round(rawRArb);
  if (archetype.id === "formula_modern") {
    if (fArb < 1000) fArb = Math.round(60000 + (Math.max(1, Math.min(6, fArb)) / 6) * 60000);
    if (rArb < 1000) rArb = Math.round(40000 + (Math.max(1, Math.min(6, rArb)) / 6) * 60000);
  } else {
    fArb = Math.max(1, Math.min(susp.arbMaxSteps, fArb > susp.arbMaxSteps ? susp.arbFrontStep : fArb));
    rArb = Math.max(1, Math.min(susp.arbMaxSteps, rArb > susp.arbMaxSteps ? susp.arbRearStep : rArb));
  }

  // Rod Lengths (Ride Height Calibration)
  const rawRodF = parseNumber(findItemValue(ctx.sections, ["rod length lf", "rod length front", "front ride"]), susp.rodLengthFrontMm);
  const rawRodR = parseNumber(findItemValue(ctx.sections, ["rod length lr", "rod length rear", "rear ride"]), susp.rodLengthRearMm);
  const rodLF = Math.round(rawRodF);
  const rodRF = rodLF;
  const rodLR = Math.round(rawRodR);
  const rodRR = rodLR;

  // Springs
  const springLF = susp.springRateFrontNmm;
  const springRF = springLF;
  const springLR = susp.springRateRearNmm;
  const springRR = springLR;

  // Packers
  const packerLF = susp.packersFrontMm;
  const packerRF = packerLF;
  const packerLR = susp.packersRearMm;
  const packerRR = packerLR;

  // Dampers
  const damp = archetype.dampers;
  const rawBumpSlow = parseNumber(
    findItemValue(ctx.sections, ["bump lf", "slow bump lf", "bump front", "bump"], ["bumpstop", "stop", "heave", "packer"]),
    damp.slowBumpFront
  );
  const rawReboundSlow = parseNumber(
    findItemValue(ctx.sections, ["rebound lf", "slow rebound lf", "rebound front", "rebound"], ["heave"]),
    damp.slowReboundFront
  );
  const bumpSlow = Math.min(damp.clickScaleMax, Math.max(1, Math.round(rawBumpSlow)));
  const reboundSlow = Math.min(damp.clickScaleMax, Math.max(1, Math.round(rawReboundSlow)));
  const bumpRear = Math.min(damp.clickScaleMax, Math.max(1, damp.slowBumpRear));
  const reboundRear = Math.min(damp.clickScaleMax, Math.max(1, damp.slowReboundRear));

  // Differential
  const diffRules = archetype.differential;
  const rawDiffPower = parseNumber(findItemValue(ctx.sections, ["diff power", "power lock", "differential"]), diffRules.powerRecommended);
  const rawDiffCoast = parseNumber(findItemValue(ctx.sections, ["diff coast", "coast lock"]), diffRules.coastRecommended);
  const diffPower = Math.max(diffRules.powerMin, Math.min(diffRules.powerMax, Math.round(rawDiffPower)));
  const diffCoast = Math.max(diffRules.coastMin, Math.min(diffRules.coastMax, Math.round(rawDiffCoast)));
  const diffPreload = diffRules.preloadNm;

  // Aero / Wings
  const aeroRules = archetype.aero;
  const rawFWing = parseNumber(findItemValue(ctx.sections, ["front splitter", "front wing", "wing 0"]), aeroRules.frontWingNotches);
  const rawRWing = parseNumber(findItemValue(ctx.sections, ["rear wing", "wing 1", "wing 2"]), aeroRules.rearWingNotches);
  const fWing = Math.round(rawFWing);
  const rWing = Math.round(rawRWing);

  // Brakes & Fuel
  const elec = archetype.electronics;
  const brakeBias = Math.round(parseNumber(findItemValue(ctx.sections, ["brake bias", "bias"]), elec.brakeBiasFrontPct));
  const fuel = Math.round(parseNumber(ctx.fuelLoad || "25", 25));

  // Dynamic Subsections based on Authentic Vehicle Capabilities
  let heaveBlock = "";
  if (susp.hasHeaveSprings) {
    heaveBlock = `
[SPRING_RATE_HF]
VALUE=${susp.heaveSpringFrontNmm || 100}

[SPRING_RATE_HR]
VALUE=${susp.heaveSpringRearNmm || 20}

[BUMP_STOP_RATE_HF]
VALUE=70

[BUMP_STOP_RATE_HR]
VALUE=70

[DAMP_BUMP_HF]
VALUE=4

[DAMP_BUMP_HR]
VALUE=2

[DAMP_FAST_BUMP_HF]
VALUE=2

[DAMP_FAST_BUMP_HR]
VALUE=1

[DAMP_REBOUND_HF]
VALUE=4

[DAMP_REBOUND_HR]
VALUE=2

[DAMP_FAST_REBOUND_HF]
VALUE=2

[DAMP_FAST_REBOUND_HR]
VALUE=1
`;
  }

  let hybridBlock = "";
  if (elec.hasHybrid) {
    hybridBlock = `
[BRAKE_ENGINE]
VALUE=6

[MGUH_MODE]
VALUE=0

[MGUK_DELIVERY]
VALUE=0

[MGUK_RECOVERY]
VALUE=0
`;
  }

  let electronicsBlock = "";
  if (elec.hasAbs) {
    electronicsBlock += `
[ABS]
VALUE=${elec.absRecommended || 4}
`;
  }
  if (elec.hasTc) {
    electronicsBlock += `
[TRACTION_CONTROL]
VALUE=${elec.tcRecommended || 4}
`;
  }

  let aeroBlock = "";
  if (archetype.id === "formula_modern" || archetype.id === "formula_historic") {
    aeroBlock = `
[WING_0]
VALUE=${fWing}

[WING_1]
VALUE=${rWing}
`;
  } else if (aeroRules.hasRearWing) {
    aeroBlock = `
[WING_1]
VALUE=${rWing}
`;
  }

  return `; ==============================================================================
; APEXWALL AI // ASSETTO CORSA CALIBRATED SETUP SPECIFICATION
; Car: ${ctx.car} [${carId}]
; Track: ${ctx.track}
; Archetype: ${archetype.displayName} (${archetype.description})
; Generated: ${new Date().toISOString()}
; Summary: ${ctx.summary ? ctx.summary.replace(/[\\r\\n]+/g, " ") : "Calibrated baseline by ApexWall AI."}
; ==============================================================================

[CAR]
MODEL=${carId}

[TYRES]
VALUE=0

[PRESSURE_LF]
VALUE=${flPsi}

[PRESSURE_RF]
VALUE=${frPsi}

[PRESSURE_LR]
VALUE=${rlPsi}

[PRESSURE_RR]
VALUE=${rrPsi}

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

[ROD_LENGTH_LF]
VALUE=${rodLF}

[ROD_LENGTH_RF]
VALUE=${rodRF}

[ROD_LENGTH_LR]
VALUE=${rodLR}

[ROD_LENGTH_RR]
VALUE=${rodRR}

[SPRING_RATE_LF]
VALUE=${springLF}

[SPRING_RATE_RF]
VALUE=${springRF}

[SPRING_RATE_LR]
VALUE=${springLR}

[SPRING_RATE_RR]
VALUE=${springRR}

[BUMP_STOP_RATE_LF]
VALUE=70

[BUMP_STOP_RATE_RF]
VALUE=70

[BUMP_STOP_RATE_LR]
VALUE=70

[BUMP_STOP_RATE_RR]
VALUE=70

[PACKER_RANGE_LF]
VALUE=${packerLF}

[PACKER_RANGE_RF]
VALUE=${packerRF}

[PACKER_RANGE_LR]
VALUE=${packerLR}

[PACKER_RANGE_RR]
VALUE=${packerRR}

[DAMP_BUMP_LF]
VALUE=${bumpSlow}

[DAMP_BUMP_RF]
VALUE=${bumpSlow}

[DAMP_BUMP_LR]
VALUE=${bumpRear}

[DAMP_BUMP_RR]
VALUE=${bumpRear}

[DAMP_FAST_BUMP_LF]
VALUE=${Math.max(1, bumpSlow - 3)}

[DAMP_FAST_BUMP_RF]
VALUE=${Math.max(1, bumpSlow - 3)}

[DAMP_FAST_BUMP_LR]
VALUE=${Math.max(1, bumpRear - 2)}

[DAMP_FAST_BUMP_RR]
VALUE=${Math.max(1, bumpRear - 2)}

[DAMP_REBOUND_LF]
VALUE=${reboundSlow}

[DAMP_REBOUND_RF]
VALUE=${reboundSlow}

[DAMP_REBOUND_LR]
VALUE=${reboundRear}

[DAMP_REBOUND_RR]
VALUE=${reboundRear}

[DAMP_FAST_REBOUND_LF]
VALUE=${Math.max(1, reboundSlow - 3)}

[DAMP_FAST_REBOUND_RF]
VALUE=${Math.max(1, reboundSlow - 3)}

[DAMP_FAST_REBOUND_LR]
VALUE=${Math.max(1, reboundRear - 2)}

[DAMP_FAST_REBOUND_RR]
VALUE=${Math.max(1, reboundRear - 2)}
${heaveBlock}
${aeroBlock}
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
${electronicsBlock}
${hybridBlock}
[FUEL]
VALUE=${fuel}

[__EXT_PATCH]
VERSION=0.3.0-preview342
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
 * Dynamically resolves Windows Documents path across all PCs (OneDrive, custom drives, UserProfile)
 */
export function generateWindowsInstallBat(
  targetDirWindows: string,
  filename: string,
  setupName: string,
  secondaryDirWindows?: string
): string {
  // Strip leading "Documents\" if present so we can attach to dynamically resolved docs path
  const relTarget = targetDirWindows.replace(/^Documents\\/i, "");
  const relSecondary = secondaryDirWindows ? secondaryDirWindows.replace(/^Documents\\/i, "") : "";

  const secondaryBlock = relSecondary
    ? `
REM Inject into generic library
set "GEN_DIR=%USER_DOCS%\\${relSecondary}"
if not exist "%GEN_DIR%" (
  if exist "%USERPROFILE%\\Documents\\${relSecondary}" (
    set "GEN_DIR=%USERPROFILE%\\Documents\\${relSecondary}"
  ) else if exist "%USERPROFILE%\\OneDrive\\Documents\\${relSecondary}" (
    set "GEN_DIR=%USERPROFILE%\\OneDrive\\Documents\\${relSecondary}"
  )
)
if not exist "%GEN_DIR%" (
  mkdir "%GEN_DIR%" >nul 2>&1
)
copy /Y "%~dp0${filename}" "%GEN_DIR%\\${filename}" >nul
if %ERRORLEVEL% EQU 0 (
  echo [SUCCESS] Also injected into generic library:
  echo   "%GEN_DIR%\\${filename}"
  echo.
)
`
    : "";

  return `@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title ApexWall AI - Setup Auto-Installer

echo ===============================================================================
echo   🏁 APEXWALL AI // DIRECT SIM SETUP INJECTOR
echo ===============================================================================
echo Installing setup: "${setupName}"
echo File: "${filename}"
echo ===============================================================================
echo.

REM 1. Dynamically locate User's true Documents path on this PC (Registry / OneDrive / Profile)
set "USER_DOCS="
for /f "tokens=2*" %%a in ('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Personal 2^>nul') do set "USER_DOCS=%%b"
if defined USER_DOCS call set "USER_DOCS=%USER_DOCS%"

if not defined USER_DOCS if exist "%USERPROFILE%\\OneDrive\\Documents" set "USER_DOCS=%USERPROFILE%\\OneDrive\\Documents"
if not defined USER_DOCS if exist "%USERPROFILE%\\Documents" set "USER_DOCS=%USERPROFILE%\\Documents"
if not defined USER_DOCS if exist "%OneDrive%\\Documents" set "USER_DOCS=%OneDrive%\\Documents"
if not defined USER_DOCS set "USER_DOCS=%USERPROFILE%\\Documents"

echo [PC PATH] Detected Documents: "%USER_DOCS%"
echo.

REM 2. Determine target directories
set "FULL_DIR=%USER_DOCS%\\${relTarget}"

REM Fallback if directory already exists under another candidate
if not exist "%FULL_DIR%" (
  if exist "%USERPROFILE%\\Documents\\${relTarget}" (
    set "FULL_DIR=%USERPROFILE%\\Documents\\${relTarget}"
  ) else if exist "%USERPROFILE%\\OneDrive\\Documents\\${relTarget}" (
    set "FULL_DIR=%USERPROFILE%\\OneDrive\\Documents\\${relTarget}"
  )
)

if not exist "%FULL_DIR%" (
  echo [INFO] Creating directory: "!FULL_DIR!"
  mkdir "!FULL_DIR!" >nul 2>&1
)

copy /Y "%~dp0${filename}" "!FULL_DIR!\\${filename}" >nul
if %ERRORLEVEL% EQU 0 (
  echo [SUCCESS] Setup successfully injected into:
  echo   "!FULL_DIR!\\${filename}"
  echo.
  ${secondaryBlock}
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
