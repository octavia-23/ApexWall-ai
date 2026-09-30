import { RealCircuitDefinition, CircuitCategory, CircuitMetadataItem } from "./circuit-types";
import { REAL_CIRCUITS } from "./circuits-registry";

/**
 * Universal Multi-Simulator Keyword and Alias Mapping for 60 Global Circuits
 * Supports Assetto Corsa folder IDs, ACC track codes, iRacing names, LMU WEC tracks, and F1 codes.
 */
const TRACK_ALIASES: Record<string, string> = {
  // F1 tracks
  "bahrain": "bahrain",
  "sakhir": "bahrain",
  "ks_bahrain": "bahrain",
  "jeddah": "jeddah",
  "corniche": "jeddah",
  "saudi": "jeddah",
  "jeddah_2021_chq": "jeddah",
  "melbourne": "melbourne",
  "albert_park": "melbourne",
  "albertpark": "melbourne",
  "australia": "melbourne",
  "suzuka": "suzuka",
  "ks_suzuka": "suzuka",
  "japan": "suzuka",
  "shanghai": "shanghai",
  "china": "shanghai",
  "miami": "miami",
  "autodrome": "miami",
  "imola": "imola",
  "ks_imola": "imola",
  "dino_ferrari": "imola",
  "monaco": "monaco",
  "monte_carlo": "monaco",
  "montecarlo": "monaco",
  "ks_monaco": "monaco",
  "montreal": "montreal",
  "gilles_villeneuve": "montreal",
  "gilles": "montreal",
  "canada": "montreal",
  "barcelona": "barcelona",
  "catalunya": "barcelona",
  "montmelo": "barcelona",
  "ks_barcelona": "barcelona",
  "redbullring": "redbullring",
  "red_bull_ring": "redbullring",
  "spielberg": "redbullring",
  "austria": "redbullring",
  "ks_red_bull_ring": "redbullring",
  "silverstone": "silverstone",
  "ks_silverstone": "silverstone",
  "hungaroring": "hungaroring",
  "budapest": "hungaroring",
  "hungary": "hungaroring",
  "spa": "spa",
  "francorchamps": "spa",
  "ks_spa": "spa",
  "zandvoort": "zandvoort",
  "ks_zandvoort": "zandvoort",
  "dutch": "zandvoort",
  "monza": "monza",
  "ks_monza": "monza",
  "rettifilo": "monza",
  "baku": "baku",
  "azerbaijan": "baku",
  "singapore": "singapore",
  "marina_bay": "singapore",
  "marinabay": "singapore",
  "cota": "cota",
  "americas": "cota",
  "circuit_of_the_americas": "cota",
  "austin": "cota",
  "mexico": "mexico",
  "hermanos_rodriguez": "mexico",
  "mexico_city": "mexico",
  "interlagos": "interlagos",
  "jose_carlos_pace": "interlagos",
  "sao_paulo": "interlagos",
  "brasil": "interlagos",
  "brazil": "interlagos",
  "lasvegas": "lasvegas",
  "las_vegas": "lasvegas",
  "vegas": "lasvegas",
  "losail": "losail",
  "lusail": "losail",
  "qatar": "losail",
  "yasmarina": "yasmarina",
  "yas_marina": "yasmarina",
  "abu_dhabi": "yasmarina",
  "portimao": "portimao",
  "algarve": "portimao",
  "paulricard": "paulricard",
  "paul_ricard": "paulricard",
  "le_castellet": "paulricard",
  "castellet": "paulricard",
  "hockenheim": "hockenheim",
  "hockenheimring": "hockenheim",
  "sepang": "sepang",
  "malaysia": "sepang",
  "acu_sepang": "sepang",

  // GT & ACC tracks
  "brandshatch": "brandshatch",
  "brands_hatch": "brandshatch",
  "ks_brands_hatch": "brandshatch",
  "misano": "misano",
  "marco_simoncelli": "misano",
  "bathurst": "bathurst",
  "mount_panorama": "bathurst",
  "mountpanorama": "bathurst",
  "rt_bathurst": "bathurst",
  "panorama": "bathurst",
  "kyalami": "kyalami",
  "lagunaseca": "lagunaseca",
  "laguna_seca": "lagunaseca",
  "ks_laguna_seca": "lagunaseca",
  "donington": "donington",
  "donington_park": "donington",
  "oultonpark": "oultonpark",
  "oulton_park": "oultonpark",
  "oulton": "oultonpark",
  "snetterton": "snetterton",
  "snetterton_300": "snetterton",
  "watkinsglen": "watkinsglen",
  "watkins_glen": "watkinsglen",
  "lilski_watkins_glen": "watkinsglen",
  "glen": "watkinsglen",
  "indianapolis": "indianapolis",
  "indy_road": "indianapolis",
  "ims": "indianapolis",
  "valencia": "valencia",
  "ricardo_tormo": "valencia",
  "cheste": "valencia",
  "zolder": "zolder",
  "terlamen": "zolder",
  "nurburgring_gp": "nurburgring_gp",
  "nurburgring": "nurburgring_gp",
  "nürburgring": "nurburgring_gp",
  "ks_nurburgring": "nurburgring_gp",
  "nordschleife": "nordschleife",
  "green_hell": "nordschleife",
  "touristenfahrten": "nordschleife",
  "ks_nordschleife": "nordschleife",

  // WEC & Le Mans Ultimate
  "lemans": "lemans",
  "le_mans": "lemans",
  "sarthe": "lemans",
  "circuit_de_la_sarthe": "lemans",
  "fn_lemans": "lemans",
  "daytona": "daytona",
  "daytona_road": "daytona",
  "fuji": "fuji",
  "fuji_speedway": "fuji",
  "sebring": "sebring",
  "sebring_12h": "sebring",
  "nurburgring24h": "nurburgring24h",
  "nurburgring_24h": "nurburgring24h",
  "n24": "nurburgring24h",
  "nurburgring_vln": "nurburgring_vln",
  "vln": "nurburgring_vln",
  "nls": "nurburgring_vln",

  // Classics & iRacing
  "roadamerica": "roadamerica",
  "road_america": "roadamerica",
  "elkhart_lake": "roadamerica",
  "roadatlanta": "roadatlanta",
  "road_atlanta": "roadatlanta",
  "michelin_raceway": "roadatlanta",
  "jr_road_atlanta_2022": "roadatlanta",
  "mugello": "mugello",
  "ks_mugello": "mugello",
  "vir": "vir",
  "virginia": "vir",
  "virginia_international_raceway": "vir",
  "limerock": "limerock",
  "lime_rock": "limerock",
  "lime_rock_park": "limerock",
  "longbeach": "longbeach",
  "long_beach": "longbeach",
  "mosport": "mosport",
  "canadian_tire": "mosport",
  "vallelunga": "vallelunga",
  "ks_vallelunga": "vallelunga",
  "tsukuba": "tsukuba",
  "knockhill": "knockhill",
  "sonoma": "sonoma",
  "sears_point": "sonoma",
  "midohio": "midohio",
  "mid_ohio": "midohio",
};

