import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ACDocsDetectionResult {
  documentsPath: string | null;
  setupsRoot: string | null;
  carCount: number;
  searchedCandidates: string[];
}

export interface ACCarMatchResult {
  folder: string;
  method: "exact" | "slug" | "substring" | "token_score" | "fallback";
  score?: number;
  availableCars?: string[];
}

/**
 * Dynamically resolves all candidate Documents directories across any Windows PC.
 * Accounts for:
 * 1. Windows Registry (HKCU User Shell Folders Personal) - handles custom relocated drives and OneDrive sync
 * 2. %USERPROFILE%\OneDrive\Documents
 * 3. %USERPROFILE%\Documents
 * 4. %OneDrive%\Documents and %OneDriveConsumer%\Documents
 */
export function getWindowsDocsCandidates(): string[] {
  const candidates: string[] = [];

  // 1. Query Windows Registry for active Personal (Documents) folder
  if (process.platform === "win32") {
    try {
      const regCmd = 'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders" /v Personal';
      const regOutput = execSync(regCmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
      const match = regOutput.match(/Personal\s+REG_\w+\s+(.*)/i);
      if (match && match[1]) {
        let regPath = match[1].trim();
        const userProf = process.env.USERPROFILE || "";
        regPath = regPath.replace(/%USERPROFILE%/i, userProf);
        if (regPath && fs.existsSync(regPath)) {
          candidates.push(regPath);
        }
      }
    } catch (_err) {
      // Non-fatal, proceed with environment variables
    }
  }

  // 2. OneDrive Documents
  const userProfile = process.env.USERPROFILE || process.env.HOME || "";
  if (userProfile) {
    candidates.push(path.join(userProfile, "OneDrive", "Documents"));
    candidates.push(path.join(userProfile, "Documents"));
  }

  if (process.env.OneDrive) {
    candidates.push(path.join(process.env.OneDrive, "Documents"));
  }
  if (process.env.OneDriveConsumer) {
    candidates.push(path.join(process.env.OneDriveConsumer, "Documents"));
  }

  // 3. Fallbacks
  candidates.push(path.join(userProfile, "OneDrive - Personal", "Documents"));

  // Deduplicate and filter existing paths
  const seen = new Set<string>();
  const validPaths: string[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const normalized = path.normalize(c).toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      if (fs.existsSync(c)) {
        validPaths.push(c);
      }
    }
  }

  return validPaths;
}

/**
 * Finds the active Assetto Corsa setups root directory.
 * If multiple locations exist, picks the one with the most installed car setups folders.
 */
export function resolveACSetupsRoot(): ACDocsDetectionResult {
  const docsList = getWindowsDocsCandidates();
  let bestRoot: string | null = null;
  let bestDocsPath: string | null = null;
  let maxCars = -1;

  for (const docPath of docsList) {
    const candidateRoot = path.join(docPath, "Assetto Corsa", "setups");
    if (fs.existsSync(candidateRoot)) {
      try {
        const count = fs.readdirSync(candidateRoot).filter((f) => {
          try {
            return fs.statSync(path.join(candidateRoot, f)).isDirectory();
          } catch {
            return false;
          }
        }).length;

        if (count > maxCars) {
          maxCars = count;
          bestRoot = candidateRoot;
          bestDocsPath = docPath;
        }
      } catch (_e) {}
    }
  }

  // Fallback: If no existing setups root has car folders, default to the top Documents folder
  if (!bestRoot && docsList.length > 0) {
    bestDocsPath = docsList[0];
    bestRoot = path.join(bestDocsPath, "Assetto Corsa", "setups");
    maxCars = 0;
  }

  return {
    documentsPath: bestDocsPath,
    setupsRoot: bestRoot,
    carCount: Math.max(0, maxCars),
    searchedCandidates: docsList,
  };
}

/**
 * Returns all car folders currently installed in the Assetto Corsa setups root.
 */
export function getInstalledACCarFolders(setupsRoot: string): string[] {
  if (!fs.existsSync(setupsRoot)) return [];
  try {
    return fs
      .readdirSync(setupsRoot)
      .filter((name) => {
        try {
          return (
            fs.statSync(path.join(setupsRoot, name)).isDirectory() &&
            !name.startsWith(".")
          );
        } catch {
          return false;
        }
      })
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Intelligently finds the best matching car folder in Assetto Corsa setups for a given car query.
 *
 * Handles:
 * - Exact directory match: 'rss_formula_hybrid_2021'
 * - Cleaned slug match: 'formula_hybrid_2021' -> 'rss_formula_hybrid_2021'
 * - Substring match: 'ferrari_488_gt3' -> 'ks_ferrari_488_gt3'
 * - Token-based weighted scoring (handles manufacturer prefixes, mod team tags like rss_, ks_, vrc_, year tags)
 */
export function matchACCarFolder(
  setupsRoot: string,
  carQuery: string
): ACCarMatchResult {
  const folders = getInstalledACCarFolders(setupsRoot);
  const qLower = (carQuery || "").toLowerCase().trim();
  const qSlug = qLower.replace(/[^a-z0-9]+/g, "");
  const qTokens = qLower
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !["the", "car", "mod", "assetto", "corsa"].includes(t));

  if (folders.length === 0) {
    return {
      folder: qLower.replace(/[^a-z0-9]+/g, "_"),
      method: "fallback",
      availableCars: [],
    };
  }

  // 1. Exact match
  const exact = folders.find((f) => f.toLowerCase() === qLower);
  if (exact) {
    return { folder: exact, method: "exact", availableCars: folders };
  }

  // 2. Slug match (ignoring underscores, hyphens, spaces)
  const slugMatch = folders.find(
    (f) => f.toLowerCase().replace(/[^a-z0-9]+/g, "") === qSlug
  );
  if (slugMatch) {
    return { folder: slugMatch, method: "slug", availableCars: folders };
  }

  // 3. Substring match
  const subMatch = folders.find(
    (f) =>
      f.toLowerCase().includes(qLower) ||
      (qLower.length > 4 && qLower.includes(f.toLowerCase()))
  );
  if (subMatch) {
    return { folder: subMatch, method: "substring", availableCars: folders };
  }

  // 4. Weighted Token Match
  let bestFolder: string | null = null;
  let highestScore = 0;

  for (const f of folders) {
    const fLower = f.toLowerCase();
    const fTokens = fLower.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
    let score = 0;

    for (const token of qTokens) {
      if (fTokens.includes(token)) {
        // High priority for year indicators (2021, 2024, 2026, 2017)
        if (/^\d{4}$/.test(token)) score += 6;
        // High priority for car brands or mod teams
        else if (
          [
            "rss",
            "vrc",
            "ferrari",
            "porsche",
            "bmw",
            "audi",
            "amg",
            "mercedes",
            "mclaren",
            "lamborghini",
            "redbull",
            "alpine",
            "clio",
          ].includes(token)
        )
          score += 4;
        else score += 2;
      } else if (fLower.includes(token)) {
        score += 1;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestFolder = f;
    }
  }

  if (bestFolder && highestScore >= 2) {
    return {
      folder: bestFolder,
      method: "token_score",
      score: highestScore,
      availableCars: folders,
    };
  }

  // Fallback: Sanitized slug of user query
  return {
    folder: qLower.replace(/[^a-z0-9]+/g, "_"),
    method: "fallback",
    availableCars: folders,
  };
}
