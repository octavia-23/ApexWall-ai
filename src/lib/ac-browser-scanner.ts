/**
 * ============================================================================
 * APEXWALL AI // BROWSER-SIDE ASSETTO CORSA FOLDER & SETUP SCANNER
 * ============================================================================
 * Enables the web dashboard (even when deployed remotely on Vercel) to scan
 * installed Assetto Corsa cars and parse active setup files directly inside
 * the user's browser using:
 * 1. Web File System Access API (window.showDirectoryPicker)
 * 2. Directory Upload (webkitdirectory)
 * ============================================================================
 */

import { parseACSetupINI, AssettoCorsaModData } from "./ac-mod-parser";

// In-memory cached directory handle for seamless 1-click re-scans in this session
let cachedACDirectoryHandle: any = null;

export function getCachedACDirectoryHandle(): any {
  return cachedACDirectoryHandle;
}

export function setCachedACDirectoryHandle(handle: any): void {
  cachedACDirectoryHandle = handle;
}

/**
 * Fuzzy matches car query against a list of installed car folder names
 */
export function matchCarNameFromList(carList: string[], carQuery: string): string | null {
  if (!carList || carList.length === 0) return null;
  const qLower = (carQuery || "").toLowerCase().trim();
  const qSlug = qLower.replace(/[^a-z0-9]+/g, "");
  const qTokens = qLower
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !["the", "car", "mod", "assetto", "corsa"].includes(t));

  // 1. Exact match
  const exact = carList.find((c) => c.toLowerCase() === qLower);
  if (exact) return exact;

  // 2. Slug match
  const slugMatch = carList.find(
    (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "") === qSlug
  );
  if (slugMatch) return slugMatch;

  // 3. Substring match
  const sub = carList.find(
    (c) =>
      c.toLowerCase().includes(qLower) ||
      (qLower.length > 4 && qLower.includes(c.toLowerCase()))
  );
  if (sub) return sub;

  // 4. Token scoring
  let best = carList[0];
  let highest = -1;
  for (const c of carList) {
    const cLower = c.toLowerCase();
    const cTokens = cLower.split(/[^a-z0-9]+/);
    let score = 0;
    for (const t of qTokens) {
      if (cTokens.includes(t)) {
        if (/^\d{4}$/.test(t)) score += 6;
        else if (
          ["rss", "vrc", "ferrari", "porsche", "bmw", "audi", "amg", "mercedes", "mclaren", "lamborghini"].includes(
            t
          )
        )
          score += 4;
        else score += 2;
      } else if (cLower.includes(t)) {
        score += 1;
      }
    }
    if (score > highest) {
      highest = score;
      best = c;
    }
  }
  return best;
}

/**
 * Searches a car folder handle for active setup .ini files
 */