/**
 * Intelligent Multi-Sim Circuit Matcher
 * Resolves track name or telemetry filename against all 60 circuits with multi-tier fuzzy matching:
 * 1. Direct ID match
 * 2. Alias keyword lookup (understanding ACC, AC, F1, iRacing, LMU folder conventions)
 * 3. Token-based word scoring
 * 4. Telemetry lap distance matching (+/- 4% of official surveyed track length)
 */
export function getAuthenticTrackGeometry(trackNameOrHint?: string, totalDist?: number): RealCircuitDefinition | null {
  const raw = (trackNameOrHint || "").toLowerCase().trim();
  const clean = raw.replace(/[^a-z0-9_\-\s]+/g, " ");

  // 1. Direct ID lookup
  if (REAL_CIRCUITS[raw]) return REAL_CIRCUITS[raw];
  if (REAL_CIRCUITS[clean]) return REAL_CIRCUITS[clean];

  // 2. Exact alias match
  const stripped = clean.replace(/[\-\s]+/g, "_");
  if (TRACK_ALIASES[stripped] && REAL_CIRCUITS[TRACK_ALIASES[stripped]]) {
    return REAL_CIRCUITS[TRACK_ALIASES[stripped]];
  }

  // 3. Substring matching against known aliases
  for (const [alias, id] of Object.entries(TRACK_ALIASES)) {
    if (alias.length >= 4 && clean.includes(alias)) {
      if (REAL_CIRCUITS[id]) return REAL_CIRCUITS[id];
    }
  }

  // 4. Word Token Match
  const tokens = clean.split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !["the", "circuit", "track", "lap", "telemetry", "gt3", "f1"].includes(t));
  let bestMatch: RealCircuitDefinition | null = null;
  let highestScore = 0;

  for (const circuit of Object.values(REAL_CIRCUITS)) {
    const cTokens = circuit.name.toLowerCase().split(/[^a-z0-9]+/).concat(circuit.id.split(/[^a-z0-9]+/));
    let score = 0;
    for (const t of tokens) {
      if (cTokens.includes(t)) score += 3;
      else if (circuit.name.toLowerCase().includes(t)) score += 1;
    }
    if (score > highestScore) {
      highestScore = score;
      bestMatch = circuit;
    }
  }

  if (bestMatch && highestScore >= 3) {
    return bestMatch;
  }

  // 5. Distance-based fallback: match official track length within 3.5%
  if (totalDist && totalDist > 1500) {
    let closestDistDiff = Infinity;
    let closestCircuit: RealCircuitDefinition | null = null;

    for (const c of Object.values(REAL_CIRCUITS)) {
      const diff = Math.abs(c.officialDistance - totalDist);
      const ratio = diff / c.officialDistance;
      if (ratio < 0.038 && diff < closestDistDiff) {
        closestDistDiff = diff;
        closestCircuit = c;
      }
    }

    if (closestCircuit) {
      return closestCircuit;
    }
  }

  return null;
}

