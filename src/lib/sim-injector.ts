import {
  SetupExportContext,
  generateACCJson,
  generateAssettoCorsaINI,
  generateACEvoINI,
  generateRFactorSVM,
  generateIRacingText,
  generateF1SetupJson,
  generateAMS2SVM,
  generateBeamNGPC,
  generateRaceRoomXML,
  generateForzaGTText,
  generateWindowsInstallBat,
  downloadFile,
  resolveACCarId,
} from "./setup-exporter";


export interface SupportedSimConfig {
  id: "acc" | "assetto-corsa" | "assetto-corsa-evo" | "iracing" | "lmu" | "f1" | "ams2" | "beamng" | "raceroom" | "forza-gt";
  displayName: string;
  shortName: string;
  fileExtension: string;
  mimeType: string;
  defaultWindowsPath: string; // Relative to %USERPROFILE%\
  carFolderStyle: "slug" | "direct" | "none";
  trackFolderStyle: "slug" | "direct";
  generateContent: (ctx: SetupExportContext) => string;
  getRelativeDir: (car: string, track: string) => string[];
  getWindowsDirString: (car: string, track: string) => string;
}

export function sanitizeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export { resolveACCarId };

/**
 * Standard track slug normalization for popular sim racing venues
 */
export function normalizeTrackSlug(trackName: string, simId: string): string {
  const lower = (trackName || "").toLowerCase();

  // Assetto Corsa official & community track folder conventions
  if (simId === "assetto-corsa") {
    if (lower.includes("spa")) return "spa";
    if (lower.includes("monza")) return "monza";
    if (lower.includes("silverstone")) return "ks_silverstone";
    if (lower.includes("nordschleife") || lower.includes("tourist")) return "ks_nordschleife";
    if (lower.includes("nurburg")) return "ks_nurburgring";
    if (lower.includes("barcelona") || lower.includes("catalunya")) return "ks_barcelona";
    if (lower.includes("brands")) return "ks_brands_hatch";
    if (lower.includes("laguna")) return "ks_laguna_seca";
    if (lower.includes("red bull") || lower.includes("spielberg")) return "ks_red_bull_ring";
    if (lower.includes("vallelunga")) return "ks_vallelunga";
    if (lower.includes("zandvoort")) return "ks_zandvoort";
    if (lower.includes("imola")) return "imola";
    if (lower.includes("mugello")) return "mugello";
    if (lower.includes("magione")) return "magione";
    if (lower.includes("bathurst") || lower.includes("panorama")) return "rt_bathurst";
    if (lower.includes("sepang")) return "acu_sepang";
    if (lower.includes("watkins")) return "lilski_watkins_glen";
    if (lower.includes("lemans") || lower.includes("le mans")) return "fn_lemans";
    if (lower.includes("atlanta")) return "jr_road_atlanta_2022";
    if (lower.includes("jeddah")) return "jeddah_2021_chq";
    return sanitizeSlug(trackName);
  }

  if (lower.includes("spa")) return "spa";
  if (lower.includes("monza")) return "monza";
  if (lower.includes("silverstone")) return "silverstone";
  if (lower.includes("nurburg") || lower.includes("nordschleife")) return simId === "acc" ? "nurburgring" : "nurburgring";
  if (lower.includes("barcelona") || lower.includes("catalunya")) return simId === "acc" ? "barcelona" : "barcelona";
  if (lower.includes("imola")) return "imola";
  if (lower.includes("mugello")) return "mugello";
  if (lower.includes("suzuka")) return simId === "acc" ? "suzuka" : "suzuka";
  if (lower.includes("kyalami")) return "kyalami";
  if (lower.includes("bathurst") || lower.includes("mount panorama")) return "mount_panorama";
  if (lower.includes("zolder")) return "zolder";
  if (lower.includes("misano")) return "misano";
  if (lower.includes("donington")) return "donington";
  if (lower.includes("brands")) return "brands_hatch";
  if (lower.includes("paul ricard")) return "paul_ricard";
  if (lower.includes("zandvoort")) return "zandvoort";
  if (lower.includes("red bull") || lower.includes("spielberg")) return "red_bull_ring";
  if (lower.includes("watkins")) return "watkins_glen";
  if (lower.includes("cota") || lower.includes("americas")) return "cota";
  if (lower.includes("indianapolis") || lower.includes("indy")) return "indianapolis";
  if (lower.includes("daytona")) return "daytona";
  if (lower.includes("sebring")) return "sebring";
  if (lower.includes("interlagos")) return "interlagos";
  if (lower.includes("monaco")) return "monaco";

  return sanitizeSlug(trackName);
}