async function findSetupIniInCarHandle(carHandle: any, targetTrack?: string): Promise<any | null> {
  const candidateFiles: any[] = [];

  // 1. If targetTrack provided, look in track subfolder first
  if (targetTrack) {
    const cleanTrack = targetTrack.toLowerCase().replace(/[^a-z0-9]+/g, "");
    try {
      for await (const [name, entry] of carHandle.entries()) {
        if (entry.kind === "directory" && name.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(cleanTrack)) {
          for await (const [fName, fEntry] of entry.entries()) {
            if (fEntry.kind === "file" && fName.toLowerCase().endsWith(".ini")) {
              if (fName.toLowerCase() === "last.ini" || fName.toLowerCase() === "default.ini") {
                return fEntry;
              }
              candidateFiles.push(fEntry);
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 2. Check "generic" folder
  try {
    const genericHandle = await carHandle.getDirectoryHandle("generic");
    for await (const [fName, fEntry] of genericHandle.entries()) {
      if (fEntry.kind === "file" && fName.toLowerCase().endsWith(".ini")) {
        if (fName.toLowerCase() === "last.ini" || fName.toLowerCase() === "default.ini") {
          return fEntry;
        }
        candidateFiles.push(fEntry);
      }
    }
  } catch (_e) {}

  // 3. Check any track folder in carHandle
  try {
    for await (const [subName, subEntry] of carHandle.entries()) {
      if (subEntry.kind === "directory") {
        for await (const [fName, fEntry] of subEntry.entries()) {
          if (fEntry.kind === "file" && fName.toLowerCase().endsWith(".ini")) {
            candidateFiles.push(fEntry);
          }
        }
      } else if (subEntry.kind === "file" && subName.toLowerCase().endsWith(".ini")) {
        candidateFiles.push(subEntry);
      }
    }
  } catch (_e) {}

  return candidateFiles.length > 0 ? candidateFiles[0] : null;
}

/**
 * Scans an Assetto Corsa folder handle (via File System Access API)
 */
export async function scanACFolderHandle(
  rootHandle: any,
  targetCar?: string,
  targetTrack?: string
): Promise<{
  success: boolean;
  modData?: AssettoCorsaModData;
  matchedCar?: string;
  carsFound?: string[];
  error?: string;
}> {
  try {
    let setupsHandle = rootHandle;

    // Check if the user selected "Assetto Corsa" root instead of "setups"
    if (rootHandle.name.toLowerCase().includes("assetto") && !rootHandle.name.toLowerCase().includes("setups")) {
      try {
        setupsHandle = await rootHandle.getDirectoryHandle("setups");
      } catch (_e) {
        // Continue with current handle
      }
    }

    const childDirs: string[] = [];
    const directIniFiles: any[] = [];

    for await (const [name, entry] of setupsHandle.entries()) {
      if (entry.kind === "directory" && !name.startsWith(".")) {
        childDirs.push(name);
      } else if (entry.kind === "file" && name.toLowerCase().endsWith(".ini")) {
        directIniFiles.push(entry);
      }
    }

    // Case 1: Single car directory directly selected
    if (childDirs.includes("generic") || directIniFiles.length > 0) {
      const carHandle = setupsHandle;
      const iniFile = await findSetupIniInCarHandle(carHandle, targetTrack);
      if (iniFile) {
        const file = await iniFile.getFile();
        const text = await file.text();
        const modData = parseACSetupINI(text, file.name);
        modData.carId = carHandle.name;
        modData.name = carHandle.name.replace(/_/g, " ");
        return { success: true, modData, matchedCar: carHandle.name, carsFound: [carHandle.name] };
      }
    }

    // Case 2: Setups directory containing car subfolders
    if (childDirs.length > 0) {
      const bestCar = matchCarNameFromList(childDirs, targetCar || "ferrari 488 gt3") || childDirs[0];
      const carHandle = await setupsHandle.getDirectoryHandle(bestCar);
      const iniFile = await findSetupIniInCarHandle(carHandle, targetTrack);

      if (iniFile) {
        const file = await iniFile.getFile();
        const text = await file.text();
        const modData = parseACSetupINI(text, file.name);
        modData.carId = bestCar;
        modData.name = bestCar.replace(/_/g, " ");
        return { success: true, modData, matchedCar: bestCar, carsFound: childDirs };
      }

      return {
        success: false,
        carsFound: childDirs,
        matchedCar: bestCar,
        error: `Found car folder "${bestCar}", but no .ini setup files were inside it. Save a setup in Assetto Corsa first.`,
      };
    }

    return {
      success: false,
      error: "No car folders or setup files found in the selected folder.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to scan folder.",
    };
  }
}

/**
 * Scans an array of File objects selected via `<input webkitdirectory />`
 */
export async function scanACFilesList(
  files: FileList | File[],
  targetCar?: string,
  targetTrack?: string
): Promise<{
  success: boolean;
  modData?: AssettoCorsaModData;
  matchedCar?: string;
  carsFound?: string[];
  error?: string;
}> {
  try {
    const fileArray = Array.from(files);
    const iniFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith(".ini"));

    if (iniFiles.length === 0) {
      return {
        success: false,
        error: "No .ini setup files were found in the selected folder.",
      };
    }

    // Map files by car folder from webkitRelativePath
    // E.g. "Assetto Corsa/setups/ks_ferrari_488_gt3/generic/last.ini"
    const carsMap = new Map<string, File[]>();
    for (const f of iniFiles) {
      const relPath = (f as any).webkitRelativePath || f.name;
      const parts = relPath.split(/[/\\]/);
      let carFolder = "default";

      const setupsIdx = parts.findIndex((p: string) => p.toLowerCase() === "setups");
      if (setupsIdx !== -1 && parts[setupsIdx + 1]) {
        carFolder = parts[setupsIdx + 1];
      } else if (parts.length >= 3) {
        carFolder = parts[parts.length - 3];
      } else if (parts.length >= 2) {
        carFolder = parts[0];
      }

      if (!carsMap.has(carFolder)) {
        carsMap.set(carFolder, []);
      }
      carsMap.get(carFolder)!.push(f);
    }

    const carList = Array.from(carsMap.keys());
    const bestCar = matchCarNameFromList(carList, targetCar || "ferrari 488 gt3") || carList[0];
    const candidateFiles = carsMap.get(bestCar) || iniFiles;

    // Pick best file: track specific -> generic/last.ini -> last.ini -> any
    let chosenFile = candidateFiles[0];
    if (targetTrack) {
      const cleanTrack = targetTrack.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const trackMatch = candidateFiles.find((f) =>
        ((f as any).webkitRelativePath || f.name).toLowerCase().replace(/[^a-z0-9]+/g, "").includes(cleanTrack)
      );
      if (trackMatch) chosenFile = trackMatch;
    }

    const lastIni = candidateFiles.find((f) => f.name.toLowerCase() === "last.ini");
    if (!chosenFile && lastIni) chosenFile = lastIni;

    const text = await chosenFile.text();
    const modData = parseACSetupINI(text, chosenFile.name);
    modData.carId = bestCar;
    modData.name = bestCar.replace(/_/g, " ");

    return {
      success: true,
      modData,
      matchedCar: bestCar,
      carsFound: carList,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to parse files.",
    };
  }
}