/**
 * Returns list of all available authentic circuits with compact metadata for UI selectors
 */
export function listAuthenticCircuits(): CircuitMetadataItem[] {
  return Object.values(REAL_CIRCUITS).map((c) => ({
    id: c.id,
    name: c.name,
    officialDistance: c.officialDistance,
    fiaGrade: c.fiaGrade,
    country: c.country,
    category: c.category || "gt",
    cornerCount: c.corners.length,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export interface CircuitCategoryGroup {
  id: CircuitCategory;
  label: string;
  badge: string;
  circuits: CircuitMetadataItem[];
}

export const CIRCUIT_CATEGORIES: { id: CircuitCategory; label: string; badge: string }[] = [
  { id: "f1", label: "Formula 1 World Championship (F1 24 / 25 / 26)", badge: "🏎️ F1" },
  { id: "gt", label: "GT World Challenge & ACC", badge: "🏆 GT / ACC" },
  { id: "wec", label: "WEC & Le Mans Ultimate", badge: "⏱️ WEC / LMU" },
  { id: "classic", label: "iRacing & Assetto Corsa Classics", badge: "🏁 Classic / iRacing" },
];

/**
 * Grouped circuits by Category for intuitive tabbed / grouped UI selectors
 */
export function getCircuitsByCategory(): CircuitCategoryGroup[] {
  const all = listAuthenticCircuits();
  return CIRCUIT_CATEGORIES.map((cat) => ({
    ...cat,
    circuits: all.filter((c) => c.category === cat.id),
  }));
}
