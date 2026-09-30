/**
 * ============================================================================
 * APEXWALL AI // ASSETTO CORSA LOCAL CAR & SETUP DETECTOR
 * ============================================================================
 * Inspects installed Assetto Corsa car folders and Document setup files (.ini)
 * directly from the user's PC without requiring ZIP archives.
 * ============================================================================
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { resolveACSetupsRoot, matchACCarFolder } from "./sim-path-resolver";
import { ACModSlider, AssettoCorsaModData } from "./ac-mod-parser";

/**
 * Categorizes an AC slider key into an intuitive garage tab
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
 * Safely parses simple INI files (handles comments, whitespace)
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
 * Resolves the root Assetto Corsa game installation path.
 * Checks Windows Registry for SteamPath, Steam libraryfolders.vdf, and standard drives.
 */
export function resolveACInstallRoot(): string | null {
  const candidates: string[] = [];

  // 1. Query Windows Registry for Steam
  if (process.platform === "win32") {
    try {
      const regCmd = 'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath';
      const regOutput = execSync(regCmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const match = regOutput.match(/SteamPath\s+REG_\w+\s+(.*)/i);
      if (match && match[1]) {
        const steamRoot = match[1].trim();
        candidates.push(path.join(steamRoot, "steamapps", "common", "assettocorsa"));

        // Parse libraryfolders.vdf for external libraries
        const vdfPath = path.join(steamRoot, "steamapps", "libraryfolders.vdf");
        if (fs.existsSync(vdfPath)) {
          const vdfContent = fs.readFileSync(vdfPath, "utf8");
          const pathRegex = /"path"\s+"([^"]+)"/g;
          let m: RegExpExecArray | null;
          while ((m = pathRegex.exec(vdfContent)) !== null) {
            const libPath = m[1].replace(/\\\\/g, "\\");
            candidates.push(path.join(libPath, "steamapps", "common", "assettocorsa"));
          }
        }
      }
    } catch (_err) {}
  }

  // 2. Standard common locations
  const drives = ["C", "D", "E", "F", "G"];
  for (const d of drives) {
    candidates.push(`${d}:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa`);
    candidates.push(`${d}:\\Program Files\\Steam\\steamapps\\common\\assettocorsa`);
    candidates.push(`${d}:\\SteamLibrary\\steamapps\\common\\assettocorsa`);
    candidates.push(`${d}:\\Steam\\steamapps\\common\\assettocorsa`);
  }

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      const carsDir = path.join(c, "content", "cars");
      if (fs.existsSync(carsDir)) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Searches the user's computer for active car setup files (.ini) and content files (ui_car.json, setup.ini).
 * Returns complete AssettoCorsaModData containing authentic sliders, defaults, and car specs.
 */