/**
 * Supported Simulator Configurations with exact folder paths and generators
 */
export const SUPPORTED_SIMS: Record<string, SupportedSimConfig> = {
  acc: {
    id: "acc",
    displayName: "Assetto Corsa Competizione",
    shortName: "ACC",
    fileExtension: ".json",
    mimeType: "application/json",
    defaultWindowsPath: "Documents\\Assetto Corsa Competizione\\Setups",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateACCJson,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "Assetto Corsa Competizione",
      "Setups",
      sanitizeSlug(car),
      normalizeTrackSlug(track, "acc"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\Assetto Corsa Competizione\\Setups\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "acc")}`,
  },

  "assetto-corsa": {
    id: "assetto-corsa",
    displayName: "Assetto Corsa (Original AC)",
    shortName: "AC",
    fileExtension: ".ini",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\Assetto Corsa\\setups",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateAssettoCorsaINI,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "Assetto Corsa",
      "setups",
      resolveACCarId(car),
      normalizeTrackSlug(track, "assetto-corsa"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\Assetto Corsa\\setups\\${resolveACCarId(car)}\\${normalizeTrackSlug(track, "assetto-corsa")}`,
  },

  "assetto-corsa-evo": {
    id: "assetto-corsa-evo",
    displayName: "Assetto Corsa Evo",
    shortName: "AC Evo",
    fileExtension: ".ini",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\Assetto Corsa Evo\\setups",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateACEvoINI,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "Assetto Corsa Evo",
      "setups",
      sanitizeSlug(car),
      normalizeTrackSlug(track, "assetto-corsa-evo"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\Assetto Corsa Evo\\setups\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "assetto-corsa-evo")}`,
  },

  iracing: {
    id: "iracing",
    displayName: "iRacing",
    shortName: "iRacing",
    fileExtension: ".sto.txt",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\iRacing\\setups",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateIRacingText,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "iRacing",
      "setups",
      sanitizeSlug(car),
      normalizeTrackSlug(track, "iracing"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\iRacing\\setups\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "iracing")}`,
  },

  lmu: {
    id: "lmu",
    displayName: "Le Mans Ultimate / rFactor 2",
    shortName: "LMU / rF2",
    fileExtension: ".svm",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\Le Mans Ultimate\\UserData\\player\\Settings",
    carFolderStyle: "none",
    trackFolderStyle: "slug",
    generateContent: generateRFactorSVM,
    getRelativeDir: (_car: string, track: string) => [
      "Documents",
      "Le Mans Ultimate",
      "UserData",
      "player",
      "Settings",
      normalizeTrackSlug(track, "lmu"),
    ],
    getWindowsDirString: (_car: string, track: string) =>
      `Documents\\Le Mans Ultimate\\UserData\\player\\Settings\\${normalizeTrackSlug(track, "lmu")}`,
  },

  f1: {
    id: "f1",
    displayName: "EA Sports F1 (F1 23 / F1 24)",
    shortName: "F1 24",
    fileExtension: ".json",
    mimeType: "application/json",
    defaultWindowsPath: "Documents\\My Games\\F1 24\\setups",
    carFolderStyle: "none",
    trackFolderStyle: "slug",
    generateContent: generateF1SetupJson,
    getRelativeDir: (_car: string, track: string) => [
      "Documents",
      "My Games",
      "F1 24",
      "setups",
      normalizeTrackSlug(track, "f1"),
    ],
    getWindowsDirString: (_car: string, track: string) =>
      `Documents\\My Games\\F1 24\\setups\\${normalizeTrackSlug(track, "f1")}`,
  },

  ams2: {
    id: "ams2",
    displayName: "Automobilista 2 (AMS2)",
    shortName: "AMS2",
    fileExtension: ".svm",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\Automobilista 2\\savegame\\tuning",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateAMS2SVM,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "Automobilista 2",
      "savegame",
      "tuning",
      sanitizeSlug(car),
      normalizeTrackSlug(track, "ams2"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\Automobilista 2\\savegame\\tuning\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "ams2")}`,
  },

  beamng: {
    id: "beamng",
    displayName: "BeamNG.drive",
    shortName: "BeamNG",
    fileExtension: ".pc",
    mimeType: "application/json",
    defaultWindowsPath: "AppData\\Local\\BeamNG.drive\\0.33\\vehicles",
    carFolderStyle: "slug",
    trackFolderStyle: "none" as any,
    generateContent: generateBeamNGPC,
    getRelativeDir: (car: string) => [
      "AppData",
      "Local",
      "BeamNG.drive",
      "0.33",
      "vehicles",
      sanitizeSlug(car),
    ],
    getWindowsDirString: (car: string) =>
      `AppData\\Local\\BeamNG.drive\\0.33\\vehicles\\${sanitizeSlug(car)}`,
  },

  raceroom: {
    id: "raceroom",
    displayName: "RaceRoom Racing Experience",
    shortName: "RaceRoom",
    fileExtension: ".xml",
    mimeType: "application/xml",
    defaultWindowsPath: "Documents\\My Games\\SimBin\\RaceRoom Racing Experience\\UserData\\CarSetups",
    carFolderStyle: "slug",
    trackFolderStyle: "slug",
    generateContent: generateRaceRoomXML,
    getRelativeDir: (car: string, track: string) => [
      "Documents",
      "My Games",
      "SimBin",
      "RaceRoom Racing Experience",
      "UserData",
      "CarSetups",
      sanitizeSlug(car),
      normalizeTrackSlug(track, "raceroom"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\My Games\\SimBin\\RaceRoom Racing Experience\\UserData\\CarSetups\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "raceroom")}`,
  },

  "forza-gt": {
    id: "forza-gt",
    displayName: "Forza Motorsport / Gran Turismo 7",
    shortName: "Forza/GT",
    fileExtension: ".txt",
    mimeType: "text/plain",
    defaultWindowsPath: "Documents\\ApexWall\\TuningSheets",
    carFolderStyle: "none",
    trackFolderStyle: "none" as any,
    generateContent: generateForzaGTText,
    getRelativeDir: () => ["Documents", "ApexWall", "TuningSheets"],
    getWindowsDirString: () => `Documents\\ApexWall\\TuningSheets`,
  },
};

