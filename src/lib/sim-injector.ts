import {
  SetupExportContext,
  generateACCJson,
  generateAssettoCorsaINI,
  generateRFactorSVM,
  generateIRacingText,
  generateF1SetupJson,
  generateWindowsInstallBat,
  downloadFile,
} from "./setup-exporter";

export interface SupportedSimConfig {
  id: "acc" | "assetto-corsa" | "iracing" | "lmu" | "f1";
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

/**
 * Standard track slug normalization for popular sim racing venues
 */
export function normalizeTrackSlug(trackName: string, simId: string): string {
  const lower = (trackName || "").toLowerCase();

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
      sanitizeSlug(car),
      normalizeTrackSlug(track, "assetto-corsa"),
    ],
    getWindowsDirString: (car: string, track: string) =>
      `Documents\\Assetto Corsa\\setups\\${sanitizeSlug(car)}\\${normalizeTrackSlug(track, "assetto-corsa")}`,
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
};

/**
 * Resolve sim configuration from session game string
 */
export function resolveSimConfig(gameStr?: string): SupportedSimConfig {
  const g = (gameStr || "").toLowerCase();
  if (g.includes("competizione") || g === "acc") {
    return SUPPORTED_SIMS.acc;
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
 * 2. Method A: Inject directly via the Local Telemetry Bridge daemon (Fastest, zero dialogs)
 */
export async function injectViaLocalBridge(params: {
  simId: string;
  car: string;
  track: string;
  filename: string;
  content: string;
}): Promise<{ success: boolean; message: string; savedPath?: string }> {
  try {
    const res = await fetch("http://localhost:9001/api/inject-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sim: params.simId,
        car: sanitizeSlug(params.car),
        track: normalizeTrackSlug(params.track, params.simId),
        filename: params.filename,
        content: params.content,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: `Setup injected directly into simulator!`,
        savedPath: data.savedPath,
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
    // E.g. ["Documents", "Assetto Corsa Competizione", "Setups", "ferrari_296_gt3", "spa"]
    // If user selected their Documents folder directly, skip "Documents" prefix
    const rawSegments = params.sim.getRelativeDir(params.car, params.track);
    let targetSegments = rawSegments;

    // Check if root handle name is already "Documents" or the sim name
    if (rootHandle.name.toLowerCase() === "documents") {
      targetSegments = rawSegments.slice(1);
    } else if (rootHandle.name.toLowerCase().includes(params.sim.shortName.toLowerCase())) {
      // User selected the sim folder directly (e.g. "Assetto Corsa Competizione")
      const simIdx = rawSegments.findIndex((s) =>
        s.toLowerCase().includes(params.sim.shortName.toLowerCase())
      );
      if (simIdx !== -1) {
        targetSegments = rawSegments.slice(simIdx + 1);
      }
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

    return {
      success: true,
      message: `Setup written to ${fullPathDisplay}`,
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

  // 1. Download setup file
  downloadFile(params.content, setupFilename, params.sim.mimeType);

  // 2. Generate and download corresponding batch auto-mover
  const batScript = generateWindowsInstallBat(winDir, setupFilename, params.setupName);
  setTimeout(() => {
    downloadFile(batScript, `Install_${cleanName}.bat`, "application/x-bat");
  }, 400);
}