export function getCarSetupDataFromSystem(
  carQuery: string,
  trackQuery?: string
): AssettoCorsaModData | null {
  const rootInfo = resolveACSetupsRoot();
  if (!rootInfo.setupsRoot) return null;

  const match = matchACCarFolder(rootInfo.setupsRoot, carQuery);
  const matchedCarId = match.folder;
  if (!matchedCarId) return null;

  const carSetupFolder = path.join(rootInfo.setupsRoot, matchedCarId);
  const acInstall = resolveACInstallRoot();
  const carInstallFolder = acInstall ? path.join(acInstall, "content", "cars", matchedCarId) : null;

  let carName = matchedCarId.replace(/_/g, " ");
  let brand = "Assetto Corsa";
  let author = "";
  let weightKg: number | undefined;
  let steerRatio: number | undefined;
  let fuelTankCapacity: number | undefined;
  const sliders: ACModSlider[] = [];
  const unpackedFilesFound: string[] = [];

  // 1. Check game content folder for ui_car.json
  if (carInstallFolder && fs.existsSync(carInstallFolder)) {
    const uiPath = path.join(carInstallFolder, "ui", "ui_car.json");
    if (fs.existsSync(uiPath)) {
      unpackedFilesFound.push(uiPath);
      try {
        let rawJson = fs.readFileSync(uiPath, "utf8");
        // Sanitize control characters / unescaped newlines in JSON strings
        rawJson = rawJson.replace(/[\x00-\x1F\x7F]/g, (char) => (char === "\r" || char === "\n" ? " " : ""));
        const parsed = JSON.parse(rawJson);
        if (parsed.name) carName = String(parsed.name).trim();
        if (parsed.brand) brand = String(parsed.brand).trim();
        if (parsed.author) author = String(parsed.author).trim();
        if (parsed.specs?.weight) {
          const m = String(parsed.specs.weight).match(/(\d+)/);
          if (m) weightKg = parseInt(m[1], 10);
        }
      } catch (_e) {}
    }

    // Check if data/setup.ini is unpacked in the car folder
    const setupIniPath = path.join(carInstallFolder, "data", "setup.ini");
    if (fs.existsSync(setupIniPath)) {
      unpackedFilesFound.push(setupIniPath);
      try {
        const text = fs.readFileSync(setupIniPath, "utf8");
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
      } catch (_e) {}
    }
  }

  // 2. Check Document Setups for active / default .ini files
  if (fs.existsSync(carSetupFolder)) {
    const candidateIniPaths: string[] = [];

    // Track specific first
    if (trackQuery) {
      const cleanTrack = trackQuery.toLowerCase().replace(/[^a-z0-9]+/g, "");
      try {
        const subdirs = fs.readdirSync(carSetupFolder);
        for (const sub of subdirs) {
          if (sub.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(cleanTrack) || cleanTrack.includes(sub.toLowerCase())) {
            const trackDir = path.join(carSetupFolder, sub);
            if (fs.statSync(trackDir).isDirectory()) {
              candidateIniPaths.push(path.join(trackDir, "default.ini"));
              candidateIniPaths.push(path.join(trackDir, "last.ini"));
              // Any other .ini in track folder
              fs.readdirSync(trackDir).forEach(f => {
                if (f.endsWith(".ini")) candidateIniPaths.push(path.join(trackDir, f));
              });
            }
          }
        }
      } catch (_e) {}
    }

    // Generic fallbacks
    candidateIniPaths.push(path.join(carSetupFolder, "generic", "last.ini"));
    candidateIniPaths.push(path.join(carSetupFolder, "generic", "default.ini"));
    candidateIniPaths.push(path.join(carSetupFolder, "last.ini"));

    for (const iniPath of candidateIniPaths) {
      if (fs.existsSync(iniPath)) {
        unpackedFilesFound.push(iniPath);
        try {
          const content = fs.readFileSync(iniPath, "utf8");
          const ini = parseSimpleINI(content);

          // If setup.ini was not available to define sliders, extract sliders from this setup .ini!
          if (sliders.length === 0) {
            for (const [secName, fields] of Object.entries(ini)) {
              if (secName === "CAR" || secName === "ABOUT" || secName === "__EXT_PATCH") continue;
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
          } else {
            // Update default values from this setup file
            for (const s of sliders) {
              if (ini[s.key] && ini[s.key]["VALUE"] !== undefined) {
                const val = parseFloat(ini[s.key]["VALUE"]);
                if (!isNaN(val)) s.defaultValue = val;
              }
            }
          }
          break; // Found active setup file
        } catch (_e) {}
      }
    }
  }

  if (sliders.length === 0 && !weightKg && unpackedFilesFound.length === 0) {
    return null;
  }

  return {
    carId: matchedCarId,
    name: carName,
    brand,
    author,
    weightKg,
    steerRatio,
    fuelTankCapacity,
    sliders,
    hasAcdOnly: sliders.length > 0 && !unpackedFilesFound.some(p => p.includes("setup.ini")),
    unpackedFilesFound,
  };
}
