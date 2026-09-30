import JSZip from "jszip";

export interface ACModSlider {
  key: string;        // e.g., "CAMBER_LF", "ARB_FRONT"
  name: string;       // e.g., "Camber LF"
  category: string;   // e.g., "Alignment", "Suspension", "Drivetrain", "Aero", "Tyres"
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  help?: string;
}

export interface AssettoCorsaModData {
  carId: string;
  name: string;
  brand?: string;
  author?: string;
  weightKg?: number;
  frontWeightRatio?: number; // e.g., 0.48 (48% front)
  steerRatio?: number;
  fuelTankCapacity?: number;
  sliders: ACModSlider[];
  idealTyrePressures?: {
    front?: number;
    rear?: number;
  };
  hasAcdOnly?: boolean;
  unpackedFilesFound: string[];
}

/**
 * Categorizes Assetto Corsa setup.ini sections into intuitive garage tabs
 */
function categorizeSection(sectionName: string, name: string): string {
  const s = (sectionName + " " + name).toUpperCase();
  if (s.includes("CAMBER") || s.includes("TOE") || s.includes("CASTER") || s.includes("ALIGNMENT")) {
    return "Alignment";
  }
  if (s.includes("PRESSURE") || s.includes("TYRE") || s.includes("TIRE")) {
    return "Tyres";
  }
  if (s.includes("ARB") || s.includes("ANTI-ROLL") || s.includes("ROLL_BAR")) {
    return "Suspension / ARB";
  }
  if (s.includes("SPRING") || s.includes("ROD") || s.includes("PACKER") || s.includes("HEIGHT") || s.includes("BUMP")) {
    return "Suspension / Springs";
  }
  if (s.includes("DAMP") || s.includes("REBOUND") || s.includes("FAST_BUMP") || s.includes("SLOW_BUMP")) {
    return "Dampers";
  }
  if (s.includes("DIFF") || s.includes("POWER") || s.includes("COAST") || s.includes("GEAR") || s.includes("FINAL")) {
    return "Drivetrain & Diff";
  }
  if (s.includes("WING") || s.includes("SPLITTER") || s.includes("AERO") || s.includes("DUCT")) {
    return "Aerodynamics";
  }
  if (s.includes("BRAKE") || s.includes("BIAS")) {
    return "Brakes";
  }
  if (s.includes("TC") || s.includes("ABS") || s.includes("ENGINE_MAP") || s.includes("ELECTRONIC")) {
    return "Electronics";
  }
  return "General";
}

/**
 * Minimal INI parser that handles Assetto Corsa's Section/Key-Value structures
 */
function parseSimpleINI(iniText: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = "DEFAULT";

  const lines = iniText.split(/\r?\n/);
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
      const val = line.slice(eqIdx + 1).trim();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      result[currentSection][key] = val;
    }
  }

  return result;
}

/**
 * Selectively inspects an Assetto Corsa car mod ZIP archive client-side.
 * Decompresses ONLY ui_car.json and physics INI files (< 200KB total),
 * completely bypassing hundreds of megabytes of 3D kn5 meshes, skins, and audio.
 */