/**
 * Resolve sim configuration from session game string
 */
export function resolveSimConfig(gameStr?: string): SupportedSimConfig {
  const g = (gameStr || "").toLowerCase();
  if (g.includes("competizione") || g === "acc") {
    return SUPPORTED_SIMS.acc;
  }
  if (g.includes("evo") && (g.includes("assetto") || g.includes("ace"))) {
    return SUPPORTED_SIMS["assetto-corsa-evo"];
  }
  if (g.includes("f1") || g.includes("formula 1")) {
    return SUPPORTED_SIMS.f1;
  }
  if (g.includes("iracing")) {
    return SUPPORTED_SIMS.iracing;
  }
  if (g.includes("lmu") || g.includes("mans") || g.includes("rfactor")) {
    return SUPPORTED_SIMS.lmu;
  }
  if (g.includes("automobilista") || g.includes("ams2")) {
    return SUPPORTED_SIMS.ams2;
  }
  if (g.includes("beamng")) {
    return SUPPORTED_SIMS.beamng;
  }
  if (g.includes("raceroom") || g.includes("simbin")) {
    return SUPPORTED_SIMS.raceroom;
  }
  if (g.includes("forza") || g.includes("gran turismo") || g.includes("gt7")) {
    return SUPPORTED_SIMS["forza-gt"];
  }
  return SUPPORTED_SIMS["assetto-corsa"];
}

