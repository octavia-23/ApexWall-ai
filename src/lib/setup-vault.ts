import { SetupSection } from "@/types/telemetry";

export interface SavedSetupRecord {
  id: string;
  name: string;
  createdAt: string;
  game: string;
  car: string;
  track: string;
  sessionType?: string;
  weather?: string;
  trackTemp?: string;
  airTemp?: string;
  tyreCompound?: string;
  fuelLoad?: string;
  lapTime?: string;
  driverStyle?: string;
  summary?: string;
  engineerNotes?: string;
  sections: SetupSection[];
  userId?: string;
  isPublic?: boolean;
  shareSlug?: string;
}

export interface SetupParameterDiff {
  category: string;
  label: string;
  valueA: string;
  valueB: string;
  hasChanged: boolean;
  deltaSummary: string;
  tone: "neutral" | "increase" | "decrease";
}

export interface SetupDiffResult {
  setupA: SavedSetupRecord;
  setupB: SavedSetupRecord;
  totalParameters: number;
  changedCount: number;
  unchangedCount: number;
  diffs: SetupParameterDiff[];
}

const STORAGE_KEY = "simsetup_vault_v1";

/**
 * Get all setups saved in local storage
 */
export function getSavedSetups(): SavedSetupRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSeedSetups();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultSeedSetups();
  } catch (err) {
    console.error("Failed to read setups from localStorage:", err);
    return getDefaultSeedSetups();
  }
}

/**
 * Save a new setup record
 */