export async function parseAssettoCorsaModZip(file: File): Promise<AssettoCorsaModData> {
  const zip = await JSZip.loadAsync(file);

  const unpackedFilesFound: string[] = [];
  let carId = file.name.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  let carName = carId.replace(/_/g, " ");
  let brand = "Custom Mod";
  let author = "";
  let weightKg: number | undefined;
  let frontWeightRatio: number | undefined;
  let steerRatio: number | undefined;
  let fuelTankCapacity: number | undefined;
  let idealTyres: { front?: number; rear?: number } = {};
  const sliders: ACModSlider[] = [];

  // 1. Locate and parse ui_car.json (or */ui/ui_car.json)
  const uiCarEntry = Object.keys(zip.files).find((p) =>
    /(^|\/)ui\/ui_car\.json$/i.test(p) || /ui_car\.json$/i.test(p)
  );

  if (uiCarEntry) {
    unpackedFilesFound.push(uiCarEntry);
    try {
      const uiCarText = await zip.files[uiCarEntry].async("text");
      const parsedUI = JSON.parse(uiCarText);
      if (parsedUI.name) carName = String(parsedUI.name).trim();
      if (parsedUI.brand) brand = String(parsedUI.brand).trim();
      if (parsedUI.author) author = String(parsedUI.author).trim();
      if (parsedUI.specs?.weight) {
        const match = String(parsedUI.specs.weight).match(/(\d+)/);
        if (match) weightKg = parseInt(match[1], 10);
      }
    } catch (err) {
      console.warn("Could not parse ui_car.json:", err);
    }
  }

  // Deduce carId from path if inside content/cars/<carId>/
  const carFolderMatch = Object.keys(zip.files).find((p) => /content\/cars\/([^/]+)/i.test(p));
  if (carFolderMatch) {
    const m = carFolderMatch.match(/content\/cars\/([^/]+)/i);
    if (m && m[1]) carId = m[1];
  }

  // 2. Locate and parse car.ini
  const carIniEntry = Object.keys(zip.files).find((p) =>
    /(^|\/)data\/car\.ini$/i.test(p) || /car\.ini$/i.test(p)
  );
  if (carIniEntry) {
    unpackedFilesFound.push(carIniEntry);
    try {
      const text = await zip.files[carIniEntry].async("text");
      const ini = parseSimpleINI(text);
      if (ini["BASIC"]) {
        if (ini["BASIC"]["TOTALMASS"]) weightKg = parseFloat(ini["BASIC"]["TOTALMASS"]);
      }
      if (ini["CONTROLS"] && ini["CONTROLS"]["STEER_RATIO"]) {
        steerRatio = parseFloat(ini["CONTROLS"]["STEER_RATIO"]);
      }
      if (ini["FUEL"] && ini["FUEL"]["FUEL"]) {
        fuelTankCapacity = parseFloat(ini["FUEL"]["FUEL"]);
      }
    } catch (e) {
      console.warn("Failed to parse car.ini", e);
    }
  }

  // 3. Locate and parse suspensions.ini
  const suspIniEntry = Object.keys(zip.files).find((p) =>
    /(^|\/)data\/suspensions\.ini$/i.test(p) || /suspensions\.ini$/i.test(p)
  );
  if (suspIniEntry) {
    unpackedFilesFound.push(suspIniEntry);
    try {
      const text = await zip.files[suspIniEntry].async("text");
      const ini = parseSimpleINI(text);
      if (ini["BASIC"] && ini["BASIC"]["WEIGHTRATIO"]) {
        frontWeightRatio = parseFloat(ini["BASIC"]["WEIGHTRATIO"]);
      }
    } catch (e) {
      console.warn("Failed to parse suspensions.ini", e);
    }
  }

  // 4. Locate and parse tyres.ini
  const tyresIniEntry = Object.keys(zip.files).find((p) =>
    /(^|\/)data\/tyres\.ini$/i.test(p) || /tyres\.ini$/i.test(p)
  );
  if (tyresIniEntry) {
    unpackedFilesFound.push(tyresIniEntry);
    try {
      const text = await zip.files[tyresIniEntry].async("text");
      const ini = parseSimpleINI(text);
      // Look for FRONT / REAR PRESSURE_IDEAL
      const fPres = ini["FRONT"]?.["PRESSURE_IDEAL"] || ini["THERMAL_FRONT"]?.["PRESSURE_IDEAL"];
      const rPres = ini["REAR"]?.["PRESSURE_IDEAL"] || ini["THERMAL_REAR"]?.["PRESSURE_IDEAL"];
      if (fPres) idealTyres.front = parseFloat(fPres);
      if (rPres) idealTyres.rear = parseFloat(rPres);
    } catch (e) {
      console.warn("Failed to parse tyres.ini", e);
    }
  }

  // 5. The Core Target: setup.ini (The Garage Sliders)
  const setupIniEntry = Object.keys(zip.files).find((p) =>
    /(^|\/)data\/setup\.ini$/i.test(p) || /setup\.ini$/i.test(p)
  );

  let hasAcdOnly = false;
  if (setupIniEntry) {
    unpackedFilesFound.push(setupIniEntry);
    try {
      const text = await zip.files[setupIniEntry].async("text");
      const ini = parseSimpleINI(text);

      for (const [secName, fields] of Object.entries(ini)) {
        if (secName === "DEFAULT" || secName === "HEADER") continue;

        const name = fields["NAME"] || secName.replace(/_/g, " ");
        const min = fields["MIN"] !== undefined ? parseFloat(fields["MIN"]) : NaN;
        const max = fields["MAX"] !== undefined ? parseFloat(fields["MAX"]) : NaN;
        const step = fields["STEP"] !== undefined ? parseFloat(fields["STEP"]) : 1;
        const pos = fields["POS"] !== undefined ? parseFloat(fields["POS"]) : undefined;
        const help = fields["HELP"];

        if (!isNaN(min) && !isNaN(max)) {
          sliders.push({
            key: secName,
            name,
            category: categorizeSection(secName, name),
            min,
            max,
            step: step || 1,
            defaultValue: pos,
            help: help || undefined,
          });
        }
      }
    } catch (e) {
      console.warn("Failed to parse setup.ini", e);
    }
  } else {
    // Check if there is a data.acd file
    const acdEntry = Object.keys(zip.files).find((p) => /data\.acd$/i.test(p));
    if (acdEntry) {
      hasAcdOnly = true;
      unpackedFilesFound.push(acdEntry);
    }
  }

  return {
    carId,
    name: carName,
    brand,
    author,
    weightKg,
    frontWeightRatio,
    steerRatio,
    fuelTankCapacity,
    sliders,
    idealTyrePressures: Object.keys(idealTyres).length > 0 ? idealTyres : undefined,
    hasAcdOnly,
    unpackedFilesFound,
  };
}

