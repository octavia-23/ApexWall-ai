import { SetupSection } from "@/types/telemetry";

export type SupportedSetupFormat =
  | "ACC_JSON"
  | "AC_INI"
  | "ACEVO_INI"
  | "SVM"
  | "F1_JSON"
  | "GENERIC_JSON"
  | "UNKNOWN";

export interface ParsedSetupFile {
  format: SupportedSetupFormat;
  game: string;
  car: string;
  track?: string;
  setupName: string;
  summary: string;
  sections: SetupSection[];
  rawParameterCount: number;
  warnings?: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// ----------------------------------------------------------------------------
// Car Name Map for ACC
// ----------------------------------------------------------------------------
const ACC_CAR_MAP: Record<string, string> = {
  amg_gt3: "Mercedes-AMG GT3",
  amg_gt3_evo: "Mercedes-AMG GT3 Evo",
  audi_r8_lms: "Audi R8 LMS",
  audi_r8_lms_evo: "Audi R8 LMS Evo",
  audi_r8_lms_evo_ii: "Audi R8 LMS Evo II",
  bentley_continental_gt3_2015: "Bentley Continental GT3 2015",
  bentley_continental_gt3_2018: "Bentley Continental GT3 2018",
  bmw_m6_gt3: "BMW M6 GT3",
  bmw_m4_gt3: "BMW M4 GT3",
  ferrari_488_gt3: "Ferrari 488 GT3",
  ferrari_488_gt3_evo: "Ferrari 488 GT3 Evo",
  ferrari_296_gt3: "Ferrari 296 GT3",
  ford_mustang_gt3: "Ford Mustang GT3",
  honda_nsx_gt3: "Honda NSX GT3",
  honda_nsx_gt3_evo: "Honda NSX GT3 Evo",
  lamborghini_huracan_gt3: "Lamborghini Huracán GT3",
  lamborghini_huracan_gt3_evo: "Lamborghini Huracán GT3 Evo",
  lamborghini_huracan_gt3_evo2: "Lamborghini Huracán GT3 Evo2",
  lexus_rc_f_gt3: "Lexus RC F GT3",
  mclaren_650s_gt3: "McLaren 650S GT3",
  mclaren_720s_gt3: "McLaren 720S GT3",
  mclaren_720s_gt3_evo: "McLaren 720S GT3 Evo",
  nissan_gt_r_gt3_2017: "Nissan GT-R Nismo GT3 2017",
  nissan_gt_r_gt3_2018: "Nissan GT-R Nismo GT3 2018",
  porsche_991_gt3_r: "Porsche 911 GT3 R (991)",
  porsche_991ii_gt3_r: "Porsche 911 GT3 R (991.2)",
  porsche_992_gt3_r: "Porsche 911 GT3 R (992)",
  aston_martin_v12_vantage_gt3: "Aston Martin V12 Vantage GT3",
  aston_martin_v8_vantage_gt3: "Aston Martin V8 Vantage GT3",
};

// ----------------------------------------------------------------------------
// Simple INI Parser helper
// ----------------------------------------------------------------------------
function parseIniSections(rawText: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "DEFAULT";

  const lines = rawText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#") || line.startsWith("//")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1).trim().toUpperCase();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim().toUpperCase();
      let val = line.slice(eqIdx + 1).trim();
      // Strip trailing comments (like "; -3.3 deg" or "// comment")
      const commentIdx = val.search(/[;#]/);
      if (commentIdx !== -1) {
        val = val.slice(0, commentIdx).trim();
      }
      // Strip surrounding quotes
      val = val.replace(/^["']|["']$/g, "");

      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      result[currentSection][key] = val;
    }
  }

  return result;
}

// ----------------------------------------------------------------------------
// 1. ACC JSON PARSER
// ----------------------------------------------------------------------------
export function parseACCSetupJson(jsonObj: any, fileName: string = "setup.json"): ParsedSetupFile {
  const warnings: string[] = [];
  const rawCarName = jsonObj.carName || "";
  const readableCar = ACC_CAR_MAP[rawCarName.toLowerCase()] || rawCarName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "GT3 Car";
  
  const setupName = fileName.replace(/\.json$/i, "").replace(/_/g, " ");
  const basic = jsonObj.basicSetup || {};
  const adv = jsonObj.advancedSetup || {};

  const sections: SetupSection[] = [];
  let totalParams = 0;

  // --- TYRES & ALIGNMENT ---
  const tyreItems: { label: string; value: string }[] = [];
  if (basic.tyres?.tyrePressure && Array.isArray(basic.tyres.tyrePressure)) {
    // In ACC JSON: value = (PSI - 20) * 10 => PSI = 20 + val / 10
    const [fl, fr, rl, rr] = basic.tyres.tyrePressure;
    const formatPsi = (v: number) => {
      if (v === undefined || v === null) return "26.5 psi";
      // If already stored as realistic PSI float (e.g. 26.5)
      const psi = v < 15 ? 20 + v : v > 100 ? v / 10 : 20 + v / 10;
      return `${psi.toFixed(1)} psi`;
    };
    tyreItems.push(
      { label: "Front Left Pressure", value: formatPsi(fl) },
      { label: "Front Right Pressure", value: formatPsi(fr) },
      { label: "Rear Left Pressure", value: formatPsi(rl) },
      { label: "Rear Right Pressure", value: formatPsi(rr) }
    );
  }

  if (basic.alignment) {
    const align = basic.alignment;
    if (align.staticCamber && Array.isArray(align.staticCamber)) {
      const [fl, fr, rl, rr] = align.staticCamber;
      tyreItems.push(
        { label: "Camber LF / RF", value: `${fl?.toFixed(1) ?? "-3.5"}° / ${fr?.toFixed(1) ?? "-3.5"}°` },
        { label: "Camber LR / RR", value: `${rl?.toFixed(1) ?? "-2.8"}° / ${rr?.toFixed(1) ?? "-2.8"}°` }
      );
    } else if (align.camber && Array.isArray(align.camber)) {
      // Camber click approximation (typically -4.0 + click * 0.1)
      const [fl, fr, rl, rr] = align.camber;
      tyreItems.push(
        { label: "Camber LF / RF", value: `Click ${fl} / ${fr}` },
        { label: "Camber LR / RR", value: `Click ${rl} / ${rr}` }
      );
    }

    if (align.toeOutLinear && Array.isArray(align.toeOutLinear)) {
      const [fl, fr, rl, rr] = align.toeOutLinear;
      tyreItems.push(
        { label: "Toe LF / RF", value: `${fl?.toFixed(2) ?? "-0.08"}° / ${fr?.toFixed(2) ?? "-0.08"}°` },
        { label: "Toe LR / RR", value: `${rl?.toFixed(2) ?? "0.15"}° / ${rr?.toFixed(2) ?? "0.15"}°` }
      );
    } else if (align.toe && Array.isArray(align.toe)) {
      const [fl, fr, rl, rr] = align.toe;
      tyreItems.push(
        { label: "Toe LF / RF", value: `Click ${fl} / ${fr}` },
        { label: "Toe LR / RR", value: `Click ${rl} / ${rr}` }
      );
    }

    if (align.casterLF !== undefined) {
      tyreItems.push({ label: "Caster", value: `${align.casterLF}°` });
    }
    if (align.steerRatio !== undefined) {
      tyreItems.push({ label: "Steer Ratio", value: `${align.steerRatio}` });
    }
  }

  if (tyreItems.length > 0) {
    sections.push({ title: "TYRES", items: tyreItems });
    totalParams += tyreItems.length;
  }

  // --- ELECTRONICS ---
  const elecItems: { label: string; value: string }[] = [];
  if (basic.electronics) {
    const el = basic.electronics;
    if (el.tC1 !== undefined) elecItems.push({ label: "TC1 (Traction Control)", value: `${el.tC1}` });
    if (el.tC2 !== undefined) elecItems.push({ label: "TC2 (Cut / Slip)", value: `${el.tC2}` });
    if (el.abs !== undefined) elecItems.push({ label: "ABS", value: `${el.abs}` });
    if (el.eCUMap !== undefined) elecItems.push({ label: "ECU Map", value: `${el.eCUMap}` });
  }
  if (basic.strategy?.fuel !== undefined) {
    elecItems.push({ label: "Fuel Load", value: `${basic.strategy.fuel} L` });
  }
  if (elecItems.length > 0) {
    sections.push({ title: "ELECTRONICS", items: elecItems });
    totalParams += elecItems.length;
  }

  // --- MECHANICAL GRIP ---
  const mechItems: { label: string; value: string }[] = [];
  if (adv.mechanicalBalance) {
    const mb = adv.mechanicalBalance;
    if (mb.aRBFront !== undefined) mechItems.push({ label: "Anti-Roll Bar Front", value: `${mb.aRBFront}` });
    if (mb.aRBRear !== undefined) mechItems.push({ label: "Anti-Roll Bar Rear", value: `${mb.aRBRear}` });
    if (mb.wheelRate && Array.isArray(mb.wheelRate)) {
      const [fl, , rl] = mb.wheelRate;
      mechItems.push(
        { label: "Front Wheel Rate", value: `${Math.round(fl / 1000)} N/mm` },
        { label: "Rear Wheel Rate", value: `${Math.round(rl / 1000)} N/mm` }
      );
    }
    if (mb.bumpStopRateUp && Array.isArray(mb.bumpStopRateUp)) {
      const [fl, , rl] = mb.bumpStopRateUp;
      mechItems.push(
        { label: "Bumpstop Rate Front", value: `${fl} N` },
        { label: "Bumpstop Rate Rear", value: `${rl} N` }
      );
    }
    if (mb.bumpStopWindow && Array.isArray(mb.bumpStopWindow)) {
      const [fl, , rl] = mb.bumpStopWindow;
      mechItems.push(
        { label: "Bumpstop Range Front", value: `${fl} mm` },
        { label: "Bumpstop Range Rear", value: `${rl} mm` }
      );
    }
    if (mb.brakeBias !== undefined) {
      mechItems.push({ label: "Brake Bias", value: `${mb.brakeBias}%` });
    }
    if (mb.brakeTorque !== undefined) {
      mechItems.push({ label: "Brake Pressure", value: `${mb.brakeTorque}%` });
    }
  }
  if (adv.drivetrain?.preload !== undefined) {
    mechItems.push({ label: "Differential Preload", value: `${adv.drivetrain.preload} Nm` });
  }
  if (mechItems.length > 0) {
    sections.push({ title: "MECHANICAL GRIP", items: mechItems });
    totalParams += mechItems.length;
  }

  // --- DAMPERS ---
  const dampItems: { label: string; value: string }[] = [];
  if (adv.dampers) {
    const d = adv.dampers;
    if (d.bumpSlow && Array.isArray(d.bumpSlow)) {
      const [fl, , rl] = d.bumpSlow;
      dampItems.push({ label: "Bump Slow Front / Rear", value: `${fl} / ${rl}` });
    }
    if (d.bumpFast && Array.isArray(d.bumpFast)) {
      const [fl, , rl] = d.bumpFast;
      dampItems.push({ label: "Bump Fast Front / Rear", value: `${fl} / ${rl}` });
    }
    if (d.reboundSlow && Array.isArray(d.reboundSlow)) {
      const [fl, , rl] = d.reboundSlow;
      dampItems.push({ label: "Rebound Slow Front / Rear", value: `${fl} / ${rl}` });
    }
    if (d.reboundFast && Array.isArray(d.reboundFast)) {
      const [fl, , rl] = d.reboundFast;
      dampItems.push({ label: "Rebound Fast Front / Rear", value: `${fl} / ${rl}` });
    }
  }
  if (dampItems.length > 0) {
    sections.push({ title: "DAMPERS", items: dampItems });
    totalParams += dampItems.length;
  }

  // --- AERO BALANCE ---
  const aeroItems: { label: string; value: string }[] = [];
  if (adv.aeroBalance) {
    const aero = adv.aeroBalance;
    if (aero.rideHeight && Array.isArray(aero.rideHeight)) {
      const [fl, , rl] = aero.rideHeight;
      aeroItems.push(
        { label: "Front Ride Height", value: `${fl} mm` },
        { label: "Rear Ride Height", value: `${rl} mm` },
        { label: "Rake", value: `${rl - fl > 0 ? "+" : ""}${rl - fl} mm` }
      );
    }
    if (aero.rearWing !== undefined) {
      aeroItems.push({ label: "Rear Wing", value: `${aero.rearWing}` });
    }
    if (aero.splitter !== undefined) {
      aeroItems.push({ label: "Front Splitter", value: `${aero.splitter}` });
    }
    if (aero.brakeDuct && Array.isArray(aero.brakeDuct)) {
      const [f, r] = aero.brakeDuct;
      aeroItems.push({ label: "Brake Ducts Front / Rear", value: `${f} / ${r}` });
    }
  }
  if (aeroItems.length > 0) {
    sections.push({ title: "AERO", items: aeroItems });
    totalParams += aeroItems.length;
  }

  return {
    format: "ACC_JSON",
    game: "Assetto Corsa Competizione",
    car: readableCar,
    setupName,
    summary: `Ingested native Assetto Corsa Competizione setup for ${readableCar}. Fully extracted ${totalParams} chassis parameters across garage tabs.`,
    sections,
    rawParameterCount: totalParams,
    warnings: warnings.length > 0 ? warnings : undefined,
    confidence: "HIGH",
  };
}

// ----------------------------------------------------------------------------
// 2. ASSETTO CORSA .INI PARSER (Standard & Saved Setups)
// ----------------------------------------------------------------------------
export function parseAssettoCorsaINI(iniText: string, fileName: string = "setup.ini"): ParsedSetupFile {
  const ini = parseIniSections(iniText);
  const sections: SetupSection[] = [];
  let totalParams = 0;

  // Extract Car
  let carName = "";
  if (ini["CAR"]?.["MODEL"]) {
    carName = ini["CAR"]["MODEL"].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } else {
    // Derive from filename or path if possible
    carName = fileName.replace(/\.ini$/i, "").replace(/_/g, " ");
  }

  // Helper to read section value
  const getVal = (sec: string, key: string = "VALUE"): string | undefined => {
    return ini[sec]?.[key];
  };

  const getNum = (sec: string, key: string = "VALUE"): number | undefined => {
    const v = getVal(sec, key);
    if (v === undefined) return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  };

  // --- TYRES ---
  const tyreItems: { label: string; value: string }[] = [];
  const pFL = getNum("PRESSURE_LF");
  const pFR = getNum("PRESSURE_RF");
  const pRL = getNum("PRESSURE_LR") ?? getNum("PRESSURE_RL");
  const pRR = getNum("PRESSURE_RR");
  if (pFL !== undefined) tyreItems.push({ label: "Front Left Pressure", value: `${pFL.toFixed(1)} psi` });
  if (pFR !== undefined) tyreItems.push({ label: "Front Right Pressure", value: `${pFR.toFixed(1)} psi` });
  if (pRL !== undefined) tyreItems.push({ label: "Rear Left Pressure", value: `${pRL.toFixed(1)} psi` });
  if (pRR !== undefined) tyreItems.push({ label: "Rear Right Pressure", value: `${pRR.toFixed(1)} psi` });

  if (tyreItems.length > 0) {
    sections.push({ title: "TYRES", items: tyreItems });
    totalParams += tyreItems.length;
  }

  // --- ALIGNMENT ---
  const alignItems: { label: string; value: string }[] = [];
  // Camber in AC INI is stored in tenths of degrees (e.g., -33 = -3.3 deg)
  const cFL = getNum("CAMBER_LF");
  const cFR = getNum("CAMBER_RF");
  const cRL = getNum("CAMBER_LR") ?? getNum("CAMBER_RL");
  const cRR = getNum("CAMBER_RR");
  if (cFL !== undefined) {
    const degFL = Math.abs(cFL) > 15 ? (cFL / 10).toFixed(1) : cFL.toFixed(1);
    const degFR = cFR !== undefined ? (Math.abs(cFR) > 15 ? (cFR / 10).toFixed(1) : cFR.toFixed(1)) : degFL;
    alignItems.push({ label: "Camber LF / RF", value: `${degFL}° / ${degFR}°` });
  }
  if (cRL !== undefined) {
    const degRL = Math.abs(cRL) > 15 ? (cRL / 10).toFixed(1) : cRL.toFixed(1);
    const degRR = cRR !== undefined ? (Math.abs(cRR) > 15 ? (cRR / 10).toFixed(1) : cRR.toFixed(1)) : degRL;
    alignItems.push({ label: "Camber LR / RR", value: `${degRL}° / ${degRR}°` });
  }

  const tFL = getNum("TOE_OUT_LF");
  const tFR = getNum("TOE_OUT_RF");
  const tRL = getNum("TOE_OUT_LR") ?? getNum("TOE_OUT_RL");
  const tRR = getNum("TOE_OUT_RR");
  if (tFL !== undefined) {
    alignItems.push({ label: "Toe LF / RF", value: `${tFL} clicks` });
  }
  if (tRL !== undefined) {
    alignItems.push({ label: "Toe LR / RR", value: `${tRL} clicks` });
  }

  const caster = getNum("CASTER_LF");
  if (caster !== undefined) {
    alignItems.push({ label: "Caster", value: `${caster.toFixed(1)}°` });
  }

  if (alignItems.length > 0) {
    sections.push({ title: "ALIGNMENT", items: alignItems });
    totalParams += alignItems.length;
  }

  // --- SUSPENSION & ARB ---
  const suspItems: { label: string; value: string }[] = [];
  const arbF = getNum("ARB_FRONT");
  const arbR = getNum("ARB_REAR");
  if (arbF !== undefined) suspItems.push({ label: "Antiroll Bar Front", value: `${arbF}` });
  if (arbR !== undefined) suspItems.push({ label: "Antiroll Bar Rear", value: `${arbR}` });

  const spFL = getNum("SPRING_RATE_LF");
  const spRL = getNum("SPRING_RATE_LR") ?? getNum("SPRING_RATE_RL");
  if (spFL !== undefined) suspItems.push({ label: "Front Wheel Rate", value: `${spFL} N/mm` });
  if (spRL !== undefined) suspItems.push({ label: "Rear Wheel Rate", value: `${spRL} N/mm` });

  const rodFL = getNum("ROD_LENGTH_LF");
  const rodRL = getNum("ROD_LENGTH_LR") ?? getNum("ROD_LENGTH_RL");
  if (rodFL !== undefined) suspItems.push({ label: "Rod Length LF/RF", value: `${rodFL} mm` });
  if (rodRL !== undefined) suspItems.push({ label: "Rod Length LR/RR", value: `${rodRL} mm` });

  if (suspItems.length > 0) {
    sections.push({ title: "SUSPENSION", items: suspItems });
    totalParams += suspItems.length;
  }

  // --- DAMPERS ---
  const dampItems: { label: string; value: string }[] = [];
  const bSlowF = getNum("DAMP_BUMP_LF");
  const bSlowR = getNum("DAMP_BUMP_LR") ?? getNum("DAMP_BUMP_RL");
  if (bSlowF !== undefined) dampItems.push({ label: "Slow Bump Front / Rear", value: `${bSlowF} / ${bSlowR ?? bSlowF}` });

  const rSlowF = getNum("DAMP_REBOUND_LF");
  const rSlowR = getNum("DAMP_REBOUND_LR") ?? getNum("DAMP_REBOUND_RL");
  if (rSlowF !== undefined) dampItems.push({ label: "Slow Rebound Front / Rear", value: `${rSlowF} / ${rSlowR ?? rSlowF}` });

  const bFastF = getNum("DAMP_FAST_BUMP_LF");
  const bFastR = getNum("DAMP_FAST_BUMP_LR") ?? getNum("DAMP_FAST_BUMP_RL");
  if (bFastF !== undefined) dampItems.push({ label: "Fast Bump Front / Rear", value: `${bFastF} / ${bFastR ?? bFastF}` });

  const rFastF = getNum("DAMP_FAST_REBOUND_LF");
  const rFastR = getNum("DAMP_FAST_REBOUND_LR") ?? getNum("DAMP_FAST_REBOUND_RL");
  if (rFastF !== undefined) dampItems.push({ label: "Fast Rebound Front / Rear", value: `${rFastF} / ${rFastR ?? rFastF}` });

  if (dampItems.length > 0) {
    sections.push({ title: "DAMPERS", items: dampItems });
    totalParams += dampItems.length;
  }

  // --- DRIVETRAIN ---
  const diffItems: { label: string; value: string }[] = [];
  const dPow = getNum("DIFF_POWER");
  const dCoast = getNum("DIFF_COAST");
  const dPre = getNum("DIFF_PRELOAD");
  if (dPow !== undefined) diffItems.push({ label: "Diff Power", value: `${dPow}%` });
  if (dCoast !== undefined) diffItems.push({ label: "Diff Coast", value: `${dCoast}%` });
  if (dPre !== undefined) diffItems.push({ label: "Diff Preload", value: `${dPre} Nm` });

  if (diffItems.length > 0) {
    sections.push({ title: "DRIVETRAIN", items: diffItems });
    totalParams += diffItems.length;
  }

  // --- AERO ---
  const aeroItems: { label: string; value: string }[] = [];
  const w0 = getNum("WING_0");
  const w1 = getNum("WING_1");
  const w2 = getNum("WING_2");
  if (w0 !== undefined) aeroItems.push({ label: "Front Splitter [Wing 0]", value: `${w0}` });
  if (w1 !== undefined) aeroItems.push({ label: "Front Wing [Wing 1]", value: `${w1}` });
  if (w2 !== undefined) aeroItems.push({ label: "Rear Wing [Wing 2]", value: `${w2}` });

  if (aeroItems.length > 0) {
    sections.push({ title: "AERO", items: aeroItems });
    totalParams += aeroItems.length;
  }

  // --- BRAKES & ELECTRONICS ---
  const elecItems: { label: string; value: string }[] = [];
  const bb = getNum("FRONT_BIAS");
  if (bb !== undefined) elecItems.push({ label: "Brake Bias", value: `${bb}%` });
  const tc = getNum("TRACTION_CONTROL");
  if (tc !== undefined) elecItems.push({ label: "Traction Control", value: `${tc}` });
  const abs = getNum("ABS");
  if (abs !== undefined) elecItems.push({ label: "ABS", value: `${abs}` });
  const fuel = getNum("FUEL");
  if (fuel !== undefined) elecItems.push({ label: "Fuel", value: `${fuel} L` });

  if (elecItems.length > 0) {
    sections.push({ title: "ELECTRONICS & BRAKES", items: elecItems });
    totalParams += elecItems.length;
  }

  // If no structured parameters matched standard keys, harvest generic VALUE entries
  if (sections.length === 0) {
    const genericItems: { label: string; value: string }[] = [];
    for (const [secName, fields] of Object.entries(ini)) {
      if (secName === "DEFAULT" || secName === "HEADER" || secName === "CAR" || secName === "ABOUT") continue;
      const val = fields["VALUE"] || fields["POS"] || fields["DEFAULT"];
      if (val !== undefined) {
        genericItems.push({
          label: secName.replace(/_/g, " "),
          value: val,
        });
      }
    }
    if (genericItems.length > 0) {
      sections.push({ title: "GENERAL SETUP", items: genericItems });
      totalParams += genericItems.length;
    }
  }

  return {
    format: "AC_INI",
    game: "Assetto Corsa",
    car: carName || "Assetto Corsa Car",
    setupName: fileName.replace(/\.ini$/i, ""),
    summary: `Ingested Assetto Corsa .ini setup. Extracted ${totalParams} chassis parameters.`,
    sections,
    rawParameterCount: totalParams,
    confidence: sections.length > 0 ? "HIGH" : "LOW",
  };
}

// ----------------------------------------------------------------------------
// 3. SVM PARSER (rFactor 2 / Le Mans Ultimate / Automobilista 2)
// ----------------------------------------------------------------------------
export function parseSVMSetup(svmText: string, fileName: string = "setup.svm"): ParsedSetupFile {
  const ini = parseIniSections(svmText);
  const sections: SetupSection[] = [];
  let totalParams = 0;

  let carName = ini["CAR"]?.["TYPE"] || ini["GENERAL"]?.["VEHICLE"] || "";
  let trackName = ini["GENERAL"]?.["TRACK"] || "";

  // Detect whether LMU, AMS2, or rFactor 2
  const lowerText = svmText.toLowerCase();
  let game = "rFactor 2";
  if (lowerText.includes("le mans ultimate") || lowerText.includes("lmu") || /hypercar|lmp2|gte|gt3/i.test(carName)) {
    game = "Le Mans Ultimate";
  } else if (lowerText.includes("automobilista") || lowerText.includes("ams2") || /stockcar|copa|f-usa/i.test(carName)) {
    game = "Automobilista 2";
  }

  // --- TYRES & ALIGNMENT ---
  const tyreItems: { label: string; value: string }[] = [];
  const flPress = ini["FRONTLEFT"]?.["PRESSURE"];
  const frPress = ini["FRONTRIGHT"]?.["PRESSURE"];
  const rlPress = ini["REARLEFT"]?.["PRESSURE"];
  const rrPress = ini["REARRIGHT"]?.["PRESSURE"];
  if (flPress) tyreItems.push({ label: "Front Left Pressure", value: `${parseFloat(flPress).toFixed(1)} psi` });
  if (frPress) tyreItems.push({ label: "Front Right Pressure", value: `${parseFloat(frPress).toFixed(1)} psi` });
  if (rlPress) tyreItems.push({ label: "Rear Left Pressure", value: `${parseFloat(rlPress).toFixed(1)} psi` });
  if (rrPress) tyreItems.push({ label: "Rear Right Pressure", value: `${parseFloat(rrPress).toFixed(1)} psi` });

  const flCamber = ini["FRONTLEFT"]?.["CAMBER"];
  const rlCamber = ini["REARLEFT"]?.["CAMBER"];
  if (flCamber) tyreItems.push({ label: "Front Camber", value: `${parseFloat(flCamber).toFixed(1)}°` });
  if (rlCamber) tyreItems.push({ label: "Rear Camber", value: `${parseFloat(rlCamber).toFixed(1)}°` });

  const flToe = ini["FRONTLEFT"]?.["TOE"];
  const rlToe = ini["REARLEFT"]?.["TOE"];
  if (flToe) tyreItems.push({ label: "Front Toe", value: `${parseFloat(flToe).toFixed(2)}°` });
  if (rlToe) tyreItems.push({ label: "Rear Toe", value: `${parseFloat(rlToe).toFixed(2)}°` });

  if (tyreItems.length > 0) {
    sections.push({ title: "TYRES & ALIGNMENT", items: tyreItems });
    totalParams += tyreItems.length;
  }

  // --- CHASSIS & SUSPENSION ---
  const suspItems: { label: string; value: string }[] = [];
  const farb = ini["SUSPENSION"]?.["FRONTANTIROLLBAR"] || ini["SUSPENSION"]?.["FARB"];
  const rarb = ini["SUSPENSION"]?.["REARANTIROLLBAR"] || ini["SUSPENSION"]?.["RARB"];
  if (farb) suspItems.push({ label: "Front Anti-Roll Bar", value: farb });
  if (rarb) suspItems.push({ label: "Rear Anti-Roll Bar", value: rarb });

  const flSpring = ini["FRONTLEFT"]?.["SPRINGRATE"];
  const rlSpring = ini["REARLEFT"]?.["SPRINGRATE"];
  if (flSpring) suspItems.push({ label: "Front Spring Rate", value: `${Math.round(parseFloat(flSpring))} N/mm` });
  if (rlSpring) suspItems.push({ label: "Rear Spring Rate", value: `${Math.round(parseFloat(rlSpring))} N/mm` });

  const flRide = ini["FRONTLEFT"]?.["RIDEHEIGHT"];
  const rlRide = ini["REARLEFT"]?.["RIDEHEIGHT"];
  if (flRide) suspItems.push({ label: "Front Ride Height", value: `${parseFloat(flRide).toFixed(1)} mm` });
  if (rlRide) suspItems.push({ label: "Rear Ride Height", value: `${parseFloat(rlRide).toFixed(1)} mm` });

  if (suspItems.length > 0) {
    sections.push({ title: "CHASSIS & SUSPENSION", items: suspItems });
    totalParams += suspItems.length;
  }

  // --- DAMPERS ---
  const dampItems: { label: string; value: string }[] = [];
  const flSlowBump = ini["FRONTLEFT"]?.["SLOWBUMP"];
  const rlSlowBump = ini["REARLEFT"]?.["SLOWBUMP"];
  if (flSlowBump) dampItems.push({ label: "Slow Bump Front / Rear", value: `${flSlowBump} / ${rlSlowBump ?? flSlowBump}` });

  const flSlowReb = ini["FRONTLEFT"]?.["SLOWREBOUND"];
  const rlSlowReb = ini["REARLEFT"]?.["SLOWREBOUND"];
  if (flSlowReb) dampItems.push({ label: "Slow Rebound Front / Rear", value: `${flSlowReb} / ${rlSlowReb ?? flSlowReb}` });

  const flFastBump = ini["FRONTLEFT"]?.["FASTBUMP"];
  const rlFastBump = ini["REARLEFT"]?.["FASTBUMP"];
  if (flFastBump) dampItems.push({ label: "Fast Bump Front / Rear", value: `${flFastBump} / ${rlFastBump ?? flFastBump}` });

  const flFastReb = ini["FRONTLEFT"]?.["FASTREBOUND"];
  const rlFastReb = ini["REARLEFT"]?.["FASTREBOUND"];
  if (flFastReb) dampItems.push({ label: "Fast Rebound Front / Rear", value: `${flFastReb} / ${rlFastReb ?? flFastReb}` });

  if (dampItems.length > 0) {
    sections.push({ title: "DAMPERS", items: dampItems });
    totalParams += dampItems.length;
  }

  // --- DRIVETRAIN & BRAKES ---
  const diffItems: { label: string; value: string }[] = [];
  const diffPower = ini["DRIVETRAIN"]?.["DIFFERENTIALPOWER"];
  const diffCoast = ini["DRIVETRAIN"]?.["DIFFERENTIALCOAST"];
  const diffPreload = ini["DRIVETRAIN"]?.["DIFFERENTIALPRELOAD"];
  if (diffPower) diffItems.push({ label: "Diff Power", value: `${diffPower}%` });
  if (diffCoast) diffItems.push({ label: "Diff Coast", value: `${diffCoast}%` });
  if (diffPreload) diffItems.push({ label: "Diff Preload", value: `${diffPreload} Nm` });

  const bb = ini["GENERAL"]?.["BRAKEBIAS"];
  if (bb) diffItems.push({ label: "Brake Bias", value: `${parseFloat(bb).toFixed(1)}%` });

  const fuel = ini["GENERAL"]?.["FUEL"];
  if (fuel) diffItems.push({ label: "Fuel Load", value: `${Math.round(parseFloat(fuel))} L` });

  if (diffItems.length > 0) {
    sections.push({ title: "DRIVETRAIN & BRAKES", items: diffItems });
    totalParams += diffItems.length;
  }

  // --- AERO ---
  const aeroItems: { label: string; value: string }[] = [];
  const fWing = ini["GENERAL"]?.["FRONTWING"];
  const rWing = ini["GENERAL"]?.["REARWING"];
  if (fWing) aeroItems.push({ label: "Front Wing", value: fWing });
  if (rWing) aeroItems.push({ label: "Rear Wing", value: rWing });

  if (aeroItems.length > 0) {
    sections.push({ title: "AERODYNAMICS", items: aeroItems });
    totalParams += aeroItems.length;
  }

  return {
    format: "SVM",
    game,
    car: carName || "rFactor / LMU Vehicle",
    track: trackName || undefined,
    setupName: fileName.replace(/\.svm$/i, ""),
    summary: `Ingested ${game} .svm setup. Extracted ${totalParams} chassis parameters.`,
    sections,
    rawParameterCount: totalParams,
    confidence: "HIGH",
  };
}

// ----------------------------------------------------------------------------
// 4. EA SPORTS F1 JSON PARSER
// ----------------------------------------------------------------------------
export function parseF1SetupJson(obj: any, fileName: string = "setup.json"): ParsedSetupFile {
  const sections: SetupSection[] = [];
  let totalParams = 0;

  const carName = obj.car || "Formula 1 Car";
  const game = obj.game || "F1 24";

  if (obj.aerodynamics) {
    const aero = obj.aerodynamics;
    const items: { label: string; value: string }[] = [];
    if (aero.frontWingAerodynamics !== undefined) items.push({ label: "Front Wing Aero", value: `${aero.frontWingAerodynamics}` });
    if (aero.rearWingAerodynamics !== undefined) items.push({ label: "Rear Wing Aero", value: `${aero.rearWingAerodynamics}` });
    if (items.length > 0) {
      sections.push({ title: "AERODYNAMICS", items });
      totalParams += items.length;
    }
  }

  if (obj.transmission) {
    const t = obj.transmission;
    const items: { label: string; value: string }[] = [];
    if (t.differentialAdjustmentOnThrottle !== undefined) items.push({ label: "Diff On-Throttle", value: `${t.differentialAdjustmentOnThrottle}%` });
    if (t.differentialAdjustmentOffThrottle !== undefined) items.push({ label: "Diff Off-Throttle", value: `${t.differentialAdjustmentOffThrottle}%` });
    if (t.engineBraking !== undefined) items.push({ label: "Engine Braking", value: `${t.engineBraking}%` });
    if (items.length > 0) {
      sections.push({ title: "TRANSMISSION", items });
      totalParams += items.length;
    }
  }

  if (obj.suspensionGeometry) {
    const g = obj.suspensionGeometry;
    const items: { label: string; value: string }[] = [];
    if (g.frontCamber !== undefined) items.push({ label: "Front Camber", value: `${g.frontCamber}°` });
    if (g.rearCamber !== undefined) items.push({ label: "Rear Camber", value: `${g.rearCamber}°` });
    if (g.frontToeOut !== undefined) items.push({ label: "Front Toe-Out", value: `${g.frontToeOut}°` });
    if (g.rearToeIn !== undefined) items.push({ label: "Rear Toe-In", value: `${g.rearToeIn}°` });
    if (items.length > 0) {
      sections.push({ title: "SUSPENSION GEOMETRY", items });
      totalParams += items.length;
    }
  }

  if (obj.suspension) {
    const s = obj.suspension;
    const items: { label: string; value: string }[] = [];
    if (s.frontSuspension !== undefined) items.push({ label: "Front Suspension", value: `${s.frontSuspension}` });
    if (s.rearSuspension !== undefined) items.push({ label: "Rear Suspension", value: `${s.rearSuspension}` });
    if (s.frontAntiRollBar !== undefined) items.push({ label: "Front Anti-Roll Bar", value: `${s.frontAntiRollBar}` });
    if (s.rearAntiRollBar !== undefined) items.push({ label: "Rear Anti-Roll Bar", value: `${s.rearAntiRollBar}` });
    if (s.frontRideHeight !== undefined) items.push({ label: "Front Ride Height", value: `${s.frontRideHeight}` });
    if (s.rearRideHeight !== undefined) items.push({ label: "Rear Ride Height", value: `${s.rearRideHeight}` });
    if (items.length > 0) {
      sections.push({ title: "SUSPENSION", items });
      totalParams += items.length;
    }
  }

  if (obj.brakes) {
    const b = obj.brakes;
    const items: { label: string; value: string }[] = [];
    if (b.brakePressure !== undefined) items.push({ label: "Brake Pressure", value: `${b.brakePressure}%` });
    if (b.frontBrakeBias !== undefined) items.push({ label: "Brake Bias", value: `${b.frontBrakeBias}%` });
    if (items.length > 0) {
      sections.push({ title: "BRAKES", items });
      totalParams += items.length;
    }
  }

  if (obj.tyres) {
    const tyr = obj.tyres;
    const items: { label: string; value: string }[] = [];
    if (tyr.frontRightTyrePressure !== undefined) items.push({ label: "Front Right Pressure", value: `${tyr.frontRightTyrePressure} psi` });
    if (tyr.frontLeftTyrePressure !== undefined) items.push({ label: "Front Left Pressure", value: `${tyr.frontLeftTyrePressure} psi` });
    if (tyr.rearRightTyrePressure !== undefined) items.push({ label: "Rear Right Pressure", value: `${tyr.rearRightTyrePressure} psi` });
    if (tyr.rearLeftTyrePressure !== undefined) items.push({ label: "Rear Left Pressure", value: `${tyr.rearLeftTyrePressure} psi` });
    if (items.length > 0) {
      sections.push({ title: "TYRES", items });
      totalParams += items.length;
    }
  }

  return {
    format: "F1_JSON",
    game,
    car: carName,
    setupName: fileName.replace(/\.json$/i, ""),
    summary: `Ingested EA Sports F1 setup for ${carName}. Extracted ${totalParams} parameters.`,
    sections,
    rawParameterCount: totalParams,
    confidence: "HIGH",
  };
}

// ----------------------------------------------------------------------------
// UNIVERSAL DETECTOR & ENTRYPOINT
// ----------------------------------------------------------------------------
export function parseSetupFileContent(rawText: string, fileName: string = "setup"): ParsedSetupFile {
  const trimmed = rawText.trim();
  const lowerName = fileName.toLowerCase();

  // 1. Check if JSON
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsedJson = JSON.parse(trimmed);

      // ACC JSON fingerprint
      if (parsedJson.basicSetup || parsedJson.advancedSetup || parsedJson.carName) {
        return parseACCSetupJson(parsedJson, fileName);
      }

      // F1 JSON fingerprint
      if (
        parsedJson.aerodynamics ||
        parsedJson.transmission ||
        parsedJson.suspensionGeometry ||
        (parsedJson.game && /f1/i.test(parsedJson.game))
      ) {
        return parseF1SetupJson(parsedJson, fileName);
      }

      // ApexWall Export JSON (e.g. from SetupVault)
      if (Array.isArray(parsedJson.sections)) {
        return {
          format: "GENERIC_JSON",
          game: parsedJson.game || "Assetto Corsa Competizione",
          car: parsedJson.car || "GT3 Car",
          track: parsedJson.track,
          setupName: parsedJson.name || fileName.replace(/\.json$/i, ""),
          summary: parsedJson.summary || `Loaded setup with ${parsedJson.sections.length} sections.`,
          sections: parsedJson.sections,
          rawParameterCount: parsedJson.sections.reduce((acc: number, s: any) => acc + (s.items?.length || 0), 0),
          confidence: "HIGH",
        };
      }
    } catch {
      // Fall through to text/ini parsers
    }
  }

  // 2. Check if .svm file (rFactor 2, LMU, AMS2)
  if (
    lowerName.endsWith(".svm") ||
    trimmed.includes("[[gFID]]") ||
    (trimmed.includes("[FRONTLEFT]") && trimmed.includes("[GENERAL]"))
  ) {
    return parseSVMSetup(trimmed, fileName);
  }

  // 3. Check if .ini file (Assetto Corsa, AC Evo)
  if (
    lowerName.endsWith(".ini") ||
    trimmed.includes("[PRESSURE_LF]") ||
    trimmed.includes("[CAMBER_LF]") ||
    (trimmed.includes("[CAR]") && trimmed.includes("[TYRES]")) ||
    trimmed.includes("[SUSPENSION]")
  ) {
    return parseAssettoCorsaINI(trimmed, fileName);
  }

  // 4. Fallback text parser (Key-Value pairs separated by colons or equals)
  const lines = trimmed.split(/\r?\n/);
  const fallbackItems: { label: string; value: string }[] = [];
  for (const line of lines) {
    const match = line.match(/^([^:=]+)[:=]\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key && val && !key.startsWith("#") && !key.startsWith("//")) {
        fallbackItems.push({ label: key, value: val });
      }
    }
  }

  if (fallbackItems.length >= 3) {
    return {
      format: "UNKNOWN",
      game: "Assetto Corsa Competizione",
      car: "Custom Vehicle",
      setupName: fileName.replace(/\.[a-z0-9]+$/i, ""),
      summary: `Parsed ${fallbackItems.length} parameters from plain text setup sheet.`,
      sections: [{ title: "IMPORTED SETUP", items: fallbackItems }],
      rawParameterCount: fallbackItems.length,
      confidence: "MEDIUM",
    };
  }

  throw new Error(
    "Unrecognized setup file format. Please upload an ACC (.json), Assetto Corsa (.ini), or rFactor 2 / LMU / AMS2 (.svm) setup file."
  );
}
