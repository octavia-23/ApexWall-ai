import { SetupSection, SetupItem } from "@/types/telemetry";
import { ParameterDefinition } from "./types";
import { getGameSetupProfile } from "../game-setup-profiles";
import { detectChassisArchetype, getCalibratedAdaptiveSetup } from "../chassis-archetypes";
import { getCircuitAeroProfile } from "../circuit-aero-profiles";
import { parseNumericValue, findParameterDefinition, getAuthoritativeCatalog } from "./parameter-catalog";

/**
 * ============================================================================
 * CONSERVATIVE BASELINE GENERATOR & BASELINE PRESERVATION ENGINE
 * ============================================================================
 * Ensures that setups are NEVER invented from nothing.
 * If a baseline exists, it is preserved completely and only 1-3 targeted
 * parameters are modified.
 * If no baseline exists, a conservative, physically grounded baseline is established
 * and marked as BASELINE.
 * ============================================================================
 */

export interface BaselineContext {
  isBaseline: boolean;
  sections: SetupSection[];
  parameterMap: Map<string, { label: string; value: string; numericVal: number | null; sectionTitle: string }>;
  summary: string;
  notes: string;
}

export function buildBaselineSetup(
  game: string,
  car: string,
  track: string,
  requestParams: {
    sessionType?: string;
    weather?: string;
    trackTemp?: string;
    airTemp?: string;
    fuelLoad?: string;
    tyreCompound?: string;
    driverStyle?: string;
    handlingIssue?: string;
    skillLevel?: string;
  },
  existingBaseline?: { summary?: string; sections: SetupSection[] },
  fullBaselineRequested?: boolean,
  customModProfile?: any
): BaselineContext {
  const catalog = getAuthoritativeCatalog(game, car, customModProfile);

  // 1. If an existing baseline setup was supplied and full baseline was NOT requested: PRESERVE IT!
  if (existingBaseline && existingBaseline.sections?.length > 0 && !fullBaselineRequested) {
    const paramMap = new Map<string, { label: string; value: string; numericVal: number | null; sectionTitle: string }>();

    existingBaseline.sections.forEach((sec) => {
      sec.items.forEach((it) => {
        const itemData = {
          label: it.label,
          value: it.value,
          numericVal: parseNumericValue(it.value),
          sectionTitle: sec.title,
        };
        paramMap.set(it.label.toLowerCase().trim(), itemData);
        const def = findParameterDefinition(catalog, it.label);
        if (def) {
          paramMap.set(def.label.toLowerCase().trim(), itemData);
          paramMap.set(def.id.toLowerCase().trim(), itemData);
          def.aliases.forEach((a) => paramMap.set(a.toLowerCase().trim(), itemData));
        }
      });
    });

    return {
      isBaseline: false,
      sections: existingBaseline.sections,
      parameterMap: paramMap,
      summary: existingBaseline.summary || `Preserved baseline setup for ${car} at ${track}.`,
      notes: "Operating from established baseline configuration.",
    };
  }

  // 2. If custom mod sliders are available, build an authoritative baseline from mod garage sliders
  if (customModProfile?.sliders?.length > 0) {
    const secMap = new Map<string, { label: string; value: string; styleNote?: string }[]>();
    for (const s of customModProfile.sliders) {
      const cat = (s.category || "GENERAL").toUpperCase();
      if (!secMap.has(cat)) secMap.set(cat, []);
      const val = s.defaultValue !== undefined ? s.defaultValue : s.min;
      const formatted = s.unit ? `${val} ${s.unit}` : `${val}`;
      secMap.get(cat)!.push({ label: s.name, value: formatted });
    }

    const modSections: SetupSection[] = Array.from(secMap.entries()).map(([title, items]) => ({
      title,
      items,
    }));

    const paramMap = new Map<string, { label: string; value: string; numericVal: number | null; sectionTitle: string }>();
    modSections.forEach((sec) => {
      sec.items.forEach((it) => {
        const itemData = {
          label: it.label,
          value: it.value,
          numericVal: parseNumericValue(it.value),
          sectionTitle: sec.title,
        };
        paramMap.set(it.label.toLowerCase().trim(), itemData);
        const def = findParameterDefinition(catalog, it.label);
        if (def) {
          paramMap.set(def.label.toLowerCase().trim(), itemData);
          paramMap.set(def.id.toLowerCase().trim(), itemData);
          def.aliases.forEach((a) => paramMap.set(a.toLowerCase().trim(), itemData));
        }
      });
    });

    return {
      isBaseline: true,
      sections: modSections,
      parameterMap: paramMap,
      summary: `Authoritative baseline parsed from ${customModProfile.name || car} mod garage sliders.`,
      notes: `Built directly from Assetto Corsa ${customModProfile.sliders.length} garage parameters.`,
    };
  }

  // 3. Generate a conservative, physically grounded procedural baseline
  const profile = getGameSetupProfile(game);
  const archetype = detectChassisArchetype(car, game);
  const aeroProfile = getCircuitAeroProfile(track);

  // Call the game's authentic procedural profile generator
  const procedural = profile.generateProceduralSetup({
    car,
    track,
    sessionType: requestParams.sessionType,
    weather: requestParams.weather,
    trackTemp: requestParams.trackTemp,
    airTemp: requestParams.airTemp,
    fuelLoad: requestParams.fuelLoad,
    tyreCompound: requestParams.tyreCompound,
    driverStyle: requestParams.driverStyle,
    handlingIssue: "Conservative baseline configuration",
    skillLevel: requestParams.skillLevel,
  });

  const paramMap = new Map<string, { label: string; value: string; numericVal: number | null; sectionTitle: string }>();

  procedural.sections.forEach((sec) => {
    sec.items.forEach((it) => {
      const itemData = {
        label: it.label,
        value: it.value,
        numericVal: parseNumericValue(it.value),
        sectionTitle: sec.title,
      };
      paramMap.set(it.label.toLowerCase().trim(), itemData);
      const def = findParameterDefinition(catalog, it.label);
      if (def) {
        paramMap.set(def.label.toLowerCase().trim(), itemData);
        paramMap.set(def.id.toLowerCase().trim(), itemData);
        def.aliases.forEach((a) => paramMap.set(a.toLowerCase().trim(), itemData));
      }
    });
  });

  return {
    isBaseline: true,
    sections: procedural.sections,
    parameterMap: paramMap,
    summary: `Conservative baseline setup for ${car} at ${track} (${aeroProfile.tierName}). Operating in balanced median parameter ranges.`,
    notes: procedural.engineerNotes || `Radio check driver: this is a conservative baseline setup calibrated against authentic ${archetype.displayName} vehicle dynamics.`,
  };
}