/**
 * 1. Check if the local ApexWall Telemetry Bridge (node scripts/telemetry-bridge.js) is online
 */
export async function checkLocalBridgeHealth(): Promise<{ online: boolean; game?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch("http://localhost:9001/api/health", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return { online: true, game: data.game };
    }
  } catch (_e) {
    // Offline or unreachable
  }
  return { online: false };
}

/**
 * Query local PC / server API for installed sim cars and active Documents setups root
 */
export async function fetchLocalSimCars(simId: string, carQuery?: string): Promise<{
  success: boolean;
  setupsRoot?: string;
  documentsPath?: string;
  carCount?: number;
  matchedCar?: string | null;
  matchMethod?: string | null;
  cars?: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/sim-cars?sim=${encodeURIComponent(simId)}&car=${encodeURIComponent(carQuery || "")}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_e) {}

  // Fallback to local telemetry bridge if running
  try {
    const bridgeRes = await fetch("http://localhost:9001/api/ac-cars");
    if (bridgeRes.ok) {
      const data = await bridgeRes.json();
      return {
        success: true,
        setupsRoot: data.setupsRoot,
        carCount: data.count,
        cars: data.cars,
      };
    }
  } catch (_e) {}

  return { success: false };
}

/**
 * Method A1: Inject directly via local Next.js API route (Fastest, direct local PC disk access)
 */
export async function injectViaLocalApi(params: {
  simId: string;
  car: string;
  track: string;
  filename: string;
  content: string;
  customCarFolder?: string;
}): Promise<{
  success: boolean;
  message: string;
  savedPath?: string;
  genericPath?: string;
  carFolder?: string;
  setupsRoot?: string;
}> {
  try {
    const res = await fetch("/api/inject-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sim: params.simId,
        car: params.car,
        track: params.track,
        filename: params.filename,
        content: params.content,
        customCarFolder: params.customCarFolder,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.genericPath
          ? `Injected into track folder & generic library!`
          : `Setup injected directly into simulator!`,
        savedPath: data.savedPath,
        genericPath: data.genericPath,
        carFolder: data.carFolder,
        setupsRoot: data.setupsRoot,
      };
    }
    return {
      success: false,
      message: data.error || "Local injection API failed.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to reach local injection API.",
    };
  }
}

/**
 * 2. Method A2: Inject directly via the Local Telemetry Bridge daemon
 */
export async function injectViaLocalBridge(params: {
  simId: string;
  car: string;
  track: string;
  filename: string;
  content: string;
  customCarFolder?: string;
}): Promise<{ success: boolean; message: string; savedPath?: string; genericPath?: string; carFolder?: string }> {
  try {
    const resolvedCar = params.simId === "assetto-corsa" ? resolveACCarId(params.car) : sanitizeSlug(params.car);
    const resolvedTrack = normalizeTrackSlug(params.track, params.simId);

    const res = await fetch("http://localhost:9001/api/inject-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sim: params.simId,
        car: resolvedCar,
        track: resolvedTrack,
        filename: params.filename,
        content: params.content,
        customCarFolder: params.customCarFolder,
        alsoGeneric: params.simId === "assetto-corsa",
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.genericPath
          ? `Injected into track folder & generic library!`
          : `Setup injected directly into simulator!`,
        savedPath: data.savedPath,
        genericPath: data.genericPath,
      };
    }
    return {
      success: false,
      message: data.error || "Bridge failed to write setup.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to communicate with local bridge.",
    };
  }
}

// Global cached directory handle for the current browser session
let cachedDirectoryHandle: any = null;