/**
 * Parses raw Assetto Corsa .ini files (such as setup.ini, last.ini, or custom .ini setups)
 * directly without needing a ZIP archive.
 */
export function parseACSetupINI(iniText: string, fileName: string = "setup.ini"): AssettoCorsaModData {
  const ini = parseSimpleINI(iniText);
  const sliders: ACModSlider[] = [];

  let carId = "";
  let carName = fileName.replace(/\.ini$/i, "");
  let brand = "Assetto Corsa";
  let author = "";

  if (ini["CAR"]?.["MODEL"]) {
    carId = ini["CAR"]["MODEL"];
    carName = carId.replace(/_/g, " ");
  }
  if (ini["ABOUT"]?.["AUTHOR"]) {
    author = ini["ABOUT"]["AUTHOR"];
  }

  const isSetupDefinition = Object.values(ini).some(fields => fields["MIN"] !== undefined && fields["MAX"] !== undefined);

  if (isSetupDefinition) {
    // This is a data/setup.ini file with formal MIN/MAX bounds
    for (const [secName, fields] of Object.entries(ini)) {
      if (secName === "DEFAULT" || secName === "HEADER" || secName === "CAR" || secName === "ABOUT") continue;
      const name = fields["NAME"] || secName.replace(/_/g, " ");
      const min = fields["MIN"] !== undefined ? parseFloat(fields["MIN"]) : NaN;
      const max = fields["MAX"] !== undefined ? parseFloat(fields["MAX"]) : NaN;
      const step = fields["STEP"] !== undefined ? parseFloat(fields["STEP"]) : 1;
      const pos = fields["POS"] !== undefined ? parseFloat(fields["POS"]) : undefined;
      const help = fields["HELP"];

      if (!isNaN(min) && !isNaN(max)) {
        sliders.push({
          key: secName,
          name,
          category: categorizeSection(secName, name),
          min,
          max,
          step: step || 1,
          defaultValue: pos,
          help: help || undefined,
        });
      }
    }
  } else {
    // This is an active setup .ini (like last.ini or saved setup) with VALUE= entries
    for (const [secName, fields] of Object.entries(ini)) {
      if (secName === "DEFAULT" || secName === "HEADER" || secName === "CAR" || secName === "ABOUT" || secName === "__EXT_PATCH") continue;
      const valStr = fields["VALUE"];
      if (valStr !== undefined) {
        const numVal = parseFloat(valStr);
        const isNumeric = !isNaN(numVal);
        sliders.push({
          key: secName,
          name: secName.replace(/_/g, " "),
          category: categorizeSection(secName, secName),
          min: isNumeric ? (numVal < 0 ? numVal * 1.5 : 0) : 0,
          max: isNumeric ? (numVal > 0 ? Math.max(numVal * 1.5, 10) : 0) : 100,
          step: 1,
          defaultValue: isNumeric ? numVal : undefined,
        });
      }
    }
  }

  return {
    carId: carId || fileName.replace(/\.ini$/i, ""),
    name: carName,
    brand,
    author,
    sliders,
    unpackedFilesFound: [fileName],
  };
}