export function saveSetupToVault(
  record: Omit<SavedSetupRecord, "id" | "createdAt"> & { id?: string }
): SavedSetupRecord {
  const current = getSavedSetups();
  const id = record.id || `setup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRecord: SavedSetupRecord = {
    ...record,
    id,
    createdAt: new Date().toISOString(),
  };

  const filtered = current.filter((s) => s.id !== id);
  const updated = [newRecord, ...filtered];

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("simsetup_vault_updated"));
    } catch (err) {
      console.error("Failed to save setup to localStorage:", err);
    }
  }

  return newRecord;
}

/**
 * Delete a setup record by id
 */
export function deleteSetupFromVault(id: string): SavedSetupRecord[] {
  const current = getSavedSetups();
  const updated = current.filter((s) => s.id !== id);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("simsetup_vault_updated"));
    } catch (err) {
      console.error("Failed to delete setup from localStorage:", err);
    }
  }
  return updated;
}

/**
 * Compare two setups and calculate parameter-by-parameter diff
 */
export function compareSetupRecords(
  setupA: SavedSetupRecord,
  setupB: SavedSetupRecord
): SetupDiffResult {
  const diffs: SetupParameterDiff[] = [];

  // Map Setup A parameters by category:label
  const mapA = new Map<string, { value: string; category: string; label: string }>();
  setupA.sections.forEach((sec) => {
    sec.items.forEach((item) => {
      const key = `${sec.title}::${item.label}`.toLowerCase();
      mapA.set(key, { value: item.value, category: sec.title, label: item.label });
    });
  });

  // Map Setup B parameters
  const mapB = new Map<string, { value: string; category: string; label: string }>();
  setupB.sections.forEach((sec) => {
    sec.items.forEach((item) => {
      const key = `${sec.title}::${item.label}`.toLowerCase();
      mapB.set(key, { value: item.value, category: sec.title, label: item.label });
    });
  });

  // Union of all keys
  const allKeys = Array.from(new Set([...Array.from(mapA.keys()), ...Array.from(mapB.keys())]));

  let changedCount = 0;
  let unchangedCount = 0;

  allKeys.forEach((key) => {
    const itemA = mapA.get(key);
    const itemB = mapB.get(key);

    const valA = itemA ? itemA.value : "—";
    const valB = itemB ? itemB.value : "—";
    const category = itemA?.category || itemB?.category || "General";
    const label = itemA?.label || itemB?.label || "Parameter";

    const hasChanged = valA.trim().toLowerCase() !== valB.trim().toLowerCase();

    // Parse numeric changes if available
    const numA = parseNum(valA);
    const numB = parseNum(valB);

    let deltaSummary = hasChanged ? "Modified" : "Identical";
    let tone: "neutral" | "increase" | "decrease" = "neutral";

    if (numA != null && numB != null && hasChanged) {
      const diffVal = +(numB - numA).toFixed(2);
      if (diffVal > 0) {
        deltaSummary = `+${diffVal}`;
        tone = "increase";
      } else {
        deltaSummary = `${diffVal}`;
        tone = "decrease";
      }
    } else if (hasChanged) {
      tone = "increase";
    }

    if (hasChanged) changedCount++;
    else unchangedCount++;

    diffs.push({
      category,
      label,
      valueA: valA,
      valueB: valB,
      hasChanged,
      deltaSummary,
      tone,
    });
  });

  return {
    setupA,
    setupB,
    totalParameters: allKeys.length,
    changedCount,
    unchangedCount,
    diffs,
  };
}

function parseNum(val: string): number | null {
  const match = val.match(/[-+]?[0-9]*\.?[0-9]+/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Seed presets so the vault is populated with realistic baseline comparison examples
 */
function getDefaultSeedSetups(): SavedSetupRecord[] {
  return [
    {
      id: "seed_spa_baseline",
      name: "Spa Baseline — High Downforce",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      game: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Spa-Francorchamps GP",
      sessionType: "Qualifying",
      weather: "Dry",
      trackTemp: "30°C",
      airTemp: "22°C",
      lapTime: "2:17.482",
      driverStyle: "Heavy Trail-Braker",
      summary: "Baseline medium-high downforce trim with stiff front ARB to resist high-speed bottoming out at Raidillon.",
      sections: [
        {
          title: "Tyres & Pressures",
          items: [
            { label: "Front Left Cold Pressure", value: "26.2 psi" },
            { label: "Front Right Cold Pressure", value: "26.5 psi" },
            { label: "Rear Left Cold Pressure", value: "25.9 psi" },
            { label: "Rear Right Cold Pressure", value: "26.2 psi" },
          ],
        },
        {
          title: "Suspension & Wheel Alignment",
          items: [
            { label: "Front Anti-Roll Bar", value: "4 / 6 (Stiff)" },
            { label: "Rear Anti-Roll Bar", value: "2 / 6 (Soft)" },
            { label: "Front Camber", value: "-3.5°" },
            { label: "Rear Camber", value: "-2.8°" },
            { label: "Front Toe", value: "-0.08°" },
            { label: "Rear Toe", value: "+0.15°" },
          ],
        },
        {
          title: "Aerodynamics & Ride Height",
          items: [
            { label: "Front Ride Height", value: "54 mm" },
            { label: "Rear Ride Height", value: "70 mm" },
            { label: "Rear Wing Angle", value: "9 / 12" },
          ],
        },
        {
          title: "Brakes & Electronics",
          items: [
            { label: "Brake Bias", value: "54.8%" },
            { label: "Traction Control (TC1)", value: "4 / 11" },
            { label: "ABS Setting", value: "3 / 11" },
            { label: "Differential Preload", value: "70 Nm" },
          ],
        },
      ],
    },
    {
      id: "seed_spa_adaptive_trailbrake",
      name: "Spa Adaptive — Neutral Trail-Brake Spec",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      game: "Assetto Corsa Competizione",
      car: "Ferrari 296 GT3",
      track: "Spa-Francorchamps GP",
      sessionType: "Hotlap",
      weather: "Dry",
      trackTemp: "30°C",
      airTemp: "22°C",
      lapTime: "2:16.630",
      driverStyle: "Heavy Trail-Braker",
      summary: "Calibrated to eliminate mid-corner understeer: softened front ARB, rearward brake bias shift, and lower rear wing for superior Kemmel straight top speed.",
      sections: [
        {
          title: "Tyres & Pressures",
          items: [
            { label: "Front Left Cold Pressure", value: "26.4 psi" },
            { label: "Front Right Cold Pressure", value: "26.7 psi" },
            { label: "Rear Left Cold Pressure", value: "26.2 psi" },
            { label: "Rear Right Cold Pressure", value: "26.4 psi" },
          ],
        },
        {
          title: "Suspension & Wheel Alignment",
          items: [
            { label: "Front Anti-Roll Bar", value: "2 / 6 (Soft)" },
            { label: "Rear Anti-Roll Bar", value: "3 / 6 (Medium)" },
            { label: "Front Camber", value: "-3.6°" },
            { label: "Rear Camber", value: "-2.8°" },
            { label: "Front Toe", value: "-0.10°" },
            { label: "Rear Toe", value: "+0.14°" },
          ],
        },
        {
          title: "Aerodynamics & Ride Height",
          items: [
            { label: "Front Ride Height", value: "51 mm" },
            { label: "Rear Ride Height", value: "68 mm" },
            { label: "Rear Wing Angle", value: "7 / 12" },
          ],
        },
        {
          title: "Brakes & Electronics",
          items: [
            { label: "Brake Bias", value: "53.8%" },
            { label: "Traction Control (TC1)", value: "3 / 11" },
            { label: "ABS Setting", value: "3 / 11" },
            { label: "Differential Preload", value: "50 Nm" },
          ],
        },
      ],
    },
  ];
}