/**
 * 3. Method B: Inject via Browser Web File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof (window as any).showDirectoryPicker === "function";
}

export async function injectViaFileSystemAccess(params: {
  sim: SupportedSimConfig;
  car: string;
  track: string;
  filename: string;
  content: string;
  forceFolderPick?: boolean;
}): Promise<{ success: boolean; message: string; path?: string }> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      message: "Browser does not support the Web File System Access API.",
    };
  }

  try {
    let rootHandle = cachedDirectoryHandle;

    if (!rootHandle || params.forceFolderPick) {
      // Prompt user to pick their Documents or Sim root folder
      rootHandle = await (window as any).showDirectoryPicker({
        id: "apexwall_sim_setups",
        mode: "readwrite",
        startIn: "documents",
      });
      cachedDirectoryHandle = rootHandle;
    }

    // Traverse relative directory segments
    // E.g. ["Documents", "Assetto Corsa", "setups", "rss_formula_hybrid_2021", "ks_silverstone"]
    const rawSegments = params.sim.getRelativeDir(params.car, params.track);
    let targetSegments = rawSegments;

    const rootLower = rootHandle.name.toLowerCase().trim();
    // Check if root handle matches any segment in rawSegments (e.g. "Documents", "Assetto Corsa", "setups")
    const matchIdx = rawSegments.findIndex((seg) => {
      const segLower = seg.toLowerCase().trim();
      return (
        rootLower === segLower ||
        rootLower.includes(segLower) ||
        segLower.includes(rootLower) ||
        (rootLower === "ac" && segLower === "assetto corsa")
      );
    });

    if (matchIdx !== -1) {
      targetSegments = rawSegments.slice(matchIdx + 1);
    }

    let currentHandle = rootHandle;
    for (const segment of targetSegments) {
      currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
    }

    // Create file and write content
    const fileHandle = await currentHandle.getFileHandle(params.filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(params.content);
    await writable.close();

    const fullPathDisplay = targetSegments.join("/") + "/" + params.filename;

    // For Assetto Corsa, also write to the car's "generic" folder so setup appears across all tracks/layouts
    if (params.sim.id === "assetto-corsa" && targetSegments.length >= 2) {
      try {
        const carSegments = targetSegments.slice(0, targetSegments.length - 1);
        let carHandle = rootHandle;
        for (const seg of carSegments) {
          carHandle = await carHandle.getDirectoryHandle(seg, { create: true });
        }
        const genericHandle = await carHandle.getDirectoryHandle("generic", { create: true });
        const genFileHandle = await genericHandle.getFileHandle(params.filename, { create: true });
        const genWritable = await genFileHandle.createWritable();
        await genWritable.write(params.content);
        await genWritable.close();
      } catch (genErr) {
        console.warn("Could not copy to AC generic folder:", genErr);
      }
    }

    return {
      success: true,
      message:
        params.sim.id === "assetto-corsa"
          ? `Setup written to track folder (${targetSegments[targetSegments.length - 1]}) & generic library!`
          : `Setup written to ${fullPathDisplay}`,
      path: fullPathDisplay,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, message: "Folder selection cancelled by user." };
    }
    return {
      success: false,
      message: err.message || "Failed to write setup file via File System API.",
    };
  }
}

/**
 * 4. Method C: 1-Click Windows Auto-Installer Bundle (.bat + setup file)
 */
export function downloadBatchAutoInstaller(params: {
  sim: SupportedSimConfig;
  car: string;
  track: string;
  setupName: string;
  content: string;
}): void {
  const cleanName = sanitizeSlug(params.setupName) || "ApexWall_Setup";
  const setupFilename = `${cleanName}${params.sim.fileExtension}`;
  const winDir = params.sim.getWindowsDirString(params.car, params.track);

  const secondaryDir =
    params.sim.id === "assetto-corsa"
      ? `Documents\\Assetto Corsa\\setups\\${resolveACCarId(params.car)}\\generic`
      : undefined;

  // 1. Download setup file
  downloadFile(params.content, setupFilename, params.sim.mimeType);

  // 2. Generate and download corresponding batch auto-mover
  const batScript = generateWindowsInstallBat(winDir, setupFilename, params.setupName, secondaryDir);
  setTimeout(() => {
    downloadFile(batScript, `Install_${cleanName}.bat`, "application/x-bat");
  }, 400);
}
